"""
Module 6 – Decision Engine (CORE)
===================================
Aggregates outputs from all 5 modules and generates:
  - Primary action (buy_now / hold / reroute / delay / hedge)
  - Confidence score
  - Explanation
  - Full structured JSON

API:    train() / predict(context)
"""

import json
from datetime import datetime
from typing import Dict, Optional

from utils.logger import get_logger

log = get_logger(__name__)


# ──────────────────────────────────────────────
# Decision Rules
# ──────────────────────────────────────────────
def _derive_action(
    price_trend: str,
    price_confidence: float,
    news_risk_level: str,
    news_sentiment: str,
    loss_risk: str,
    sim_risk_level: str,
    sim_loss_prob: float,
    route_risk: float,
) -> Dict:
    """
    Rule-based decision tree over all signals.
    Returns action + explanation + confidence.
    """
    score = 0         # positive = buy/act, negative = hold/delay
    reasons = []
    warnings = []

    # ── Price signal ──
    if price_trend == "up" and price_confidence > 0.65:
        score += 2
        reasons.append(f"Fuel prices trending UP (confidence {price_confidence:.0%}) — buy now locks lower price.")
    elif price_trend == "down" and price_confidence > 0.65:
        score -= 2
        reasons.append(f"Fuel prices trending DOWN (confidence {price_confidence:.0%}) — hold for better rates.")
    else:
        reasons.append("Price trend uncertain — monitor closely.")

    # ── News / Geopolitical signal ──
    if news_risk_level == "HIGH":
        score += 1
        warnings.append("HIGH geopolitical risk detected — supply disruption likely. Front-load fuel procurement.")
    elif news_risk_level == "MEDIUM":
        score += 0.5
        reasons.append("MEDIUM geopolitical risk — hedge with partial procurement.")
    else:
        reasons.append("Geopolitical situation stable.")

    if news_sentiment == "negative":
        score += 1
        warnings.append("Negative news sentiment — market pessimism may push prices higher.")
    elif news_sentiment == "positive":
        score -= 0.5
        reasons.append("Positive news sentiment — prices may soften.")

    # ── Profit / Loss signal ──
    if loss_risk == "HIGH":
        score -= 2
        warnings.append("HIGH loss risk on current route/load — consider rerouting or load optimisation.")
    elif loss_risk == "MEDIUM":
        score -= 0.5
        warnings.append("MEDIUM loss risk — review fuel procurement and load efficiency.")
    else:
        reasons.append("Profit margins within acceptable range.")

    # ── Simulation signal ──
    if sim_risk_level in ("CRITICAL", "HIGH"):
        score -= 2
        warnings.append(f"Monte Carlo shows {sim_risk_level} scenario risk (loss prob {sim_loss_prob:.0%}).")
    elif sim_risk_level == "MEDIUM":
        score -= 0.5
        warnings.append(f"Simulation shows elevated risk (loss prob {sim_loss_prob:.0%}).")

    # ── Route signal ──
    if route_risk > 60:
        warnings.append(f"Route risk score {route_risk:.0f}/100 — rerouting advised.")
    elif route_risk > 40:
        reasons.append(f"Route risk moderate ({route_risk:.0f}/100) — monitor.")

    # ── Map score to action ──
    if score >= 3:
        action = "BUY_NOW"
        explanation = "Strong buy signal: rising prices + geopolitical risk + stable margins."
    elif score >= 1.5:
        action = "BUY_PARTIAL"
        explanation = "Moderate buy signal: procure 50–60% of fuel needs now, defer rest."
    elif score >= 0:
        action = "HOLD"
        explanation = "Balanced signals: hold current position, re-evaluate in 48h."
    elif score >= -1.5:
        action = "DELAY"
        explanation = "Mild caution: delay non-urgent procurement, monitor price dip."
    elif score >= -2.5:
        action = "REROUTE"
        explanation = "Profit at risk: reroute to lower-cost states, optimise load."
    else:
        action = "HEDGE"
        explanation = "High risk environment: hedge with fixed-price contracts, delay spot purchases."

    confidence = min(0.95, max(0.45, 0.5 + abs(score) * 0.08))

    return {
        "action": action,
        "score": round(score, 2),
        "confidence": round(confidence, 3),
        "explanation": explanation,
        "reasons": reasons,
        "warnings": warnings,
    }


# ──────────────────────────────────────────────
# Train (no-op for rule engine)
# ──────────────────────────────────────────────
def train() -> None:
    log.info("Decision Engine uses rule-based logic — no training required.")


