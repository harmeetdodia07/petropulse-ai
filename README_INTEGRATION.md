# PetroPulse AI — Integration Guide

## What changed

### Backend (`backend/`)

| File | Change |
|------|--------|
| `api/app.py` | **Replaced** — unified server combining all 6 AI modules + live market APIs |
| `services/api_clients.py` | **New** — OilPrice, Alpha Vantage, EIA, FRED, OpenAI/Gemini clients |
| `services/__init__.py` | **New** |
| `requirements.txt` | **Updated** — merged backend + frontend dependencies |
| `.env` | **New** — all API keys in one place |

All other backend files (`models/`, `simulation/`, `decision_engine/`, `features/`, `data/`, `pipelines/`, `utils/`) are **unchanged**.

### Frontend (`frontend/engines/engines.js`)

| Section | Change |
|---------|--------|
| `marketData` | Extended: adds `usdInr`, `interestRate`, `mlPrediction`, `fetchMlPrediction()`, `getMlAction()`, `getMlDieselPrice()`, `getMlRiskLevel()` |
| `predictionEngine.getForecast()` | Uses ARIMA+Prophet ensemble (blended with live Brent) when ML loaded |
| `predictionEngine.getSignal()` | Uses Decision Engine action when ML loaded; heuristics on first paint |
| `recommendationEngine.getInsights()` | Surfaces ML decision + Monte Carlo warnings as top insights |
| `riskScoringEngine.calculate()` | Uses ML geopolitical risk score + simulation risk level |
| `impactCalculator.calculate()` | Uses ML-blended diesel INR/litre price |

All other frontend files are **unchanged**.

---

## New API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/market-status` | Live Brent, WTI, USD/INR, interest rate (Alpha Vantage / EIA / FRED) |
| `GET /api/business-insights` | GPT-4o / Gemini market recommendations |
| `POST /predict/enhanced` | **Best endpoint** — full 6-module ML pipeline + live data enrichment |

---

## Setup

```bash
cd backend/
pip install -r requirements.txt

# Add your API keys to .env (already present)
# Then start:
uvicorn api.app:app --reload --port 8000
```

To serve the frontend from the same process, copy all frontend files
into `backend/static/` and uncomment the last line of `api/app.py`.

---

## How live data enriches ML predictions

1. **Price forecast**: ARIMA+Prophet prediction blended 60/40 with live Brent-derived diesel (₹/litre)
2. **Risk score**: ML geopolitical risk from news intelligence replaces the heuristic estimate
3. **Recommendation**: GPT-4o market bias (Bullish/Bearish) cross-checks the Decision Engine action and adds warnings if they conflict
4. **Frontend signals**: All five JS engine functions automatically upgrade from heuristics to ML data as the pipeline loads in the background
