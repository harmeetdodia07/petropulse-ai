"""
train_all.py
=============
Trains all PetroPulse AI models in the correct order.

Usage:
    python train_all.py
    python train_all.py --module price
    python train_all.py --module profit
"""

import sys
import time
import argparse
import traceback

# Ensure project root is on path
sys.path.insert(0, __file__.replace("train_all.py", ""))

from utils.logger import get_logger

log = get_logger("train_all")


def train_price():
    log.info("═" * 50)
    log.info("MODULE 1 — Price Forecasting (ARIMA + Prophet)")
    log.info("═" * 50)
    from models.price.forecaster import train
    train()


def train_news():
    log.info("═" * 50)
    log.info("MODULE 2 — News Intelligence (TF-IDF NLP)")
    log.info("═" * 50)
    from models.news.news_intel import train
    train()


def train_profit():
    log.info("═" * 50)
    log.info("MODULE 3 — Profit Impact (XGBoost + Ridge)")
    log.info("═" * 50)
    from models.profit.profit_model import train
    train()


def train_route():
    log.info("═" * 50)
    log.info("MODULE 4 — Route Intelligence (NetworkX Graph)")
    log.info("═" * 50)
    from models.route.route_intel import train
    train()


def train_simulation():
    log.info("═" * 50)
    log.info("MODULE 5 — Simulation Engine (Monte Carlo)")
    log.info("═" * 50)
    from simulation.simulator import train
    train()


def train_decision():
    log.info("═" * 50)
    log.info("MODULE 6 — Decision Engine (Rule-based)")
    log.info("═" * 50)
    from decision_engine.engine import train
    train()


MODULE_MAP = {
    "price": train_price,
    "news": train_news,
    "profit": train_profit,
    "route": train_route,
    "simulation": train_simulation,
    "decision": train_decision,
}


def train_all():
    log.info("╔══════════════════════════════════════════════╗")
    log.info("║      PetroPulse AI — Training Pipeline       ║")
    log.info("╚══════════════════════════════════════════════╝")

    results = {}
    total_start = time.time()

    for name, fn in MODULE_MAP.items():
        start = time.time()
        try:
            fn()
            elapsed = round(time.time() - start, 1)
            results[name] = f"✅ OK ({elapsed}s)"
        except Exception as e:
            results[name] = f"❌ FAILED: {e}"
            log.error(f"Module '{name}' failed:\n{traceback.format_exc()}")

    total = round(time.time() - total_start, 1)
    log.info("")
    log.info("╔══════════════════════════════════════════════╗")
    log.info("║              Training Summary                ║")
    log.info("╚══════════════════════════════════════════════╝")
    for mod, status in results.items():
        log.info(f"  {mod:<12} {status}")
    log.info(f"\n  Total time: {total}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PetroPulse AI — Train models")
    parser.add_argument("--module", choices=list(MODULE_MAP.keys()),
                        help="Train only a specific module")
    args = parser.parse_args()

    if args.module:
        MODULE_MAP[args.module]()
    else:
        train_all()
