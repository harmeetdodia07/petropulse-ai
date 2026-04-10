"""
api/app.py  ·  PetroPulse AI — Unified Backend v2.0
=====================================================
Combines the full AI pipeline (ARIMA, Prophet, XGBoost, Monte Carlo,
Route Intelligence, Decision Engine) with live market data APIs
(Alpha Vantage, EIA, FRED, OilPriceAPI) and AI insight generation
(OpenAI GPT-4o / Gemini fallback).

Start:
    uvicorn api.app:app --reload --port 8000

Endpoints:
    GET  /health                  → Health check
    GET  /api/health              → Health check (frontend compat alias)
    GET  /api/market-status       → Live Brent, WTI, USD/INR from real APIs
    GET  /api/business-insights   → AI-generated market insights (GPT-4o/Gemini)
    POST /predict                 → Full AI pipeline (all 6 modules)
    POST /predict/price           → Price forecast only
    POST /predict/news            → News intelligence only
    POST /predict/profit          → Profit impact only
    POST /predict/route           → Route intelligence only
    POST /predict/simulation      → Monte Carlo simulation only
    POST /predict/enhanced        → Full pipeline + live market data enrichment
"""

import sys
import os
import time
import json
import traceback

sys.path.insert(0, __file__.replace("/api/app.py", ""))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

from utils.logger import get_logger

# Load API keys from .env
load_dotenv()

log = get_logger("api")

