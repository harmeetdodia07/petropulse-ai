"""
Module 1 – Price Forecasting
=============================
Models: ARIMA (statsmodels) + Prophet (baseline)
API:    train() / predict()
Output: predicted_price, trend, confidence, forecast_series
"""

import warnings
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

warnings.filterwarnings("ignore")

from utils.config import SAVED_MODELS_DIR, PRICE_FORECAST_HORIZON
from utils.logger import get_logger

log = get_logger(__name__)

ARIMA_PATH = SAVED_MODELS_DIR / "arima_price.pkl"
PROPHET_PATH = SAVED_MODELS_DIR / "prophet_price.pkl"


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def _get_price_series() -> pd.DataFrame:
    """Import here to avoid circular import."""
    from features.data_loader import build_fuel_price_series
    return build_fuel_price_series()


# ──────────────────────────────────────────────
# ARIMA
# ──────────────────────────────────────────────
def train_arima(df: pd.DataFrame = None) -> None:
    from statsmodels.tsa.arima.model import ARIMA

    df = df or _get_price_series()
    series = df["y"].values
    log.info("Training ARIMA(5,1,0)...")
    model = ARIMA(series, order=(5, 1, 0))
    result = model.fit()
    joblib.dump(result, ARIMA_PATH)
    log.info(f"ARIMA saved → {ARIMA_PATH}")


def predict_arima(horizon: int = PRICE_FORECAST_HORIZON) -> dict:
    if not ARIMA_PATH.exists():
        log.info("ARIMA model not found, training first...")
        train_arima()
    result = joblib.load(ARIMA_PATH)
    fc = result.forecast(steps=horizon)
    last = float(result.fittedvalues[-1])
    fc_arr = fc.values if hasattr(fc, "values") else fc
    pred = float(fc_arr[-1])
    trend = "up" if pred > last else "down"
    confidence = max(0.50, 1.0 - abs(pred - last) / last)
    fc_list = fc_arr.tolist() if hasattr(fc_arr, "tolist") else list(fc_arr)
    return {
        "model": "ARIMA",
        "predicted_price": round(pred, 2),
        "trend": trend,
        "confidence": round(confidence, 3),
        "forecast_series": [round(v, 2) for v in fc_list],
        "horizon_days": horizon,
    }


# ──────────────────────────────────────────────
# Prophet
# ──────────────────────────────────────────────
def train_prophet(df: pd.DataFrame = None) -> None:
    from prophet import Prophet

    df = df or _get_price_series()
    log.info("Training Prophet...")
    m = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        changepoint_prior_scale=0.05,
    )
    m.fit(df[["ds", "y"]])
    joblib.dump(m, PROPHET_PATH)
    log.info(f"Prophet saved → {PROPHET_PATH}")


def predict_prophet(horizon: int = PRICE_FORECAST_HORIZON) -> dict:
    if not PROPHET_PATH.exists():
        log.info("Prophet model not found, training first...")
        train_prophet()
    m = joblib.load(PROPHET_PATH)
    future = m.make_future_dataframe(periods=horizon)
    forecast = m.predict(future)
    tail = forecast.tail(horizon)
    pred = float(tail["yhat"].iloc[-1])
    lower = float(tail["yhat_lower"].iloc[-1])
    upper = float(tail["yhat_upper"].iloc[-1])
    last_known = float(forecast["yhat"].iloc[-(horizon + 1)])
    trend = "up" if pred > last_known else "down"
    confidence_range = upper - lower
    confidence = max(0.5, 1.0 - confidence_range / (pred + 1e-9))
    return {
        "model": "Prophet",
        "predicted_price": round(pred, 2),
        "lower_bound": round(lower, 2),
        "upper_bound": round(upper, 2),
        "trend": trend,
        "confidence": round(confidence, 3),
        "forecast_series": [round(v, 2) for v in tail["yhat"].tolist()],
        "horizon_days": horizon,
    }


# ──────────────────────────────────────────────
# Unified API
# ──────────────────────────────────────────────
def train(df: pd.DataFrame = None) -> None:
    """Train both ARIMA and Prophet."""
    train_arima(df)
    train_prophet(df)
    log.info("Price forecasting models trained.")


def predict(horizon: int = PRICE_FORECAST_HORIZON) -> dict:
    """
    Returns ensemble price forecast.
    """
    try:
        arima = predict_arima(horizon)
    except Exception as e:
        log.warning(f"ARIMA predict failed: {e}")
        arima = None

    try:
        prophet = predict_prophet(horizon)
    except Exception as e:
        log.warning(f"Prophet predict failed: {e}")
        prophet = None

    # Ensemble: average available predictions
    preds = [m["predicted_price"] for m in [arima, prophet] if m]
    trends = [m["trend"] for m in [arima, prophet] if m]
    confs = [m["confidence"] for m in [arima, prophet] if m]

    ensemble_price = round(np.mean(preds), 2) if preds else 93.0
    ensemble_trend = "up" if trends.count("up") >= len(trends) / 2 else "down"
    ensemble_conf = round(np.mean(confs), 3) if confs else 0.5

    return {
        "status": "ok",
        "ensemble": {
            "predicted_price_inr": ensemble_price,
            "trend": ensemble_trend,
            "confidence": ensemble_conf,
            "horizon_days": horizon,
        },
        "arima": arima,
        "prophet": prophet,
        "generated_at": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    train()
    import json
    print(json.dumps(predict(), indent=2))