# ──────────────────────────────────────────────
# Predict (full pipeline aggregation)
# ──────────────────────────────────────────────
def predict(
    price_forecast: Optional[Dict] = None,
    news_risk: Optional[Dict] = None,
    profit_impact: Optional[Dict] = None,
    route_analysis: Optional[Dict] = None,
    simulation: Optional[Dict] = None,
    context: Optional[Dict] = None,
) -> dict:
    """
    Takes outputs from all modules.
    If any module output is None, fetches it live.
    context: optional dict with user overrides e.g. {"scenario": {...}}
    """
    context = context or {}

    # ── Fetch missing module outputs ──
    if price_forecast is None:
        try:
            from models.price.forecaster import predict as price_predict
            price_forecast = price_predict()
        except Exception as e:
            log.warning(f"Price forecast failed: {e}")
            price_forecast = {"ensemble": {"predicted_price_inr": 93.0, "trend": "up", "confidence": 0.6}}

    if news_risk is None:
        try:
            from models.news.news_intel import predict as news_predict
            news_risk = news_predict(context.get("headlines"))
        except Exception as e:
            log.warning(f"News intel failed: {e}")
            news_risk = {"summary": {"overall_sentiment": "neutral", "risk_level": "LOW", "geopolitical_risk_score": 20}}

    if profit_impact is None:
        try:
            from models.profit.profit_model import predict as profit_predict
            profit_impact = profit_predict(context.get("truck_input"))
        except Exception as e:
            log.warning(f"Profit model failed: {e}")
            profit_impact = {"loss_risk": "MEDIUM", "profit_inr": -3500, "margin_pct": -150}

    if route_analysis is None:
        try:
            from models.route.route_intel import predict as route_predict
            src = context.get("source", "Ahmedabad")
            dst = context.get("destination", "Mumbai")
            route_analysis = route_predict(src, dst)
        except Exception as e:
            log.warning(f"Route intel failed: {e}")
            route_analysis = {"best_route": {"avg_risk_score": 35.0, "total_cost_inr": 5000}}

    if simulation is None:
        try:
            from simulation.simulator import predict as sim_predict
            scenario = context.get("scenario", {"price_change_pct": 10})
            simulation = sim_predict(scenario)
        except Exception as e:
            log.warning(f"Simulation failed: {e}")
            simulation = {"monte_carlo": {"risk_level": "MEDIUM", "loss_probability": 0.45}}

    # ── Extract key signals ──
    ensemble = price_forecast.get("ensemble", {})
    price_trend = ensemble.get("trend", "up")
    price_confidence = ensemble.get("confidence", 0.6)
    price_val = ensemble.get("predicted_price_inr", 93.0)

    news_summary = news_risk.get("summary", {})
    news_risk_level = news_summary.get("risk_level", "LOW")
    news_sentiment = news_summary.get("overall_sentiment", "neutral")
    geo_risk_score = news_summary.get("geopolitical_risk_score", 20)

    loss_risk = profit_impact.get("loss_risk", "MEDIUM")
    profit_val = profit_impact.get("profit_inr", -3500)
    margin_pct = profit_impact.get("margin_pct", -150)

    best_route = route_analysis.get("best_route", {})
    route_risk = best_route.get("avg_risk_score", 35.0)

    mc = simulation.get("monte_carlo", {})
    sim_risk_level = mc.get("risk_level", "MEDIUM")
    sim_loss_prob = mc.get("loss_probability", 0.4)

    # ── Decision ──
    decision = _derive_action(
        price_trend=price_trend,
        price_confidence=price_confidence,
        news_risk_level=news_risk_level,
        news_sentiment=news_sentiment,
        loss_risk=loss_risk,
        sim_risk_level=sim_risk_level,
        sim_loss_prob=sim_loss_prob,
        route_risk=route_risk,
    )

    # ── Business Impact Summary ──
    scenario_desc = simulation.get("scenario", {}).get("description", "Base scenario")
    profit_range = mc.get("profit_range", {})

    return {
        "status": "ok",
        "generated_at": datetime.utcnow().isoformat(),

        # ── MODULE OUTPUTS ──
        "price_forecast": {
            "predicted_price_inr": price_val,
            "trend": price_trend,
            "confidence": price_confidence,
            "horizon_days": ensemble.get("horizon_days", 7),
        },
        "news_risk": {
            "sentiment": news_sentiment,
            "geopolitical_risk_score": geo_risk_score,
            "risk_level": news_risk_level,
            "disruption_flags": news_summary.get("disruption_flags", []),
        },
        "profit_impact": {
            "profit_inr": profit_val,
            "margin_pct": margin_pct,
            "loss_risk": loss_risk,
        },
        "route_analysis": {
            "path": best_route.get("path", []),
            "total_distance_km": best_route.get("total_distance_km", 0),
            "total_cost_inr": best_route.get("total_cost_inr", 0),
            "risk_score": route_risk,
        },
        "simulation": {
            "scenario": scenario_desc,
            "risk_level": sim_risk_level,
            "loss_probability": sim_loss_prob,
            "profit_p5_inr": profit_range.get("p5_inr", 0),
            "profit_p95_inr": profit_range.get("p95_inr", 0),
            "median_profit_inr": profit_range.get("median_inr", 0),
        },

        # ── CORE RECOMMENDATION ──
        "recommendation": {
            "action": decision["action"],
            "confidence": decision["confidence"],
            "score": decision["score"],
            "explanation": decision["explanation"],
            "reasons": decision["reasons"],
            "warnings": decision["warnings"],
        },
    }


if __name__ == "__main__":
    train()
    result = predict()
    import json
    print(json.dumps(result, indent=2))
