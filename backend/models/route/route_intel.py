"""
Module 4 – Route Intelligence
================================
Graph-based routing using NetworkX with real Indian highway data.
Built from actual Truck-Route CSV (routes, distances, fuel costs).

API:    train() / predict(source, destination)
Output: best_route, cost_score, time_score, risk_adjusted_score
"""

import json
import joblib
import numpy as np
import pandas as pd
import networkx as nx
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from utils.config import SAVED_MODELS_DIR
from utils.logger import get_logger

log = get_logger(__name__)

GRAPH_PATH = SAVED_MODELS_DIR / "route_graph.pkl"
ROUTE_META_PATH = SAVED_MODELS_DIR / "route_meta.json"

# State VAT risk scores (Low VAT = lower cost risk)
STATE_RISK = {
    "GJ": 15, "MH": 35, "KA": 40, "TN": 50, "DL": 30,
    "RJ": 20, "UP": 45, "MP": 30, "AP": 55, "TS": 50,
    "OR": 25, "JH": 45, "WB": 40, "HR": 30, "PB": 20,
    "BR": 55, "HP": 10, "GA": 20,
}

# City → State code
CITY_STATE = {
    "Mumbai": "MH", "Pune": "MH", "Nashik": "MH",
    "Ahmedabad": "GJ", "Surat": "GJ", "Vadodara": "GJ",
    "Bangalore": "KA", "Mysore": "KA",
    "Chennai": "TN", "Coimbatore": "TN",
    "Delhi": "DL", "Gurgaon": "DL",
    "Jaipur": "RJ", "Jodhpur": "RJ",
    "Lucknow": "UP", "Kanpur": "UP", "Agra": "UP",
    "Bhopal": "MP", "Indore": "MP",
    "Hyderabad": "TS",
    "Vijayawada": "AP",
    "Bhubaneswar": "OR",
    "Kolkata": "WB",
    "Chandigarh": "HR",
    "Amritsar": "PB",
    "Patna": "BR",
    "Ranchi": "JH",
}


