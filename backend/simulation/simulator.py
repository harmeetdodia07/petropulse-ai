"""
Module 5 – Simulation Engine
==============================
Monte Carlo + Scenario modeling for fuel price / route / profit scenarios.

API:    train() / predict(scenario)
Input:  scenario dict e.g. {"price_change_pct": 10, "route_change": True}
Output: profit_range, cost_impact, risk_level, scenario_results
"""

import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Optional

from utils.config import SAVED_MODELS_DIR, MC_SIMULATIONS, BASELINE_DIESEL_PRICE
from utils.logger import get_logger

log = get_logger(__name__)


# ──────────────────────────────────────────────
# Scenario Definitions
# ──────────────────────────────────────────────
PRESET_SCENARIOS = {
    "price_up_10": {"price_change_pct": 10, "route_change": False, "demand_change_pct": 0},
    "price_down_10": {"price_change_pct": -10, "route_change": False, "demand_change_pct": 0},
    "price_up_20": {"price_change_pct": 20, "route_change": False, "demand_change_pct": -5},
    "route_change": {"price_change_pct": 0, "route_change": True, "demand_change_pct": 0},
    "geopolitical_shock": {"price_change_pct": 25, "route_change": True, "demand_change_pct": -10},
    "opec_cut": {"price_change_pct": 15, "route_change": False, "demand_change_pct": -3},
    "supply_surplus": {"price_change_pct": -12, "route_change": False, "demand_change_pct": 5},
    "monsoon_disruption": {"price_change_pct": 5, "route_change": True, "demand_change_pct": -8},
}


def _load_base_metrics() -> Dict:
    """Pull real median metrics from training data."""
    try:
        from features.data_loader import build_profit_features
        df = build_profit_features()
        return {
            "avg_distance_km": float(df["distance_km"].median()),
            "avg_fuel_cost_inr": float(df["actual_fuel_cost_rs"].median()),
            "avg_fuel_litres": float(df["fuel_consumed_litres"].median()),
            "avg_cost_per_km": float(df["cost_per_km"].median()),
            "avg_revenue": float(df["revenue_est"].median()),
            "avg_profit": float(df["profit"].median()),
            "avg_margin_pct": float(df["margin_pct"].median()),
            "baseline_diesel_price": BASELINE_DIESEL_PRICE,
        }
    except Exception as e:
        log.warning(f"Could not load real metrics ({e}), using defaults")
        return {
            "avg_distance_km": 325.0,
            "avg_fuel_cost_inr": 7200.0,
            "avg_fuel_litres": 70.0,
            "avg_cost_per_km": 22.5,
            "avg_revenue": 3500.0,
            "avg_profit": -3700.0,
            "avg_margin_pct": -180.0,
            "baseline_diesel_price": BASELINE_DIESEL_PRICE,
        }


