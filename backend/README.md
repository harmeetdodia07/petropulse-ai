# PetroPulse AI — Backend v3.0

> **Production-grade AI backend for fuel price intelligence, logistics routing, cost prediction, and profit simulation.**

---

## 🏗️ Architecture

```
backend/
├── app/
│   ├── main.py               ← FastAPI entry point
│   ├── schemas.py            ← Pydantic v2 request/response models
│   ├── model_loader.py       ← Startup model loading + auto-training
│   ├── api/
│   │   ├── routes_health.py      GET  /health
│   │   ├── routes_predict.py     POST /predict-trip-cost
│   │   ├── routes_forecast.py    GET  /forecast-fuel-price
│   │   ├── routes_recommend.py   POST /recommend
│   │   ├── routes_simulate.py    POST /simulate
│   │   ├── routes_news.py        GET  /news-risk
│   │   ├── routes_dashboard.py   GET  /dashboard-summary
│   │   └── routes_routes.py      GET  /routes/optimize
│   ├── services/
│   │   ├── preprocess.py         CSV loading & cleaning
│   │   ├── feature_engineering.py All ML features
│   │   ├── train_cost_model.py   Train cost prediction model
│   │   ├── train_forecast_model.py Train price forecast
│   │   ├── predict.py            Trip cost prediction (all modes)
│   │   ├── forecast.py           Fuel price forecasting
│   │   ├── recommend.py          Decision intelligence
│   │   ├── simulate.py           Monte Carlo simulation
│   │   ├── news_intelligence.py  News risk NLP engine
│   │   ├── route_optimizer.py    NetworkX route graph
│   │   ├── profit_engine.py      Revenue & profit calculations
│   │   ├── dashboard_summary.py  KPI aggregation for frontend
│   │   └── api_clients.py        EIA, FRED, News, OpenAI, Gemini
│   └── utils/
│       ├── config.py             Paths, env vars, constants
│       ├── logger.py             Structured logger
│       └── helpers.py            JSON encoder, label helpers
├── data/
│   └── raw/
│       ├── truck_data.csv        Truck fleet specs & telemetry
│       ├── truck_route.csv       Trip history (500 routes)
│       └── state_vat.csv         State diesel RSP + VAT rates
├── models/                       Saved .pkl artifacts (auto-generated)
├── training/
│   └── run_training.py           Standalone training CLI
├── tests/
│   └── test_endpoints.py         Smoke tests for all 8 endpoints
├── .env.example                  API key template
└── requirements.txt
```

---

## ⚡ Transport Modes

| Mode | Data Source | Prediction Type |
|------|-------------|-----------------|
| `truck` | `truck_data.csv` + `truck_route.csv` | ML model (XGBoost/RF) |
| `pipeline` | **User-input form** | Deterministic formula |
| `cargo_ship` | **User-input form** | Deterministic formula |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

> **Note:** Prophet on Windows may need conda:
> ```bash
> conda install -c conda-forge prophet
> ```

### 2. Add CSV Datasets
Place these files in `backend/data/raw/` (TAB-separated):
- `truck_data.csv`
- `truck_route.csv`
- `state_vat.csv`

### 3. (Optional) Configure API Keys
```bash
cp .env.example .env
# Edit .env with your API keys — all are optional
```

### 4. Train Models
```bash
# From the backend/ directory:
python training/run_training.py          # Train all models
python training/run_training.py --cost   # Cost model only
python training/run_training.py --forecast  # Forecast only
python training/run_training.py --route  # Route graph only
```

> **Auto-training:** If models are not present, they will be trained automatically on first server startup.

### 5. Start the Server
```bash
# From the backend/ directory:
uvicorn app.main:app --reload --port 8000
```

### 6. Open API Docs
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:**       http://localhost:8000/redoc

---

## 📡 API Endpoints

### `GET /health`
```bash
curl http://localhost:8000/health
```

### `GET /forecast-fuel-price`
```bash
curl http://localhost:8000/forecast-fuel-price
```

### `POST /predict-trip-cost` — Truck
```bash
curl -X POST http://localhost:8000/predict-trip-cost \
  -H "Content-Type: application/json" \
  -d '{
    "transport_mode": "truck",
    "truck_id": "T101",
    "route": "Pune-Mumbai",
    "distance_km": 150,
    "load_status": "full",
    "state_of_refuel": "Maharashtra",
    "fuel_type": "diesel",
    "delay_days": 0
  }'
```