app = FastAPI(
    title="PetroPulse AI",
    description=(
        "AI-powered fuel price intelligence, logistics routing, and profit analysis "
        "for Indian trucking. Integrates live market data with ML predictions."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════
# LIVE MARKET DATA CLIENTS (from services layer)
# ══════════════════════════════════════════════
def _init_clients():
    """Lazy-init API clients so missing keys never crash startup."""
    try:
        from services.api_clients import (
            OilPriceClient,
            AlphaVantageClient,
            EIAClient,
            FREDClient,
            AIService,
        )
        return {
            "oil":  OilPriceClient(os.getenv("OILPRICE_API_KEY", "")),
            "av":   AlphaVantageClient(os.getenv("ALPHA_VANTAGE_API_KEY", "")),
            "eia":  EIAClient(os.getenv("EIA_API_KEY", "")),
            "fred": FREDClient(os.getenv("FRED_API_KEY", "")),
            "ai":   AIService(
                        os.getenv("OPENAI_API_KEY", ""),
                        os.getenv("GEMINI_API_KEY", ""),
                    ),
        }
    except Exception as e:
        log.warning(f"Could not init live API clients: {e}")
        return {}


clients: Dict = _init_clients()

# ── Simple In-Memory Cache ──────────────────
_cache: Dict[str, Dict] = {
    "market_data": {"data": None, "ts": 0},
    "insights":    {"data": None, "ts": 0},
}
CACHE_TTL = 300  # 5 minutes


def _cached(key: str, ttl: int = CACHE_TTL):
    entry = _cache.get(key, {})
    if entry.get("data") and (time.time() - entry.get("ts", 0)) < ttl:
        return entry["data"]
    return None


def _set_cache(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}


# ══════════════════════════════════════════════
# REQUEST / RESPONSE SCHEMAS
# ══════════════════════════════════════════════
class PriceRequest(BaseModel):
    horizon_days: int = Field(default=7, ge=1, le=30, description="Forecast horizon in days")


class NewsRequest(BaseModel):
    headlines: Optional[List[str]] = Field(default=None, description="News headlines to analyse")


class ProfitRequest(BaseModel):
    distance_km:           float = Field(default=325.0)
    fuel_consumed_litres:  float = Field(default=70.0)
    actual_fuel_cost_rs:   float = Field(default=6500.0)
    load_num:              float = Field(default=0.5, ge=0.0, le=1.0, description="0=empty, 0.5=half, 1=full")
    hard_braking_events:   int   = Field(default=5)
    idling_minutes:        int   = Field(default=60)
    speeding_events:       int   = Field(default=3)
    diesel_rsp:            float = Field(default=93.0)
    vat_pct:               float = Field(default=18.0)
    tank_capacity_litres:  float = Field(default=200.0)


class RouteRequest(BaseModel):
    source:      str = Field(default="Ahmedabad", description="Origin city")
    destination: str = Field(default="Mumbai",    description="Destination city")


class SimulationRequest(BaseModel):
    price_change_pct:  float         = Field(default=10.0, description="Fuel price change %")
    route_change:      bool          = Field(default=False, description="Is rerouting required?")
    demand_change_pct: float         = Field(default=0.0,  description="Demand change %")
    preset:            Optional[str] = Field(default=None, description="Preset: price_up_10 / geopolitical_shock / etc.")


class FullPredictionRequest(BaseModel):
    source:      str                         = Field(default="Ahmedabad")
    destination: str                         = Field(default="Mumbai")
    scenario:    Optional[SimulationRequest] = None
    headlines:   Optional[List[str]]         = None
    truck_input: Optional[Dict[str, Any]]    = None


class EnhancedPredictionRequest(FullPredictionRequest):
    """Full pipeline + live market data enrichment."""
    use_live_price: bool = Field(
        default=True,
        description="Blend ARIMA/Prophet price with live Brent-derived diesel estimate",
    )


# ══════════════════════════════════════════════
# HEALTH ENDPOINTS
# ══════════════════════════════════════════════
@app.get("/health")
@app.get("/api/health")
def health():
    return JSONResponse(content={
        "status": "ok",
        "service": "PetroPulse AI",
        "version": "2.0.0",
        "modules": [
            "price_forecaster", "news_intelligence", "profit_model",
            "route_intelligence", "monte_carlo_simulator", "decision_engine",
        ],
        "live_apis": list(clients.keys()),
        "concurrency_model": "ASGI/Uvicorn",
    })


# ══════════════════════════════════════════════
# LIVE MARKET DATA ENDPOINTS
# (Frontend JS calls these directly via /api/market-status etc.)
# ══════════════════════════════════════════════
@app.get("/api/market-status")
async def get_market_status():
    """
    Fetch live Brent, WTI, and USD/INR from Alpha Vantage / EIA.
    Falls back gracefully if APIs are unavailable.
    Cached for 5 minutes to respect API rate limits.
    """
    cached = _cached("market_data")
    if cached:
        return cached

    data = {
        "brent":         82.40,
        "wti":           78.15,
        "usd_inr":       93.01,   # Updated to current market rate (Apr 2026)
        "interest_rate": None,
        "source":        "fallback",
        "fetched_at":    datetime.utcnow().isoformat(),
    }

    av   = clients.get("av")
    eia  = clients.get("eia")
    fred = clients.get("fred")

    # ── Brent via Alpha Vantage ──
    if av:
        try:
            av_brent = av.get_brent_price()
            series = av_brent.get("data", [])
            if series:
                data["brent"] = float(series[0]["value"])
                data["source"] = "alpha_vantage"
        except Exception as e:
            log.warning(f"Alpha Vantage Brent failed: {e}")

    # ── Brent via EIA (backup) ──
    if data["source"] == "fallback" and eia:
        try:
            eia_data = eia.get_weekly_brent()
            rows = eia_data.get("response", {}).get("data", [])
            if rows:
                data["brent"] = float(rows[0]["value"])
                data["source"] = "eia"
        except Exception as e:
            log.warning(f"EIA Brent failed: {e}")

    # ── USD/INR via Alpha Vantage ──
    if av:
        try:
            fx = av.get_usd_inr()
            rate = fx.get("Realtime Currency Exchange Rate", {}).get("5. Exchange Rate")
            if rate:
                data["usd_inr"] = float(rate)
        except Exception as e:
            log.warning(f"Alpha Vantage USD/INR failed: {e}")

    # ── US Fed Funds Rate via FRED ──
    if fred:
        try:
            fred_data = fred.get_interest_rate()
            obs = fred_data.get("observations", [])
            if obs:
                data["interest_rate"] = float(obs[0]["value"])
        except Exception as e:
            log.warning(f"FRED interest rate failed: {e}")

    # ── Derive WTI from Brent (historical ~$3.80 spread) ──
    data["wti"] = round(data["brent"] - 3.80, 2)

    _set_cache("market_data", data)
    return data


@app.get("/api/business-insights")
async def get_business_insights():
    """
    Generate AI-driven market recommendations using live prices.
    Primary: OpenAI GPT-4o (structured JSON).
    Fallback: Gemini 1.5 Flash.
    Fallback²: Rule-based static insights.
    """
    cached = _cached("insights")
    if cached:
        return cached

    market = await get_market_status()
    ai_svc = clients.get("ai")

    if ai_svc:
        try:
            insights_json = ai_svc.generate_market_insights(market)
            data = json.loads(insights_json)
        except Exception as e:
            log.warning(f"AI insights failed: {e}")
            data = _static_insights(market)
    else:
        data = _static_insights(market)

    _set_cache("insights", data)
    return data


def _static_insights(market: dict) -> dict:
    """Rule-based fallback insights when AI APIs are unavailable."""
    brent    = market.get("brent", 82.4)
    usd_inr  = market.get("usd_inr", 93.01)   # Updated to current market rate
    inr_bbl  = round(brent * usd_inr, 2)
    bias     = "Neutral" if 79 < brent < 88 else ("Bearish" if brent > 88 else "Bullish")

    return {
        "headline": "Current Market Stability Assessment",
        "recommendations": [
            (
                f"Brent at ${brent:.2f}/bbl (≈₹{inr_bbl:,.0f}/bbl). "
                + ("Prices above 30-day avg — consider front-loading procurement."
                   if brent > 82 else "Prices below avg — hold for better entry rates.")
            ),
            (
                f"USD/INR at ₹{usd_inr:.2f}. "
                + ("Rupee weak — hedge USD payables via 30–60-day forward contracts."
                   if usd_inr > 90 else "Rupee stable — standard hedging adequate.")
            ),
            "Monitor Red Sea and Strait of Hormuz shipping lanes for supply disruption signals.",
        ],
        "risk_bias": bias,
    }


# ══════════════════════════════════════════════
# INDIVIDUAL MODULE ENDPOINTS (original backend)
# ══════════════════════════════════════════════
@app.post("/predict/price")
def predict_price(req: PriceRequest):
    try:
        from models.price.forecaster import predict
        return predict(horizon=req.horizon_days)
    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/news")
def predict_news(req: NewsRequest):
    try:
        from models.news.news_intel import predict
        return predict(headlines=req.headlines)
    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/profit")
def predict_profit(req: ProfitRequest):
    try:
        from models.profit.profit_model import predict
        return predict(input_data=req.model_dump())
    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/route")
def predict_route(req: RouteRequest):
    try:
        from models.route.route_intel import predict
        return predict(source=req.source, destination=req.destination)
    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/simulation")
def predict_simulation(req: SimulationRequest):
    try:
        from simulation.simulator import predict
        return predict(scenario=req.model_dump(exclude_none=True))
    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
def predict_full(req: FullPredictionRequest):
    try:
        from predict_all import run_full_prediction
        scenario = req.scenario.model_dump(exclude_none=True) if req.scenario else {}
        return run_full_prediction(
            source=req.source,
            destination=req.destination,
            scenario_preset=scenario.get("preset"),
            price_change_pct=scenario.get("price_change_pct", 0.0),
            route_change=scenario.get("route_change", False),
            demand_change_pct=scenario.get("demand_change_pct", 0.0),
            headlines=req.headlines,
        )
    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════
# ENHANCED ENDPOINT — Full pipeline + live data
# ══════════════════════════════════════════════
@app.post("/predict/enhanced")
async def predict_enhanced(req: EnhancedPredictionRequest):
    """
    The most accurate endpoint. Runs the full 6-module AI pipeline and
    enriches results with live market data:
      • Live Brent/WTI prices blended into price forecast (60% ML / 40% live)
      • Live USD/INR context for profit & simulation modules
      • GPT-4o / Gemini AI insights injected into the recommendation
      • FRED interest rate context
      • Recommendation bias adjusted if AI market analysis disagrees with ML signal
    """
    try:
        # 1. Fetch live market context (cached for 5 min)
        market   = await get_market_status()
        insights = await get_business_insights()

        # 2. Run full AI pipeline
        from predict_all import run_full_prediction
        scenario = req.scenario.model_dump(exclude_none=True) if req.scenario else {}

        result = run_full_prediction(
            source=req.source,
            destination=req.destination,
            scenario_preset=scenario.get("preset"),
            price_change_pct=scenario.get("price_change_pct", 0.0),
            route_change=scenario.get("route_change", False),
            demand_change_pct=scenario.get("demand_change_pct", 0.0),
            headlines=req.headlines,
        )

        # 3. Blend live Brent into price forecast
        if req.use_live_price and market.get("source") != "fallback":
            brent_usd      = market["brent"]
            usd_inr        = market["usd_inr"]
            # Approx: ($/bbl ÷ 158.987 litres/bbl) × USD/INR × 1.45 (refining+taxes)
            live_diesel    = round((brent_usd / 158.987) * usd_inr * 1.45, 2)

            pf = result.get("price_forecast", {})
            ensemble = pf.get("ensemble", {})
            if ensemble:
                ml_price = ensemble.get("predicted_price_inr", live_diesel)
                blended  = round(ml_price * 0.60 + live_diesel * 0.40, 2)
                ensemble["predicted_price_inr"]  = blended
                ensemble["blended_with_live"]     = True
                pf["live_enrichment"] = {
                    "brent_usd":          brent_usd,
                    "usd_inr":            usd_inr,
                    "derived_diesel_inr": live_diesel,
                    "blend_ratio":        "60% ML + 40% live",
                }

        # 4. Attach live market context to response
        result["market_context"] = {
            "live_brent_usd":    market.get("brent"),
            "live_wti_usd":      market.get("wti"),
            "live_usd_inr":      market.get("usd_inr"),
            "interest_rate_pct": market.get("interest_rate"),
            "data_source":       market.get("source"),
            "fetched_at":        market.get("fetched_at"),
            "ai_insights":       insights,
        }

        # 5. Adjust recommendation warnings based on AI bias vs ML signal
        rec  = result.get("recommendation", {})
        bias = insights.get("risk_bias", "Neutral")
        action = rec.get("action", "")
        warnings = rec.get("warnings", [])

        if bias == "Bearish" and action in ("BUY_NOW", "BUY_PARTIAL"):
            warnings.append(
                "⚠️ Live AI market analysis flags BEARISH conditions — "
                "consider delaying full procurement or reducing order size."
            )
        elif bias == "Bullish" and action in ("HOLD", "DELAY"):
            warnings.append(
                "📈 Live AI market analysis flags BULLISH conditions — "
                "consider earlier procurement to avoid higher prices."
            )

        rec["warnings"] = warnings
        result["recommendation"] = rec
        result["status"]   = "ok"
        result["endpoint"] = "enhanced"

        return result

    except Exception as e:
        log.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════
# STARTUP: Auto-train missing models
# ══════════════════════════════════════════════
@app.on_event("startup")
def startup_event():
    log.info("PetroPulse AI v2.0 starting up...")
    connected = ", ".join(clients.keys()) if clients else "None (offline mode)"
    log.info(f"Live API clients: {connected}")

    from utils.config import SAVED_MODELS_DIR
    model_files = list(SAVED_MODELS_DIR.glob("*.pkl"))
    if not model_files:
        log.info("No saved models found — running train_all...")
        from train_all import train_all
        train_all()
    else:
        log.info(f"Found {len(model_files)} saved model(s). Ready.")


# ══════════════════════════════════════════════
# OPTIONAL: Serve the frontend from the same process
# Place the Petropulse AI frontend files in a "static/" folder
# at the project root and uncomment the line below.
# ══════════════════════════════════════════════
# from fastapi.staticfiles import StaticFiles
# app.mount("/", StaticFiles(directory="static", html=True), name="static")
