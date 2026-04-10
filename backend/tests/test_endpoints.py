"""
tests/test_endpoints.py — PetroPulse AI Endpoint Smoke Tests
=============================================================
Tests all 8 API endpoints for basic contract correctness.

Run: pytest tests/ -v
     OR
     cd backend && python -m pytest tests/ -v
"""

import sys
from pathlib import Path

# Ensure backend/ is on the path
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Health Check
# ─────────────────────────────────────────────────────────────────────────────
def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "transport_modes" in data
    assert "truck" in data["transport_modes"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. Forecast
# ─────────────────────────────────────────────────────────────────────────────
def test_forecast():
    r = client.get("/forecast-fuel-price")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "trend" in data
    assert data["trend"] in ("rising", "stable", "falling")
    assert len(data["next_7_days"]) == 7
    assert len(data["next_30_days"]) == 30
    assert 0.0 <= data["volatility_score"] <= 1.0
    assert 0.0 <= data["confidence"] <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# 3. Predict — Truck Mode
# ─────────────────────────────────────────────────────────────────────────────
def test_predict_truck():
    payload = {
        "transport_mode":  "truck",
        "truck_id":        "T101",
        "route":           "Pune-Mumbai",
        "distance_km":     150,
        "load_status":     "full",
        "state_of_refuel": "Maharashtra",
        "fuel_type":       "diesel",
        "delay_days":      0,
    }
    r = client.post("/predict-trip-cost", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["transport_mode"] == "truck"
    assert data["predicted_fuel_cost"] > 0
    assert data["estimated_revenue"] > 0
    assert data["action_code"] in (
        "REFUEL_NOW", "WAIT", "CHANGE_ROUTE", "CHANGE_TRUCK", "HIGH_RISK", "HOLD", "DELAY"
    )
    assert data["risk_level"] in ("low", "medium", "high")
    assert isinstance(data["reasons"], list)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Predict — Pipeline Mode
# ─────────────────────────────────────────────────────────────────────────────
def test_predict_pipeline():
    payload = {
        "transport_mode":          "pipeline",
        "pipeline_name":           "West India Pipeline",
        "product_type":            "diesel",
        "distance_km":             800,
        "throughput_m3_per_day":   5000,
        "operating_cost_per_km":   150,
        "fuel_type":               "electricity",
        "origin_state":            "Gujarat",
        "destination_state":       "Maharashtra",
        "operating_days":          30,
        "electricity_cost_per_kwh": 7.5,
        "power_kw":                500,
    }
    r = client.post("/predict-trip-cost", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["transport_mode"] == "pipeline"
    assert data["predicted_fuel_cost"] > 0


# ─────────────────────────────────────────────────────────────────────────────
# 5. Predict — Cargo Ship Mode
# ─────────────────────────────────────────────────────────────────────────────
def test_predict_cargo_ship():
    payload = {
        "transport_mode":              "cargo_ship",
        "vessel_name":                 "MV Sunrise",
        "route":                       "Mumbai-Kandla",
        "cargo_type":                  "crude_oil",
        "cargo_tonnes":                50000,
        "voyage_distance_nm":          420,
        "vessel_speed_knots":          12,
        "fuel_type":                   "hfo",
        "bunker_price_per_tonne":      580,
        "fuel_consumption_mt_per_day": 35,
        "port_charges_usd":            15000,
        "usd_to_inr":                  83,
        "crew_cost_per_day_usd":       2500,
    }
    r = client.post("/predict-trip-cost", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["transport_mode"] == "cargo_ship"
    assert data["predicted_fuel_cost"] > 0


# ─────────────────────────────────────────────────────────────────────────────
# 6. Recommend
# ─────────────────────────────────────────────────────────────────────────────
def test_recommend():
    payload = {
        "transport_mode":  "truck",
        "truck_id":        "T101",
        "route":           "Pune-Mumbai",
        "distance_km":     150,
        "load_status":     "full",
        "state_of_refuel": "Maharashtra",
        "fuel_type":       "diesel",
    }
    r = client.post("/recommend", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "action_code" in data
    assert "recommendation" in data
    assert "reasons" in data
    assert isinstance(data["reasons"], list)
    assert 0.0 <= data["confidence_score"] <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# 7. Simulate
# ─────────────────────────────────────────────────────────────────────────────
def test_simulate():
    payload = {
        "transport_mode":        "truck",
        "truck_id":              "T101",
        "route":                 "Pune-Mumbai",
        "distance_km":           150,
        "load_status":           "full",
        "state_of_refuel":       "Maharashtra",
        "fuel_type":             "diesel",
        "price_increase_percent": 10,
        "delay_days":            2,
        "fleet_size":            5,
    }
    r = client.post("/simulate", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["base_cost"] > 0
    assert data["new_predicted_cost"] > 0
    assert "profit_impact" in data
    assert data["risk_change"] in ("higher", "lower", "similar")


# ─────────────────────────────────────────────────────────────────────────────
# 8. News Risk
# ─────────────────────────────────────────────────────────────────────────────
def test_news_risk():
    r = client.get("/news-risk")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["news_risk_level"] in ("low", "medium", "high")
    assert isinstance(data["top_headlines"], list)
    assert "sentiment" in data
    assert isinstance(data["disruption_flags"], list)


# ─────────────────────────────────────────────────────────────────────────────
# 9. Dashboard
# ─────────────────────────────────────────────────────────────────────────────
def test_dashboard():
    r = client.get("/dashboard-summary")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert isinstance(data["kpi_cards"], list)
    assert len(data["kpi_cards"]) >= 4
    assert isinstance(data["alerts"], list)
    assert isinstance(data["forecast_chart"], list)
    assert "top_recommendation" in data


# ─────────────────────────────────────────────────────────────────────────────
# 10. Route Optimize
# ─────────────────────────────────────────────────────────────────────────────
def test_routes_optimize():
    r = client.get("/routes/optimize?source=Ahmedabad&destination=Mumbai")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "best_route" in data
    assert "path" in data["best_route"]
    assert isinstance(data["best_route"]["path"], list)
    assert data["best_route"]["total_cost_inr"] > 0
