"""
predict_all.py
===============
Runs all PetroPulse AI modules and returns a unified JSON prediction.

Usage:
    python predict_all.py
    python predict_all.py --source Ahmedabad --destination Chennai
    python predict_all.py --scenario price_up_10
    python predict_all.py --price-change 15 --route-change
    python predict_all.py --module price
"""

import sys
import json
import argparse
import traceback

sys.path.insert(0, __file__.replace("predict_all.py", ""))

from utils.logger import get_logger
from utils.serialiser import NumpyEncoder

log = get_logger("predict_all")


def run_full_prediction(
    source: str = "Ahmedabad",
    destination: str = "Mumbai",
    scenario_preset: str = None,
    price_change_pct: float = 0.0,
    route_change: bool = False,
    demand_change_pct: float = 0.0,
    headlines: list = None,
) -> dict:
    """
    Runs all 6 modules and merges into one decision JSON.
    Auto-trains any missing model.
    """
    log.info("╔══════════════════════════════════════════════╗")
    log.info("║     PetroPulse AI — Full Prediction Run      ║")
    log.info("╚══════════════════════════════════════════════╝")

    outputs = {}

    # ── 1. Price Forecast ──
    try:
        log.info("[1/6] Price Forecasting...")
        from models.price.forecaster import predict as price_predict
        outputs["price_forecast"] = price_predict()
        log.info(f"      → {outputs['price_forecast']['ensemble']['trend'].upper()} "
                 f"@ ₹{outputs['price_forecast']['ensemble']['predicted_price_inr']}")
    except Exception as e:
        log.error(f"Price forecast failed: {e}")
        outputs["price_forecast"] = {"error": str(e)}

    # ── 2. News Intelligence ──
    try:
        log.info("[2/6] News Intelligence...")
        from models.news.news_intel import predict as news_predict
        outputs["news_risk"] = news_predict(headlines)
        s = outputs["news_risk"]["summary"]
        log.info(f"      → Sentiment: {s['overall_sentiment'].upper()}, "
                 f"Risk: {s['risk_level']} ({s['geopolitical_risk_score']}/100)")
    except Exception as e:
        log.error(f"News intel failed: {e}")
        outputs["news_risk"] = {"error": str(e)}

    # ── 3. Profit Impact ──
    try:
        log.info("[3/6] Profit Impact Model...")
        from models.profit.profit_model import predict as profit_predict
        outputs["profit_impact"] = profit_predict()
        log.info(f"      → Profit: ₹{outputs['profit_impact']['profit_inr']:.0f}, "
                 f"Risk: {outputs['profit_impact']['loss_risk']}")
    except Exception as e:
        log.error(f"Profit model failed: {e}")
        outputs["profit_impact"] = {"error": str(e)}

    # ── 4. Route Intelligence ──
    try:
        log.info(f"[4/6] Route Intelligence ({source} → {destination})...")
        from models.route.route_intel import predict as route_predict
        outputs["route_analysis"] = route_predict(source, destination)
        r = outputs["route_analysis"].get("best_route", {})
        log.info(f"      → Path: {' → '.join(r.get('path', [])[:4])}"
                 f"{'...' if len(r.get('path', [])) > 4 else ''}"
                 f", Cost: ₹{r.get('total_cost_inr', 0):.0f}")
    except Exception as e:
        log.error(f"Route intel failed: {e}")
        outputs["route_analysis"] = {"error": str(e)}

    # ── 5. Simulation ──
    try:
        log.info("[5/6] Monte Carlo Simulation...")
        from simulation.simulator import predict as sim_predict
        scenario = {}
        if scenario_preset:
            scenario["preset"] = scenario_preset
        if price_change_pct != 0:
            scenario["price_change_pct"] = price_change_pct
        if route_change:
            scenario["route_change"] = route_change
        if demand_change_pct != 0:
            scenario["demand_change_pct"] = demand_change_pct
        if not scenario:
            scenario = {"price_change_pct": 10.0}
        outputs["simulation"] = sim_predict(scenario)
        mc = outputs["simulation"]["monte_carlo"]
        log.info(f"      → Risk: {mc['risk_level']}, "
                 f"Loss prob: {mc['loss_probability']:.0%}, "
                 f"Median P&L: ₹{mc['profit_range']['median_inr']:.0f}")
    except Exception as e:
        log.error(f"Simulation failed: {e}")
        outputs["simulation"] = {"error": str(e)}

    # ── 6. Decision Engine ──
    try:
        log.info("[6/6] Decision Engine...")
        from decision_engine.engine import predict as decision_predict
        context = {
            "source": source,
            "destination": destination,
            "scenario": scenario if "scenario" in dir() else {},
            "headlines": headlines,
        }
        final = decision_predict(
            price_forecast=outputs.get("price_forecast"),
            news_risk=outputs.get("news_risk"),
            profit_impact=outputs.get("profit_impact"),
            route_analysis=outputs.get("route_analysis"),
            simulation=outputs.get("simulation"),
            context=context,
        )
        log.info(f"      → ACTION: {final['recommendation']['action']} "
                 f"(confidence: {final['recommendation']['confidence']:.0%})")
    except Exception as e:
        log.error(f"Decision engine failed: {e}")
        final = {**outputs, "recommendation": {"error": str(e)}}

    return final


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PetroPulse AI — Full Prediction")
    parser.add_argument("--source", default="Ahmedabad", help="Origin city")
    parser.add_argument("--destination", default="Mumbai", help="Destination city")
    parser.add_argument("--scenario", default=None,
                        help="Preset scenario name (e.g. price_up_10, geopolitical_shock)")
    parser.add_argument("--price-change", type=float, default=0.0,
                        help="Price change percentage (e.g. 15 for +15%%)")
    parser.add_argument("--route-change", action="store_true",
                        help="Flag if rerouting is required")
    parser.add_argument("--demand-change", type=float, default=0.0,
                        help="Demand change percentage")
    parser.add_argument("--module", choices=["price", "news", "profit", "route", "simulation"],
                        help="Run only a specific module")
    parser.add_argument("--output", default=None, help="Save JSON output to file path")
    args = parser.parse_args()

    if args.module:
        module_map = {
            "price": lambda: __import__("models.price.forecaster", fromlist=["predict"]).predict(),
            "news": lambda: __import__("models.news.news_intel", fromlist=["predict"]).predict(),
            "profit": lambda: __import__("models.profit.profit_model", fromlist=["predict"]).predict(),
            "route": lambda: __import__("models.route.route_intel", fromlist=["predict"]).predict(
                args.source, args.destination),
            "simulation": lambda: __import__("simulation.simulator", fromlist=["predict"]).predict(),
        }
        result = module_map[args.module]()
    else:
        result = run_full_prediction(
            source=args.source,
            destination=args.destination,
            scenario_preset=args.scenario,
            price_change_pct=args.price_change,
            route_change=args.route_change,
            demand_change_pct=args.demand_change,
        )

    output_json = json.dumps(result, indent=2, cls=NumpyEncoder)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
        log.info(f"Output saved → {args.output}")
    else:
        print("\n" + "═" * 60)
        print("PETROPULSE AI — PREDICTION OUTPUT")
        print("═" * 60)
        print(output_json)
