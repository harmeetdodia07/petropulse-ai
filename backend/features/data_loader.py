"""
Features / Data Loading
=======================
Loads and cleans the three real datasets:
  - state_vat.csv      : State-wise diesel RSP + VAT
  - truck_data.csv     : Truck specs + telemetry
  - truck_route.csv    : Route history + fuel cost
Also builds synthetic fuel-price time-series for forecasting.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from utils.config import DATA_DIR
from utils.logger import get_logger

log = get_logger(__name__)


# ─────────────────────────────────────────────
# 1. State VAT / Diesel price table
# ─────────────────────────────────────────────
def load_state_vat() -> pd.DataFrame:
    path = DATA_DIR / "state_vat.csv"
    df = pd.read_csv(path, sep="\t", usecols=range(5))
    df.columns = ["state", "diesel_rsp", "vat_rate", "category", "refuel_strategy"]
    df["vat_pct"] = df["vat_rate"].str.replace("%", "").astype(float)
    df = df.dropna(subset=["state", "diesel_rsp"])
    log.info(f"Loaded state_vat: {len(df)} rows")
    return df


# ─────────────────────────────────────────────
# 2. Truck data
# ─────────────────────────────────────────────
def load_truck_data() -> pd.DataFrame:
    path = DATA_DIR / "truck_data.csv"
    df = pd.read_csv(path, sep="\t")
    df["last_service_date"] = pd.to_datetime(df["last_service_date"], dayfirst=True, errors="coerce")
    df["parts_replaced"] = df["parts_replaced"].fillna("None")
    log.info(f"Loaded truck_data: {len(df)} rows")
    return df


# ─────────────────────────────────────────────
# 3. Truck routes
# ─────────────────────────────────────────────
def load_truck_routes() -> pd.DataFrame:
    path = DATA_DIR / "truck_route.csv"
    df = pd.read_csv(path, sep="\t")
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df["cost_per_km"] = df["actual_fuel_cost_rs"] / df["distance_km"].replace(0, np.nan)
    df["mileage_actual"] = df["distance_km"] / df["fuel_consumed_litres"].replace(0, np.nan)
    log.info(f"Loaded truck_routes: {len(df)} rows")
    return df


# ─────────────────────────────────────────────
# 4. Synthetic fuel price time-series
#    (ARIMA / Prophet training data)
# ─────────────────────────────────────────────
def build_fuel_price_series(n_days: int = 500, seed: int = 42) -> pd.DataFrame:
    """
    Generates a realistic synthetic diesel price series anchored to
    actual Indian state averages from state_vat data.
    """
    rng = np.random.default_rng(seed)
    vat_df = load_state_vat()
    base_price = float(vat_df["diesel_rsp"].median())  # ~₹97/litre nationally

    dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=n_days, freq="D")
    # Random-walk with mean reversion
    returns = rng.normal(0, 0.003, n_days)
    prices = [base_price]
    for r in returns[1:]:
        mean_rev = 0.02 * (base_price - prices[-1])
        prices.append(max(70, prices[-1] * (1 + r) + mean_rev))

    df = pd.DataFrame({"ds": dates, "y": prices})
    log.info(f"Built synthetic price series: {len(df)} rows, mean ₹{np.mean(prices):.2f}")
    return df


# ─────────────────────────────────────────────
# 5. Feature engineering for profit model
# ─────────────────────────────────────────────
def build_profit_features() -> pd.DataFrame:
    """Join routes + truck data + state VAT to build feature matrix."""
    routes = load_truck_routes()
    trucks = load_truck_data()
    vat = load_state_vat()[["state", "diesel_rsp", "vat_pct", "category"]]

    # State code → state name mapping (partial, covers common refuel states)
    STATE_MAP = {
        "GJ": "Gujarat", "MH": "Maharashtra", "KA": "Karnataka",
        "TN": "Tamil Nadu", "DL": "Delhi", "RJ": "Rajasthan",
        "UP": "Uttar Pradesh", "MP": "Madhya Pradesh", "AP": "Andhra Pradesh",
        "TS": "Telangana", "OR": "Odisha", "JH": "Jharkhand",
        "WB": "West Bengal", "HR": "Haryana", "PB": "Punjab",
        "BR": "Bihar", "HP": "Himachal Pradesh", "GA": "Goa",
    }
    routes["state_name"] = routes["state_of_refuel"].map(STATE_MAP)
    df = routes.merge(trucks[["truck_id", "engine_type", "tank_capacity_litres",
                               "hard_braking_events", "idling_minutes", "speeding_events"]],
                      on="truck_id", how="left")
    df = df.merge(vat.rename(columns={"state": "state_name"}), on="state_name", how="left")

    # Derived features
    df["load_num"] = df["load_status"].map({"Full": 1.0, "Half": 0.5, "Empty": 0.0}).fillna(0.5)
    df["efficiency_score"] = df["mileage_actual"] / df["distance_km"].replace(0, np.nan)
    df["risk_score"] = (df["hard_braking_events"].fillna(0) * 2 +
                        df["speeding_events"].fillna(0) * 1.5 +
                        df["idling_minutes"].fillna(0) * 0.1)

    # Target: profit proxy = revenue estimate – actual cost
    # Revenue = ₹8/km/tonne * distance * load multiplier (simplified)
    df["revenue_est"] = df["distance_km"] * 8 * (df["load_num"] + 0.3)
    df["profit"] = df["revenue_est"] - df["actual_fuel_cost_rs"]
    df["margin_pct"] = (df["profit"] / df["revenue_est"].replace(0, np.nan)) * 100

    drop_cols = ["date", "route", "fuel_type", "fuel_card_id",
                 "state_of_refuel", "state_name", "load_status", "refuel_strategy"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")
    df = df.select_dtypes(include=[np.number]).dropna()
    log.info(f"Built profit features: {df.shape}")
    return df


if __name__ == "__main__":
    print(load_state_vat().head())
    print(load_truck_routes().head())
    print(build_profit_features().describe())