### `POST /predict-trip-cost` — Pipeline
```bash
curl -X POST http://localhost:8000/predict-trip-cost \
  -H "Content-Type: application/json" \
  -d '{
    "transport_mode": "pipeline",
    "pipeline_name": "West India Pipeline",
    "product_type": "diesel",
    "distance_km": 800,
    "throughput_m3_per_day": 5000,
    "operating_cost_per_km": 150,
    "fuel_type": "electricity",
    "origin_state": "Gujarat",
    "destination_state": "Maharashtra",
    "operating_days": 30,
    "electricity_cost_per_kwh": 7.5,
    "power_kw": 500
  }'
```

### `POST /predict-trip-cost` — Cargo Ship
```bash
curl -X POST http://localhost:8000/predict-trip-cost \
  -H "Content-Type: application/json" \
  -d '{
    "transport_mode": "cargo_ship",
    "vessel_name": "MV Sunrise",
    "route": "Mumbai-Kandla",
    "cargo_type": "crude_oil",
    "cargo_tonnes": 50000,
    "voyage_distance_nm": 420,
    "vessel_speed_knots": 12,
    "fuel_type": "hfo",
    "bunker_price_per_tonne": 580,
    "fuel_consumption_mt_per_day": 35,
    "port_charges_usd": 15000,
    "usd_to_inr": 83,
    "crew_cost_per_day_usd": 2500
  }'
```

### `POST /recommend`
```bash
curl -X POST http://localhost:8000/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "transport_mode": "truck",
    "truck_id": "T101",
    "route": "Pune-Mumbai",
    "distance_km": 150,
    "load_status": "full",
    "state_of_refuel": "Maharashtra"
  }'
```

### `POST /simulate`
```bash
curl -X POST http://localhost:8000/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transport_mode": "truck",
    "truck_id": "T101",
    "distance_km": 150,
    "load_status": "full",
    "state_of_refuel": "Maharashtra",
    "price_increase_percent": 10,
    "delay_days": 2,
    "fleet_size": 10
  }'
```

### `GET /news-risk`
```bash
curl http://localhost:8000/news-risk
```

### `GET /dashboard-summary`
```bash
curl http://localhost:8000/dashboard-summary
```

### `GET /routes/optimize`
```bash
curl "http://localhost:8000/routes/optimize?source=Ahmedabad&destination=Mumbai"
```

---

## 🧪 Run Tests
```bash
cd backend
python -m pytest tests/ -v
```

---

## 🔌 Frontend Integration

All endpoints return structured JSON with `"status": "ok"`. Example integration pattern:

```javascript
// Dashboard data
const dashboard = await fetch('http://localhost:8000/dashboard-summary')
  .then(r => r.json());

// Price forecast for chart
const forecast = await fetch('http://localhost:8000/forecast-fuel-price')
  .then(r => r.json());
// chart_data is [{date: "2026-04-11", price: 93.5}, ...]

// Predict trip cost
const tripCost = await fetch('http://localhost:8000/predict-trip-cost', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    transport_mode: 'truck',
    truck_id: 'T101',
    distance_km: 150,
    load_status: 'full',
    state_of_refuel: 'Maharashtra'
  })
}).then(r => r.json());
```

---

## 🧠 Decision Action Codes

| Code | Meaning |
|------|---------|
| `REFUEL_NOW` | Lock in current price — rising trend detected |
| `WAIT` | Prices falling — defer procurement |
| `CHANGE_ROUTE` | Current route is cost-inefficient |
| `CHANGE_TRUCK` | Truck health/efficiency is poor |
| `HIGH_RISK` | Geopolitical/supply disruption risk elevated |
| `HOLD` | Balanced conditions — maintain current strategy |
| `DELAY` | Delay non-urgent procurement |

---

## 📦 ML Models

| Model | Type | Algorithm | Purpose |
|-------|------|-----------|---------|
| Cost Model | Regression | XGBoost / RF / Ridge | Truck trip fuel cost |
| Forecast | Time Series | Prophet + ARIMA | Fuel price 7/30-day |
| Route Graph | Graph | NetworkX Dijkstra | Optimal route selection |
| Simulation | Stochastic | Monte Carlo | What-if scenario analysis |
| News Risk | NLP | Keyword scoring + LLM | Geopolitical risk index |