def _build_graph_from_routes() -> Tuple[nx.Graph, dict]:
    """
    Build a weighted graph from real truck route data.
    Each edge weight encodes: distance, fuel cost, and state risk.
    """
    from features.data_loader import load_truck_routes, load_state_vat

    routes_df = load_truck_routes()
    vat_df = load_state_vat().set_index("state")

    G = nx.Graph()
    route_meta = {}

    for _, row in routes_df.iterrows():
        if "-" not in str(row.get("route", "")):
            continue
        parts = str(row["route"]).split("-")
        if len(parts) != 2:
            continue
        src, dst = parts[0].strip(), parts[1].strip()

        dist = float(row["distance_km"])
        cost = float(row["actual_fuel_cost_rs"])
        state = str(row.get("state_of_refuel", "MH"))
        risk = STATE_RISK.get(state, 40)

        # Composite weight: normalised cost + distance + risk
        weight = (cost / 10000) * 0.4 + (dist / 1000) * 0.4 + (risk / 100) * 0.2
        key = f"{src}-{dst}"

        if G.has_edge(src, dst):
            # Keep minimum cost edge
            if weight < G[src][dst]["weight"]:
                G[src][dst].update({
                    "weight": round(weight, 4),
                    "distance_km": dist,
                    "cost_inr": cost,
                    "risk_score": risk,
                    "state": state,
                })
        else:
            G.add_edge(src, dst,
                       weight=round(weight, 4),
                       distance_km=dist,
                       cost_inr=cost,
                       risk_score=risk,
                       state=state)
            route_meta[key] = {
                "distance_km": dist,
                "cost_inr": cost,
                "risk": risk,
                "state": state,
            }

    # Add extra city-to-city connections from CITY_STATE
    _add_intercity_edges(G)
    log.info(f"Route graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G, route_meta


def _add_intercity_edges(G: nx.Graph) -> None:
    """Add synthetic connections between cities in same / adjacent states."""
    extra_routes = [
        ("Delhi", "Jaipur", 270, 2500, "RJ"),
        ("Delhi", "Agra", 200, 1900, "UP"),
        ("Agra", "Lucknow", 330, 3100, "UP"),
        ("Lucknow", "Patna", 490, 4600, "BR"),
        ("Mumbai", "Pune", 150, 1500, "MH"),
        ("Pune", "Hyderabad", 560, 5300, "TS"),
        ("Hyderabad", "Chennai", 620, 5900, "TN"),
        ("Chennai", "Bangalore", 350, 3300, "KA"),
        ("Bangalore", "Mumbai", 980, 9200, "MH"),
        ("Ahmedabad", "Jaipur", 680, 6400, "RJ"),
        ("Ahmedabad", "Indore", 430, 4100, "MP"),
        ("Indore", "Bhopal", 195, 1850, "MP"),
        ("Bhopal", "Delhi", 700, 6600, "UP"),
        ("Kolkata", "Bhubaneswar", 440, 4150, "OR"),
        ("Kolkata", "Patna", 530, 5000, "BR"),
        ("Chandigarh", "Delhi", 260, 2450, "HR"),
        ("Amritsar", "Chandigarh", 230, 2200, "PB"),
    ]
    for src, dst, dist, cost, state in extra_routes:
        risk = STATE_RISK.get(CITY_STATE.get(dst, "MH"), 35)
        w = (cost / 10000) * 0.4 + (dist / 1000) * 0.4 + (risk / 100) * 0.2
        if not G.has_edge(src, dst):
            G.add_edge(src, dst, weight=round(w, 4),
                       distance_km=dist, cost_inr=cost,
                       risk_score=risk, state=state)


# ──────────────────────────────────────────────
# Train
# ──────────────────────────────────────────────
def train() -> None:
    G, meta = _build_graph_from_routes()
    joblib.dump(G, GRAPH_PATH)
    with open(ROUTE_META_PATH, "w") as f:
        json.dump(meta, f, indent=2)
    log.info(f"Route graph saved → {GRAPH_PATH}")


# ──────────────────────────────────────────────
# Predict
# ──────────────────────────────────────────────
def predict(source: str = "Ahmedabad", destination: str = "Mumbai") -> dict:
    if not GRAPH_PATH.exists():
        log.info("Route graph not found, building...")
        train()

    G: nx.Graph = joblib.load(GRAPH_PATH)

    nodes = list(G.nodes())
    if source not in nodes:
        log.warning(f"'{source}' not in graph. Available: {nodes[:10]}...")
        source = nodes[0]
    if destination not in nodes:
        log.warning(f"'{destination}' not in graph. Available: {nodes[:10]}...")
        destination = nodes[1]

    try:
        # Best (lowest composite weight)
        path = nx.dijkstra_path(G, source, destination, weight="weight")
        path_weight = nx.dijkstra_path_length(G, source, destination, weight="weight")

        # Cost-only path
        cost_path = nx.dijkstra_path(G, source, destination, weight="cost_inr")
        cost_total = sum(G[u][v].get("cost_inr", 0) for u, v in zip(cost_path[:-1], cost_path[1:]))

        # Risk-only path
        risk_path = nx.dijkstra_path(G, source, destination, weight="risk_score")
        risk_total = sum(G[u][v].get("risk_score", 0) for u, v in zip(risk_path[:-1], risk_path[1:]))

        # Distance along best path
        total_dist = sum(G[u][v].get("distance_km", 0) for u, v in zip(path[:-1], path[1:]))
        total_cost = sum(G[u][v].get("cost_inr", 0) for u, v in zip(path[:-1], path[1:]))
        avg_risk = np.mean([G[u][v].get("risk_score", 0) for u, v in zip(path[:-1], path[1:])]) if len(path) > 1 else 0

        segment_details = []
        for u, v in zip(path[:-1], path[1:]):
            e = G[u][v]
            segment_details.append({
                "from": u, "to": v,
                "distance_km": e.get("distance_km", 0),
                "cost_inr": e.get("cost_inr", 0),
                "risk_score": e.get("risk_score", 0),
                "refuel_state": e.get("state", "?"),
            })

        return {
            "status": "ok",
            "source": source,
            "destination": destination,
            "best_route": {
                "path": path,
                "total_distance_km": round(total_dist, 1),
                "total_cost_inr": round(total_cost, 0),
                "composite_score": round(path_weight, 4),
                "avg_risk_score": round(float(avg_risk), 1),
                "segments": segment_details,
            },
            "alternatives": {
                "lowest_cost_path": cost_path,
                "lowest_cost_inr": round(cost_total, 0),
                "lowest_risk_path": risk_path,
                "lowest_risk_score": round(float(risk_total), 1),
            },
            "recommendation": (
                "Use best_route (balanced cost + risk). "
                f"Avoid refuelling in high-VAT states."
            ),
            "generated_at": datetime.utcnow().isoformat(),
        }

    except nx.NetworkXNoPath:
        return {
            "status": "no_path",
            "source": source,
            "destination": destination,
            "message": f"No path found between {source} and {destination}",
            "available_nodes": nodes,
        }


if __name__ == "__main__":
    train()
    import json
    print(json.dumps(predict("Ahmedabad", "Chennai"), indent=2))
