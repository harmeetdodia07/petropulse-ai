"""Global configuration for PetroPulse AI."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SAVED_MODELS_DIR = BASE_DIR / "saved_models"
SAVED_MODELS_DIR.mkdir(exist_ok=True)

# Price forecasting
PRICE_FORECAST_HORIZON = 7       # days ahead
PRICE_HISTORY_DAYS = 365

# Monte Carlo
MC_SIMULATIONS = 1000

# Route graph — Indian highway nodes (state codes)
ROUTE_NODES = [
    "MH", "GJ", "RJ", "DL", "UP", "MP", "KA", "TN",
    "AP", "TS", "OR", "JH", "WB", "HR", "PB",
]

# Fuel price baseline (₹/litre, diesel)
BASELINE_DIESEL_PRICE = 93.0
