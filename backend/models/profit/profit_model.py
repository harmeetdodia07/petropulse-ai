"""
Module 3 – Profit Impact Model
================================
Models: XGBoost + Linear Regression
Uses real Truck + Route + State VAT data.

API:    train() / predict(input_dict)
Output: profit, margin_change_pct, loss_risk
"""

import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from utils.config import SAVED_MODELS_DIR
from utils.logger import get_logger

log = get_logger(__name__)

XGB_PATH = SAVED_MODELS_DIR / "xgb_profit.pkl"
LR_PATH = SAVED_MODELS_DIR / "lr_profit.pkl"
SCALER_PATH = SAVED_MODELS_DIR / "profit_scaler.pkl"
FEATURES_PATH = SAVED_MODELS_DIR / "profit_features.json"

FEATURE_COLS = [
    "distance_km",
    "fuel_consumed_litres",
    "actual_fuel_cost_rs",
    "cost_per_km",
    "mileage_actual",
    "tank_capacity_litres",
    "hard_braking_events",
    "idling_minutes",
    "speeding_events",
    "diesel_rsp",
    "vat_pct",
    "load_num",
    "risk_score",
]
TARGET_COL = "profit"


def _load_data():
    from features.data_loader import build_profit_features
    return build_profit_features()


# ──────────────────────────────────────────────
# Train
# ──────────────────────────────────────────────
def train() -> None:
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, r2_score
    from xgboost import XGBRegressor

    df = _load_data()
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available_features].values
    y = df[TARGET_COL].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_tr = scaler.fit_transform(X_train)
    X_te = scaler.transform(X_test)

    # XGBoost
    xgb = XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.05,
                        subsample=0.8, random_state=42, verbosity=0)
    xgb.fit(X_tr, y_train)
    xgb_mae = mean_absolute_error(y_test, xgb.predict(X_te))
    xgb_r2 = r2_score(y_test, xgb.predict(X_te))
    log.info(f"XGBoost → MAE: ₹{xgb_mae:.1f}, R²: {xgb_r2:.3f}")

    # Ridge Regression
    lr = Ridge(alpha=1.0)
    lr.fit(X_tr, y_train)
    lr_mae = mean_absolute_error(y_test, lr.predict(X_te))
    lr_r2 = r2_score(y_test, lr.predict(X_te))
    log.info(f"Ridge    → MAE: ₹{lr_mae:.1f}, R²: {lr_r2:.3f}")

    joblib.dump(xgb, XGB_PATH)
    joblib.dump(lr, LR_PATH)
    joblib.dump(scaler, SCALER_PATH)

    with open(FEATURES_PATH, "w") as f:
        json.dump({"features": available_features}, f)

    log.info("Profit models saved.")


# ──────────────────────────────────────────────
# Predict
# ──────────────────────────────────────────────
def predict(input_data: Optional[Dict] = None) -> dict:
    """
    input_data: dict with keys matching FEATURE_COLS.
    If None, uses median values from training data as demo.
    """
    if not XGB_PATH.exists():
        log.info("Profit model not found, training first...")
        train()

    xgb = joblib.load(XGB_PATH)
    lr = joblib.load(LR_PATH)
    scaler = joblib.load(SCALER_PATH)
    with open(FEATURES_PATH) as f:
        available_features = json.load(f)["features"]

    if input_data is None:
        # Use median from real data as demo input
        df = _load_data()
        row = df[available_features].median()
        input_data = row.to_dict()
        log.info("Using median truck-route data as demo input")

    # Build feature vector
    x = np.array([[input_data.get(f, 0.0) for f in available_features]])
    x_scaled = scaler.transform(x)

    xgb_pred = float(xgb.predict(x_scaled)[0])
    lr_pred = float(lr.predict(x_scaled)[0])
    ensemble_pred = round((xgb_pred * 0.7 + lr_pred * 0.3), 2)

    # Revenue estimate
    distance = input_data.get("distance_km", 300)
    load_num = input_data.get("load_num", 0.5)
    revenue_est = distance * 8 * (load_num + 0.3)
    margin_pct = round((ensemble_pred / revenue_est) * 100, 2) if revenue_est else 0

    # Loss risk
    if ensemble_pred < -5000:
        loss_risk = "HIGH"
    elif ensemble_pred < -2000:
        loss_risk = "MEDIUM"
    else:
        loss_risk = "LOW"

    # Margin change vs baseline
    baseline_margin = -250.0  # from training data median
    margin_change = round(margin_pct - baseline_margin, 2)

    return {
        "status": "ok",
        "profit_inr": ensemble_pred,
        "margin_pct": margin_pct,
        "margin_change_pct": margin_change,
        "loss_risk": loss_risk,
        "revenue_estimate_inr": round(revenue_est, 2),
        "model_breakdown": {
            "xgboost": round(xgb_pred, 2),
            "ridge": round(lr_pred, 2),
            "ensemble": ensemble_pred,
        },
        "input_features": {k: round(v, 3) if isinstance(v, float) else v
                           for k, v in input_data.items()},
        "generated_at": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    train()
    import json
    print(json.dumps(predict(), indent=2))