# ──────────────────────────────────────────────
# Monte Carlo Core
# ──────────────────────────────────────────────
def _run_monte_carlo(
    base: Dict,
    price_change_pct: float = 0.0,
    route_change: bool = False,
    demand_change_pct: float = 0.0,
    n_sims: int = MC_SIMULATIONS,
    seed: int = 42,
) -> Dict:
    rng = np.random.default_rng(seed)

    base_price = base["baseline_diesel_price"]
    base_litres = base["avg_fuel_litres"]
    base_cost = base["avg_fuel_cost_inr"]          # e.g. ₹7200 per trip
    base_revenue = base["avg_revenue"]              # e.g. ₹3500 (currently under cost — thin margins)

    # For simulation, model the *gap* (profit) directly with noise rather than rebuilding price*litres
    # This avoids unit compounding. Base profit = revenue - cost.
    base_profit = base["avg_profit"]               # negative (loss-making routes in data)

    # Stochastic: model profit change from scenario
    price_impact_pct = price_change_pct / 100.0
    demand_impact_pct = demand_change_pct / 100.0
    route_premium_pct = np.where(route_change,
                                  rng.uniform(0.05, 0.15, n_sims),
                                  np.zeros(n_sims))

    # Per-trip cost change from price shift
    cost_change = base_cost * price_impact_pct + base_cost * route_premium_pct
    # Per-trip revenue change from demand shift
    revenue_change = base_revenue * demand_impact_pct

    # Monte Carlo noise on profit (±8% of base cost)
    noise = rng.normal(0, base_cost * 0.08, n_sims)

    profit_samples = base_profit - cost_change + revenue_change + noise
    cost_impact = cost_change  # additional cost vs baseline

    p5, p25, p50, p75, p95 = np.percentile(profit_samples, [5, 25, 50, 75, 95])
    ci5, ci95 = np.percentile(cost_impact, [5, 95])

    loss_probability = float(np.mean(profit_samples < 0))

    if loss_probability > 0.7:
        risk_level = "CRITICAL"
    elif loss_probability > 0.5:
        risk_level = "HIGH"
    elif loss_probability > 0.3:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "simulations_run": n_sims,
        "profit_range": {
            "p5_inr": round(p5, 0),
            "p25_inr": round(p25, 0),
            "median_inr": round(p50, 0),
            "p75_inr": round(p75, 0),
            "p95_inr": round(p95, 0),
        },
        "cost_impact": {
            "p5_inr": round(ci5, 0),
            "p95_inr": round(ci95, 0),
            "mean_additional_cost_inr": round(float(np.mean(cost_impact)), 0),
        },
        "loss_probability": round(loss_probability, 3),
        "risk_level": risk_level,
        "expected_profit_inr": round(float(np.mean(profit_samples)), 0),
        "profit_std_inr": round(float(np.std(profit_samples)), 0),
    }


# ──────────────────────────────────────────────
# Train (no-op — Monte Carlo is parameter-free)
# ──────────────────────────────────────────────
def train() -> None:
    log.info("Simulation engine requires no training (Monte Carlo is parameter-free).")
    # Pre-warm base metrics
    _load_base_metrics()
    log.info("Base metrics loaded and cached.")


# ──────────────────────────────────────────────
# Predict
# ──────────────────────────────────────────────
def predict(scenario: Optional[Dict] = None) -> dict:
    """
    scenario: dict with optional keys:
      - price_change_pct (float): e.g. 10 for +10%
      - route_change (bool): True if rerouting required
      - demand_change_pct (float): e.g. -5 for -5% demand
      - preset (str): key from PRESET_SCENARIOS
    """
    if scenario is None:
        scenario = {"price_change_pct": 10.0, "route_change": False, "demand_change_pct": 0.0}

    # Allow preset names
    if "preset" in scenario:
        preset_key = scenario["preset"]
        if preset_key in PRESET_SCENARIOS:
            scenario = {**PRESET_SCENARIOS[preset_key], **{k: v for k, v in scenario.items() if k != "preset"}}
        else:
            log.warning(f"Unknown preset '{preset_key}'. Using raw scenario.")

    price_change_pct = float(scenario.get("price_change_pct", 0.0))
    route_change = bool(scenario.get("route_change", False))
    demand_change_pct = float(scenario.get("demand_change_pct", 0.0))

    base = _load_base_metrics()
    mc_results = _run_monte_carlo(
        base,
        price_change_pct=price_change_pct,
        route_change=route_change,
        demand_change_pct=demand_change_pct,
    )

    # Scenario summary
    scenario_label = []
    if price_change_pct != 0:
        direction = "+" if price_change_pct > 0 else ""
        scenario_label.append(f"Fuel price {direction}{price_change_pct}%")
    if route_change:
        scenario_label.append("Route detour (+5–15% cost)")
    if demand_change_pct != 0:
        direction = "+" if demand_change_pct > 0 else ""
        scenario_label.append(f"Demand {direction}{demand_change_pct}%")
    if not scenario_label:
        scenario_label.append("Baseline (no change)")

    return {
        "status": "ok",
        "scenario": {
            "description": " | ".join(scenario_label),
            "price_change_pct": price_change_pct,
            "route_change": route_change,
            "demand_change_pct": demand_change_pct,
        },
        "monte_carlo": mc_results,
        "base_metrics": base,
        "preset_scenarios_available": list(PRESET_SCENARIOS.keys()),
        "generated_at": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    train()
    import json
    print(json.dumps(predict({"price_change_pct": 15, "route_change": True}), indent=2))
