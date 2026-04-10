"""
training/run_training.py — PetroPulse AI Standalone Training Script
====================================================================
Trains all ML models and saves artifacts to the models/ directory.
Run from the backend/ directory.

Usage:
    python training/run_training.py              # Train all models
    python training/run_training.py --cost       # Train cost model only
    python training/run_training.py --forecast   # Train forecast models only
    python training/run_training.py --route      # Build route graph only
"""

import sys
import time
import argparse
import traceback
from pathlib import Path

# Ensure backend/ is on the Python path
_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from app.utils.logger import get_logger

log = get_logger("training")


def train_cost() -> dict:
    log.info("═" * 50)
    log.info("STEP 1 — Cost Model (Ridge + RF + XGBoost)")
    log.info("═" * 50)
    from app.services.train_cost_model import train_cost_model
    return train_cost_model()


def train_forecast() -> dict:
    log.info("═" * 50)
    log.info("STEP 2 — Forecast Models (Prophet + ARIMA)")
    log.info("═" * 50)
    from app.services.train_forecast_model import train_forecast_models
    return train_forecast_models()


def build_routes() -> None:
    log.info("═" * 50)
    log.info("STEP 3 — Route Graph (NetworkX + Dijkstra)")
    log.info("═" * 50)
    from app.services.route_optimizer import train_route_graph
    train_route_graph()


def train_all() -> None:
    log.info("╔══════════════════════════════════════════════╗")
    log.info("║     PetroPulse AI — Full Training Pipeline   ║")
    log.info("╚══════════════════════════════════════════════╝")

    results = {}
    total_start = time.time()

    steps = [
        ("cost_model",  train_cost),
        ("forecast",    train_forecast),
        ("route_graph", build_routes),
    ]

    for name, fn in steps:
        start = time.time()
        try:
            fn()
            elapsed = round(time.time() - start, 1)
            results[name] = f"✅ OK ({elapsed}s)"
        except Exception as e:
            results[name] = f"❌ FAILED: {e}"
            log.error(f"\n{traceback.format_exc()}")

    total = round(time.time() - total_start, 1)

    log.info("")
    log.info("╔══════════════════════════════════════════════╗")
    log.info("║              Training Summary                ║")
    log.info("╚══════════════════════════════════════════════╝")
    for mod, status in results.items():
        log.info(f"  {mod:<14} {status}")
    log.info(f"\n  Total time : {total}s")
    log.info("")
    log.info("▶  Start the server with:")
    log.info("   cd backend")
    log.info("   uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PetroPulse AI — Model Training")
    parser.add_argument("--cost",     action="store_true", help="Train cost prediction model only")
    parser.add_argument("--forecast", action="store_true", help="Train price forecast models only")
    parser.add_argument("--route",    action="store_true", help="Build route graph only")
    args = parser.parse_args()

    if args.cost:
        train_cost()
    elif args.forecast:
        train_forecast()
    elif args.route:
        build_routes()
    else:
        train_all()
