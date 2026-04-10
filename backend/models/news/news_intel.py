"""
Module 2 – News Intelligence
==============================
NLP-based sentiment analysis + geopolitical risk scoring.
Uses keyword + rule-based approach (no external API needed).
Easily upgradable to transformer models.

API:    train() / predict(headlines: list[str])
Output: sentiment, geopolitical_risk_score (0-100), disruption_flags
"""

import re
import json
import joblib
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from utils.config import SAVED_MODELS_DIR
from utils.logger import get_logger

log = get_logger(__name__)

MODEL_PATH = SAVED_MODELS_DIR / "news_vectorizer.pkl"

# ──────────────────────────────────────────────
# Domain Lexicons (fuel / logistics / geopolitics)
# ──────────────────────────────────────────────
POSITIVE_WORDS = {
    "surplus", "stable", "peace", "ceasefire", "agreement", "supply restored",
    "production increase", "reserve release", "opec increase", "sanctions lifted",
    "pipeline repaired", "refinery online", "drop", "fell", "decline", "lower",
    "cheap", "affordable", "efficient", "smooth", "normal", "calm",
}

NEGATIVE_WORDS = {
    "shortage", "crisis", "conflict", "war", "sanctions", "strike",
    "pipeline attack", "refinery fire", "blockade", "embargo", "supply disruption",
    "price surge", "spike", "scarcity", "shortage", "halt", "shutdown",
    "opec cut", "production cut", "hurricane", "flood", "earthquake",
    "terrorism", "attack", "geopolitical tension", "trade war",
}

DISRUPTION_KEYWORDS = {
    "refinery fire": 90,
    "pipeline attack": 88,
    "war": 80,
    "sanctions": 75,
    "blockade": 70,
    "strike": 60,
    "embargo": 72,
    "opec cut": 65,
    "shortage": 55,
    "conflict": 58,
    "hurricane": 50,
    "flood": 40,
    "port closure": 60,
    "trade war": 55,
}

INDIA_KEYWORDS = [
    "india", "indian", "opec", "iran", "russia", "gulf", "middle east",
    "iocl", "bpcl", "hpcl", "oil", "diesel", "petrol", "crude",
]


# ──────────────────────────────────────────────
# Scoring Engine
# ──────────────────────────────────────────────
def _score_headline(headline: str) -> Dict:
    text = headline.lower()

    # Sentiment score (-1 to 1)
    pos = sum(1 for w in POSITIVE_WORDS if w in text)
    neg = sum(1 for w in NEGATIVE_WORDS if w in text)
    total = pos + neg
    if total == 0:
        sentiment_score = 0.0
        sentiment_label = "neutral"
    else:
        sentiment_score = round((pos - neg) / total, 3)
        if sentiment_score > 0.2:
            sentiment_label = "positive"
        elif sentiment_score < -0.2:
            sentiment_label = "negative"
        else:
            sentiment_label = "neutral"

    # Risk score (0–100)
    risk = 0
    flags = []
    for kw, weight in DISRUPTION_KEYWORDS.items():
        if kw in text:
            risk = max(risk, weight)
            flags.append(kw)

    # India/fuel relevance boost
    relevant = any(k in text for k in INDIA_KEYWORDS)
    if relevant and risk > 0:
        risk = min(100, int(risk * 1.15))

    return {
        "headline": headline,
        "sentiment": sentiment_label,
        "sentiment_score": sentiment_score,
        "risk_score": risk,
        "disruption_flags": flags,
        "india_relevant": relevant,
    }


# ──────────────────────────────────────────────
# Dummy sample headlines (for demo / training)
# ──────────────────────────────────────────────
SAMPLE_HEADLINES = [
    "OPEC+ agrees to cut production by 1 million barrels per day",
    "Russia Ukraine war escalates near Black Sea oil terminals",
    "India signs new crude oil agreement with Saudi Arabia",
    "Brent crude drops to 3-month low on recession fears",
    "Refinery fire in Gujarat disrupts regional diesel supply",
    "IOCL announces stable fuel prices for Q2 2026",
    "US sanctions on Iranian oil exports tightened",
    "Pipeline attack in Middle East causes supply disruption",
    "Monsoon floods disrupt road logistics in Bihar and UP",
    "New EV policy expected to reduce diesel demand by 2030",
    "Global oil surplus grows as demand slows in China",
    "Fuel prices expected to rise after OPEC cut decision",
]


# ──────────────────────────────────────────────
# Train (builds and saves vectorizer for sklearn)
# ──────────────────────────────────────────────
def train(headlines: List[str] = None) -> None:
    """
    Fits a TF-IDF vectorizer on sample headlines.
    (Baseline; upgrade to BERT for production)
    """
    from sklearn.feature_extraction.text import TfidfVectorizer

    headlines = headlines or SAMPLE_HEADLINES
    log.info(f"Training News NLP on {len(headlines)} headlines...")
    vec = TfidfVectorizer(max_features=500, ngram_range=(1, 2))
    vec.fit([h.lower() for h in headlines])
    joblib.dump(vec, MODEL_PATH)
    log.info(f"Vectorizer saved → {MODEL_PATH}")


# ──────────────────────────────────────────────
# Predict
# ──────────────────────────────────────────────
def predict(headlines: List[str] = None) -> dict:
    if headlines is None:
        headlines = SAMPLE_HEADLINES[:5]

    scored = [_score_headline(h) for h in headlines]

    avg_sentiment = np.mean([s["sentiment_score"] for s in scored])
    max_risk = max(s["risk_score"] for s in scored)
    avg_risk = np.mean([s["risk_score"] for s in scored])
    all_flags = list({f for s in scored for f in s["disruption_flags"]})

    # Overall label
    if avg_sentiment > 0.1:
        overall_sentiment = "positive"
    elif avg_sentiment < -0.1:
        overall_sentiment = "negative"
    else:
        overall_sentiment = "neutral"

    # Risk level
    if max_risk >= 70:
        risk_level = "HIGH"
    elif max_risk >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "status": "ok",
        "summary": {
            "overall_sentiment": overall_sentiment,
            "avg_sentiment_score": round(float(avg_sentiment), 3),
            "geopolitical_risk_score": int(round(avg_risk)),
            "max_risk_score": int(max_risk),
            "risk_level": risk_level,
            "disruption_flags": all_flags,
            "headlines_analyzed": len(headlines),
        },
        "headline_scores": scored,
        "generated_at": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    train()
    import json
    print(json.dumps(predict(), indent=2, default=str))
