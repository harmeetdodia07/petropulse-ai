// PetroPulse AI — Five Core AI Engines
// predictionEngine | scenarioEngine | recommendationEngine | riskScoringEngine | impactCalculator

import { historicalPrices } from '../mock-data/historicalPrices.js';
import scenarios from '../mock-data/scenarios.js';
import businessProfiles from '../mock-data/businessProfiles.js';
import { forecastSummary } from '../mock-data/forecasts.js';
import { getUsdInr } from './liveRates.js';

/* ============================================================
   0. DATA INTEGRATION
   Fetches live market prices, AI insights, and full ML pipeline
   predictions from the unified PetroPulse AI backend.
   ============================================================ */
export const marketData = {
  brent: 82.4,
  wti: 78.15,
  usdInr: 93.01,  // Updated to current market rate (Apr 2026; fetched live from Alpha Vantage)
  interestRate: null,
  isLive: false,
  lastUpdated: null,
  aiInsights: null,

  // Full ML pipeline result from /predict/enhanced
  mlPrediction: null,
  mlPredictionLoaded: false,

  async fetch() {
    try {
      const res = await fetch('/api/market-status');
      const data = await res.json();
      this.brent = data.brent;
      this.wti = data.wti;
      if (data.usd_inr) this.usdInr = data.usd_inr;
      if (data.interest_rate != null) this.interestRate = data.interest_rate;
      this.isLive = data.source !== 'fallback';
      this.lastUpdated = new Date();
      console.log('[PetroPulse] Live Market Data:', data);
      window.dispatchEvent(new CustomEvent('petropulse:data-updated', { detail: data }));
    } catch (e) {
      console.warn('[PetroPulse] Market status fetch failed:', e);
    }
  },

  async fetchAiInsights() {
    try {
      const res = await fetch('/api/business-insights');
      this.aiInsights = await res.json();
      console.log('[PetroPulse] AI Insights Loaded:', this.aiInsights);
      window.dispatchEvent(new CustomEvent('petropulse:insights-updated', { detail: this.aiInsights }));
    } catch (e) {
      console.warn('[PetroPulse] AI Insights fetch failed:', e);
    }
  },

  /**
   * Calls /predict/enhanced — the full 6-module ML pipeline enriched
   * with live market data. Results stored in this.mlPrediction.
   * @param {object} opts  Optional overrides: { source, destination, scenario }
   */
  async fetchMlPrediction(opts = {}) {
    try {
      const body = {
        source:         opts.source      || 'Ahmedabad',
        destination:    opts.destination || 'Mumbai',
        use_live_price: true,
        ...(opts.scenario ? { scenario: opts.scenario } : {}),
        ...(opts.headlines ? { headlines: opts.headlines } : {}),
      };
      const res = await fetch('/predict/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.mlPrediction = await res.json();
      this.mlPredictionLoaded = true;
      console.log('[PetroPulse] ML Pipeline Result:', this.mlPrediction);
      window.dispatchEvent(new CustomEvent('petropulse:ml-updated', { detail: this.mlPrediction }));
    } catch (e) {
      console.warn('[PetroPulse] ML prediction fetch failed:', e);
    }
  },

  /** Convenience: get the ML-recommended action or null */
  getMlAction() {
    return this.mlPrediction?.recommendation?.action || null;
  },

  /** Convenience: get blended diesel price INR or fall back to derived estimate */
  getMlDieselPrice() {
    const blended = this.mlPrediction?.price_forecast?.ensemble?.predicted_price_inr;
    if (blended) return blended;
    // Fallback: derive from live Brent if ML pipeline hasn't loaded yet
    return parseFloat(((this.brent / 158.987) * this.usdInr * 1.45).toFixed(2));
  },

  /** Convenience: get risk level from ML simulation */
  getMlRiskLevel() {
    return this.mlPrediction?.simulation?.risk_level || null;
  },
};

// ── Initial data fetch sequence ──
marketData.fetch();
marketData.fetchAiInsights();
// Fetch full ML prediction on load (non-blocking)
marketData.fetchMlPrediction();

// Poll live prices every 5 minutes; re-run ML prediction every 15 minutes
setInterval(() => marketData.fetch(), 300_000);
setInterval(() => marketData.fetchAiInsights(), 300_000);
setInterval(() => marketData.fetchMlPrediction(), 900_000);
setInterval(() => marketData.fetch(), 300000); // Poll every 5 mins

/* ============================================================
   1. PREDICTION ENGINE
   ============================================================ */
export const predictionEngine = {
  /** Return last N days of historical data */
  getRecent(days = 30) {
    return historicalPrices.slice(-days);
  },

  /** Simple moving average */
  sma(data, key, window) {
    return data.slice(-window).reduce((s, d) => s + d[key], 0) / window;
  },

  /** Price momentum: % change over window */
  momentum(days = 7) {
    const recent = historicalPrices.slice(-days - 1);
    const old = recent[0].brent;
    const cur = recent[recent.length - 1].brent;
    return +((cur - old) / old * 100).toFixed(2);
  },

  /** Volatility (std dev of daily returns) */
  volatility(days = 14) {
    const slice = historicalPrices.slice(-days);
    const returns = slice.slice(1).map((d, i) => (d.brent - slice[i].brent) / slice[i].brent);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    return +(Math.sqrt(variance) * 100).toFixed(2);
  },

  /** Get 7/30/60 day price projections.
   *  Uses ML pipeline (ARIMA + Prophet ensemble blended with live Brent)
   *  when available; falls back to momentum-based heuristics otherwise. */
  getForecast(currentBrent = marketData.brent, activeScenario = null) {
    // ── ML pipeline forecast (preferred) ──
    const ml = marketData.mlPrediction?.price_forecast;
    if (ml?.ensemble && !activeScenario) {
      const mlPrice  = ml.ensemble.predicted_price_inr;
      const mlTrend  = ml.ensemble.trend;       // 'up' | 'down'
      const mlConf   = ml.ensemble.confidence;
      const series   = ml.arima?.forecast_series || ml.prophet?.forecast_series || [];
      return {
        current:    currentBrent,
        day7:       series[6]  ? +series[6].toFixed(2)  : +(mlPrice * 1.008).toFixed(2),
        day30:      series[29] ? +series[29].toFixed(2) : +(mlPrice * 1.028).toFixed(2),
        day60:      +(mlPrice * (mlTrend === 'up' ? 1.052 : 0.962)).toFixed(2),
        trend:      mlTrend === 'up' ? 'bullish' : 'bearish',
        confidence: Math.round(mlConf * 100),
        source:     ml.ensemble.blended_with_live ? 'ml+live' : 'ml',
        dieselInr:  mlPrice,
      };
    }

    // ── Heuristic fallback ──
    let multiplier = 1.0;
    if (activeScenario) {
      const mid = (activeScenario.priceImpactMin + activeScenario.priceImpactMax) / 2;
      multiplier = 1 + mid / 100;
    }
    return {
      current:    currentBrent,
      day7:       +(currentBrent * multiplier * 1.008).toFixed(2),
      day30:      +(currentBrent * multiplier * 1.028).toFixed(2),
      day60:      +(currentBrent * multiplier * 1.052).toFixed(2),
      trend:      multiplier > 1.02 ? 'bullish' : multiplier < 0.98 ? 'bearish' : 'neutral',
      confidence: activeScenario ? activeScenario.confidence : forecastSummary.confidenceAt7d,
      source:     'heuristic',
    };
  },

  /** Get buy/sell/hold signal.
   *  Prefers ML Decision Engine action when loaded; falls back to
   *  momentum-based rules for instant rendering on first paint. */
  getSignal() {
    // ── ML Decision Engine signal (preferred) ──
    const mlAction = marketData.getMlAction();
    if (mlAction) {
      const MAP = {
        BUY_NOW:     { signal: 'BUY',  color: '#10b981', reason: `ML Decision Engine: ${marketData.mlPrediction?.recommendation?.explanation || 'Strong buy signal.'}` },
        BUY_PARTIAL: { signal: 'BUY',  color: '#34d399', reason: `ML Decision Engine: ${marketData.mlPrediction?.recommendation?.explanation || 'Partial buy recommended.'}` },
        HOLD:        { signal: 'HOLD', color: '#6366f1', reason: `ML Decision Engine: ${marketData.mlPrediction?.recommendation?.explanation || 'Market balanced.'}` },
        DELAY:       { signal: 'WAIT', color: '#f59e0b', reason: `ML Decision Engine: ${marketData.mlPrediction?.recommendation?.explanation || 'Delay procurement.'}` },
        REROUTE:     { signal: 'WAIT', color: '#f97316', reason: `ML Decision Engine: ${marketData.mlPrediction?.recommendation?.explanation || 'Reroute advised.'}` },
        HEDGE:       { signal: 'SELL', color: '#ef4444', reason: `ML Decision Engine: ${marketData.mlPrediction?.recommendation?.explanation || 'Hedge exposure.'}` },
      };
      return MAP[mlAction] || { signal: 'HOLD', color: '#6366f1', reason: 'ML analysis complete — market in equilibrium.' };
    }

    // ── Heuristic fallback (used before ML loads) ──
    const mom7  = this.momentum(7);
    const vol   = this.volatility(14);
    const curr  = marketData.brent;
    const sma30 = this.sma(historicalPrices, 'brent', 30);

    if (curr < sma30 * 0.97 && mom7 < -1) return { signal: 'BUY',  color: '#10b981', reason: 'Price below 30-day avg with downward momentum reversing' };
    if (curr > sma30 * 1.05 && mom7 > 2)  return { signal: 'SELL', color: '#ef4444', reason: 'Price significantly above 30-day avg — overbought territory' };
    if (vol > 3)                           return { signal: 'WAIT', color: '#f59e0b', reason: 'High volatility — wait for market to stabilise' };
    return { signal: 'HOLD', color: '#6366f1', reason: 'Market in equilibrium — maintain current procurement schedule' };
  },
};

/* ============================================================
   2. SCENARIO ENGINE
   ============================================================ */
export const scenarioEngine = {
  activeScenario: null,

  setScenario(scenarioId) {
    this.activeScenario = scenarios.find(s => s.id === scenarioId) || null;
    return this.activeScenario;
  },

  clearScenario() {
    this.activeScenario = null;
  },

  /** Full impact object for a scenario + user type */
  calculateImpact(scenarioId, userTypeId) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    const profile = businessProfiles.find(p => p.id === userTypeId);
    if (!scenario || !profile) return null;

    const current = marketData.brent;
    const midImpact = (scenario.priceImpactMin + scenario.priceImpactMax) / 2;
    const newPrice = current * (1 + midImpact / 100);
    const usdInr = getUsdInr();

    const monthlyVol = profile.monthlyFuelConsumption || profile.monthlyVolumeBbl || 10000;
    const monthlyCostBase = monthlyVol * current * 0.158987; // bbl to litres factor
    const monthlyCostNew = monthlyVol * newPrice * 0.158987;
    const delta = monthlyCostNew - monthlyCostBase;

    return {
      scenario,
      profile,
      currentPrice: current,
      projectedPrice: +newPrice.toFixed(2),
      priceDelta: +midImpact.toFixed(1),
      monthlyCostImpact: Math.round(delta),
      quarterlyImpact: Math.round(delta * 3),
      inrMonthlyCost: Math.round(delta * usdInr),
      riskScore: this._calcRiskScore(scenario, profile),
      recommendation: scenario.businessImpacts[profile.label] || scenario.recommendedAction,
      confidence: scenario.confidence,
      timeframe: scenario.duration,
    };
  },

  _calcRiskScore(scenario, profile) {
    const sev = { low: 20, moderate: 45, high: 70, critical: 90 }[scenario.severity] || 50;
    const supDep = profile.supplierDependencyPct || 50;
    const hedging = profile.hedgingCapabilityPct || 10;
    return Math.min(100, Math.round(sev * 0.5 + supDep * 0.3 - hedging * 0.2 + scenario.transportRisk * 0.1));
  },

  getAllScenarios() { return scenarios; },
  getScenario(id) { return scenarios.find(s => s.id === id); },
};

/* ============================================================
   3. RECOMMENDATION ENGINE
   ============================================================ */
export const recommendationEngine = {
  /** Primary actionable insights for a user type + market state */
  getInsights(userTypeId, activeScenarioId = null) {
    const profile = businessProfiles.find(p => p.id === userTypeId) || businessProfiles[1];
    const scenario = activeScenarioId ? scenarios.find(s => s.id === activeScenarioId) : null;
    const signal = predictionEngine.getSignal();
    const mom7 = predictionEngine.momentum(7);
    const current = marketData.brent;
    const usdInr = getUsdInr();

    const insights = [];

    // ── ML Pipeline Recommendation (highest priority) ──
    const mlRec = marketData.mlPrediction?.recommendation;
    if (mlRec && mlRec.action) {
      const actionColors = {
        BUY_NOW: '#10b981', BUY_PARTIAL: '#34d399', HOLD: '#6366f1',
        DELAY: '#f59e0b', REROUTE: '#f97316', HEDGE: '#ef4444',
      };
      insights.push({
        id: 'ml_decision',
        priority: 'critical',
        icon: '🧠',
        color: actionColors[mlRec.action] || '#8b5cf6',
        headline: `AI Decision Engine: ${mlRec.action.replace('_', ' ')} — ${mlRec.explanation}`,
        detail: [
          ...(mlRec.reasons || []).slice(0, 2),
          ...(mlRec.warnings || []).slice(0, 1),
        ].join(' · ') || `Confidence: ${Math.round((mlRec.confidence || 0.7) * 100)}%`,
        cta: mlRec.action === 'BUY_NOW' ? 'Execute Now' : mlRec.action === 'HEDGE' ? 'Hedge Now' : 'View Details',
        ctaColor: actionColors[mlRec.action] || '#8b5cf6',
      });
    }

    // ── ML Simulation Risk Warning ──
    const mlSim = marketData.mlPrediction?.simulation;
    if (mlSim && mlSim.risk_level && mlSim.risk_level !== 'LOW') {
      const simColors = { CRITICAL: '#dc2626', HIGH: '#ef4444', MEDIUM: '#f59e0b' };
      insights.push({
        id: 'ml_simulation',
        priority: mlSim.risk_level === 'CRITICAL' ? 'critical' : 'high',
        icon: '📊',
        color: simColors[mlSim.risk_level] || '#f59e0b',
        headline: `Monte Carlo: ${mlSim.risk_level} risk — ${Math.round((mlSim.loss_probability || 0) * 100)}% probability of loss`,
        detail: mlSim.median_profit_inr != null
          ? `Median P&L: ₹${mlSim.median_profit_inr.toLocaleString('en-IN')} | Range: ₹${(mlSim.profit_p5_inr || 0).toLocaleString('en-IN')} to ₹${(mlSim.profit_p95_inr || 0).toLocaleString('en-IN')}`
          : `Scenario: ${mlSim.scenario || 'Base'}`,
        cta: 'Run Scenario',
        ctaColor: simColors[mlSim.risk_level] || '#f59e0b',
      });
    }

    // ── AI Backend Insights ──
    if (marketData.aiInsights && marketData.aiInsights.recommendations) {
      marketData.aiInsights.recommendations.forEach((rec, idx) => {
        insights.push({
          id: `ai_insight_${idx}`,
          priority: 'high',
          icon: '🤖',
          color: '#8b5cf6',
          headline: rec,
          detail: `AI Analysis — Brent $${marketData.brent} · USD/INR ₹${usdInr} · Bias: ${marketData.aiInsights.risk_bias || 'Neutral'}`,
          cta: 'Apply Strategy',
          ctaColor: '#8b5cf6',
        });
      });
    }

    // Price momentum insight
    if (mom7 > 2) {
      const savings = Math.round(profile.defaultInputs.monthlyConsumption * current * 0.158987 * 0.06);
      insights.push({
        id: 'price_momentum',
        priority: 'high',
        icon: '📈',
        color: '#ef4444',
        headline: `Prices rising ${mom7}% this week — act before costs escalate.`,
        detail: `Buying now could save approximately $${savings.toLocaleString()} this month vs waiting 2 weeks.`,
        cta: 'Buy Now',
        ctaColor: '#ef4444',
      });
    } else if (mom7 < -2) {
      insights.push({
        id: 'price_drop',
        priority: 'medium',
        icon: '📉',
        color: '#10b981',
        headline: `Prices falling — consider delaying non-urgent procurement.`,
        detail: `Market down ${Math.abs(mom7)}% in 7 days. Wait 5–10 days for a better entry price.`,
        cta: 'Wait & Watch',
        ctaColor: '#10b981',
      });
    }

    // Supplier concentration insight
    if (profile.supplierDependencyPct > 70) {
      insights.push({
        id: 'supplier_risk',
        priority: 'high',
        icon: '⚠️',
        color: '#f59e0b',
        headline: `High supplier concentration detected (${profile.supplierDependencyPct}% from single source).`,
        detail: `Shifting 20% of procurement to an alternative supplier could reduce disruption risk by ~35% and improve negotiation leverage.`,
        cta: 'Diversify Now',
        ctaColor: '#f59e0b',
      });
    }

    // Scenario-driven insight
    if (scenario && scenario.severity !== 'low') {
      insights.push({
        id: `scenario_${scenario.id}`,
        priority: scenario.severity === 'critical' ? 'critical' : 'high',
        icon: scenario.icon,
        color: scenario.color,
        headline: `${scenario.title} — ${scenario.summary}`,
        detail: scenario.businessImpacts[profile.label] || scenario.recommendedAction,
        cta: 'View Full Impact',
        ctaColor: scenario.color,
      });
    }

    // User-type specific insights
    const specific = this._userTypeInsights(profile, current, usdInr, scenario);
    insights.push(...specific);

    // Transport insight for transport-heavy users
    if (profile.transportDependencyPct > 75 && (!scenario || scenario.transportRisk > 50)) {
      insights.push({
        id: 'transport_risk',
        priority: 'medium',
        icon: '🚚',
        color: '#8b5cf6',
        headline: 'Diesel-linked transport costs are trending higher.',
        detail: `With ${profile.transportDependencyPct}% transport dependency, a ₹5/litre diesel increase adds ~₹${Math.round((profile.monthlyFuelConsumption || 5000) * 5).toLocaleString()} to your monthly bill.`,
        cta: 'Run Impact Sim',
        ctaColor: '#8b5cf6',
      });
    }

    return insights.slice(0, 5); // Top 5
  },

  _userTypeInsights(profile, price, usdInr, scenario) {
    const insights = [];
    if (profile.id === 'importer') {
      insights.push({
        id: 'forex_hedge',
        priority: 'medium',
        icon: '💱',
        color: '#06b6d4',
        headline: `INR at ₹${usdInr}/USD — hedge USD exposure for 30–60 days.`,
        detail: 'Currency risk adds ≈5% cost volatility to your imports. Forward contracts can lock in current rates.',
        cta: 'Hedge Now',
        ctaColor: '#06b6d4',
      });
    }
    if (profile.id === 'logistics') {
      const surchargeGap = 14;
      insights.push({
        id: 'surcharge_alert',
        priority: 'medium',
        icon: '💰',
        color: '#10b981',
        headline: `Fuel surcharge adjustment due in ~${surchargeGap} days.`,
        detail: 'Review client contracts with fuel adjustment clauses. Update surcharge before the next billing cycle.',
        cta: 'Review Contracts',
        ctaColor: '#10b981',
      });
    }
    if (profile.id === 'sme') {
      insights.push({
        id: 'sme_bulk',
        priority: 'medium',
        icon: '🛒',
        color: '#f59e0b',
        headline: 'Current prices favorable for Q2 bulk purchase.',
        detail: 'Buying 2–3 months of fuel now at current rates could save ₹38,000–52,000 vs monthly spot prices.',
        cta: 'Calculate Savings',
        ctaColor: '#f59e0b',
      });
    }
    if (profile.id === 'manufacturer') {
      insights.push({
        id: 'production_cost',
        priority: 'medium',
        icon: '🏭',
        color: '#06b6d4',
        headline: 'Energy cost trend affects Q2 production margins.',
        detail: `A ${(price * 0.06).toFixed(1)}% price increase translates to ~₹${Math.round(price * 0.06 * usdInr * 100).toLocaleString()} added cost per MT. Front-load production in April.`,
        cta: 'Plan Output',
        ctaColor: '#06b6d4',
      });
    }
    return insights;
  },

  /** Weekly market outlook text */
  getWeeklyOutlook(userTypeId, activeScenarioId) {
    const scenario = activeScenarioId ? scenarios.find(s => s.id === activeScenarioId) : null;
    const mom7 = predictionEngine.momentum(7);
    const vol = predictionEngine.volatility(14);
    const trend = mom7 > 1 ? 'rising' : mom7 < -1 ? 'falling' : 'stable';

    return {
      week: `Apr 7 – 13, 2026`,
      outlook: trend === 'rising' ? 'Cautiously Bearish — buy before prices peak' : trend === 'falling' ? 'Optimistic — wait for the dip' : 'Neutral — standard procurement',
      brentView: `Brent expected ${trend === 'rising' ? 'to test $86 this week' : trend === 'falling' ? 'to find support near $80' : 'range-bound $80–85'}`,
      keyWatch: scenario ? `${scenario.title} impact on prices` : 'Fed rate decision, China PMI data',
      riskBias: vol > 2.5 ? 'High Volatility — reduce order size' : 'Low Volatility — normal operations',
    };
  },
};

/* ============================================================
   4. RISK SCORING ENGINE
   ============================================================ */
export const riskScoringEngine = {
  /** Main risk score calculation.
   *  Uses ML news + simulation risk data when loaded; falls back to heuristics. */
  calculate(activeScenarioId = null, userTypeId = 'logistics') {
    const profile = businessProfiles.find(p => p.id === userTypeId) || businessProfiles[1];
    const scenario = activeScenarioId ? scenarios.find(s => s.id === activeScenarioId) : null;
    const vol = predictionEngine.volatility(14);

    // ── Prefer ML pipeline geopolitical risk ──
    const mlNews = marketData.mlPrediction?.news_risk;
    const mlGeoRisk = mlNews?.geopolitical_risk_score ?? null;
    const mlRiskLevel = marketData.getMlRiskLevel();  // from simulation

    // Base components
    const geopoliticalRisk = mlGeoRisk !== null
      ? mlGeoRisk
      : (scenario ? { low: 15, moderate: 35, high: 65, critical: 88 }[scenario.severity] : 18);
    const priceVolatility = Math.min(100, vol * 20);
    const supplierRisk    = profile.supplierDependencyPct * 0.8;
    const transportRisk   = scenario ? scenario.transportRisk * 0.6 : profile.transportDependencyPct * 0.3;
    const hedgingMitigation = profile.hedgingCapabilityPct * 0.4;

    let rawScore = (
      geopoliticalRisk * 0.30 +
      priceVolatility  * 0.25 +
      supplierRisk     * 0.25 +
      transportRisk    * 0.20
    ) - hedgingMitigation;

    // If ML simulation says CRITICAL/HIGH, enforce a floor
    if (mlRiskLevel === 'CRITICAL') rawScore = Math.max(rawScore, 80);
    else if (mlRiskLevel === 'HIGH') rawScore = Math.max(rawScore, 60);

    const score = Math.min(100, Math.max(0, Math.round(rawScore)));

    return {
      score,
      label: this.getLabel(score),
      color: this.getColor(score),
      components: [
        { name: 'Geopolitical Risk',       value: Math.round(geopoliticalRisk), weight: '30%', color: '#ef4444', source: mlGeoRisk !== null ? 'ml' : 'heuristic' },
        { name: 'Price Volatility',        value: Math.round(priceVolatility),  weight: '25%', color: '#f59e0b' },
        { name: 'Supplier Concentration',  value: Math.round(supplierRisk),     weight: '25%', color: '#8b5cf6' },
        { name: 'Transport Exposure',      value: Math.round(transportRisk),    weight: '20%', color: '#06b6d4' },
      ],
      topCauses:      this._topCauses(geopoliticalRisk, priceVolatility, supplierRisk, transportRisk, scenario),
      recommendation: this._recommendation(score, profile, scenario),
      mlEnriched:     mlGeoRisk !== null,
    };
  },

  getLabel(score) {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Moderate';
    return 'Low';
  },

  getColor(score) {
    if (score >= 80) return '#dc2626';
    if (score >= 60) return '#ef4444';
    if (score >= 40) return '#f59e0b';
    return '#10b981';
  },

  _topCauses(geo, vol, sup, trans, scenario) {
    const causes = [
      { name: scenario ? `${scenario.title}` : 'Geopolitical environment', score: Math.round(geo), icon: '🌍' },
      { name: 'Price volatility', score: Math.round(vol), icon: '📊' },
      { name: 'Supplier concentration', score: Math.round(sup), icon: '🏭' },
      { name: 'Transport disruption risk', score: Math.round(trans), icon: '🚢' },
    ];
    return causes.sort((a, b) => b.score - a.score).slice(0, 3);
  },

  _recommendation(score, profile, scenario) {
    if (score >= 80) return `CRITICAL: Activate contingency procurement plan immediately. Contact alternative suppliers and secure 30-day emergency stockpile.`;
    if (score >= 60) return `HIGH RISK: Review supplier mix and increase buffer inventory to 3 weeks. Consider partial forward contract to hedge exposure.`;
    if (score >= 40) return `MODERATE: Monitor situation closely. Maintain current procurement schedule with slight front-loading for safety.`;
    return `LOW RISK: Market stable. Optimize for cost efficiency. No urgent action needed — good time to negotiate supplier terms.`;
  },
};

/* ============================================================
   5. IMPACT CALCULATOR
   ============================================================ */
export const impactCalculator = {
  /** Full cost impact simulation.
   *  Uses ML-blended diesel price when available for higher accuracy. */
  calculate({
    userTypeId        = 'logistics',
    monthlyConsumption = 50000,
    currentPrice      = marketData.brent,
    priceChangePct    = 6,
    transportDepPct   = 80,
    supplierDepPct    = 60,
    activeScenarioId  = null,
  } = {}) {
    const profile = businessProfiles.find(p => p.id === userTypeId) || businessProfiles[1];
    const scenario = activeScenarioId ? scenarios.find(s => s.id === activeScenarioId) : null;
    const usdInr = getUsdInr();
    const litresPerBbl = 158.987;

    // Use ML-blended diesel price (INR/litre) when available; otherwise derive from Brent
    const mlDieselInr = marketData.getMlDieselPrice();

    // Apply scenario override on price change
    let effectivePriceChange = priceChangePct;
    if (scenario) {
      const mid = (scenario.priceImpactMin + scenario.priceImpactMax) / 2;
      effectivePriceChange = Math.max(priceChangePct, mid);
    }

    const newPrice = currentPrice * (1 + effectivePriceChange / 100);
    // Prefer ML diesel price for current; derive projected from same ratio
    const pricePerLitre    = mlDieselInr || (currentPrice / litresPerBbl * usdInr);
    const newPricePerLitre = pricePerLitre * (1 + effectivePriceChange / 100);

    const monthlyBase = monthlyConsumption * pricePerLitre;
    const monthlyNew = monthlyConsumption * newPricePerLitre;
    const monthlyDelta = monthlyNew - monthlyBase;

    const quarterlyDelta = monthlyDelta * 3;
    const annualDelta = monthlyDelta * 12;

    const marginEffect = -(monthlyDelta / (profile.annualRevenue / 12) * 100);

    const savingsFromEarlyAction = Math.abs(monthlyDelta) * 0.85; // 85% of impact avoided if buying now
    const savingsINR = Math.round(savingsFromEarlyAction);

    // Risk score
    const risk = riskScoringEngine.calculate(activeScenarioId, userTypeId);

    // Recommended action
    let recommendedAction;
    if (effectivePriceChange > 0) {
      recommendedAction = `Purchase ${Math.round(monthlyConsumption * 1.5).toLocaleString()} litres immediately to lock in current price, avoiding ~₹${Math.round(savingsINR).toLocaleString()} in extra costs.`;
    } else {
      recommendedAction = `Delay procurement by 2–3 weeks to capture the falling price. Expected savings: ₹${Math.round(Math.abs(monthlyDelta) * 0.7).toLocaleString()}.`;
    }

    return {
      inputs: { userTypeId, monthlyConsumption, currentPrice, priceChangePct: effectivePriceChange, transportDepPct, supplierDepPct },
      outputs: {
        priceNow: +pricePerLitre.toFixed(2),
        priceProjected: +newPricePerLitre.toFixed(2),
        monthlyDeltaINR: Math.round(monthlyDelta),
        quarterlyDeltaINR: Math.round(quarterlyDelta),
        annualDeltaINR: Math.round(annualDelta),
        marginEffectPct: +marginEffect.toFixed(2),
        savingsFromAction: Math.round(savingsFromEarlyAction),
        riskScore: risk.score,
        riskLabel: risk.label,
        riskColor: risk.color,
        recommendedAction,
        confidence: scenario ? scenario.confidence : 78,
        chartData: this._buildChartData(monthlyConsumption, pricePerLitre, effectivePriceChange, 6),
      },
    };
  },

  _buildChartData(vol, basePrice, changePct, months) {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startMonth = new Date().getMonth();
    return Array.from({ length: months }, (_, i) => {
      const factor = 1 + (changePct / 100) * ((i + 1) / months);
      return {
        month: MONTHS[(startMonth + i) % 12],  // wraps correctly past December
        baseCost: Math.round(vol * basePrice),
        newCost: Math.round(vol * basePrice * factor),
      };
    });
  },
};

export default { predictionEngine, scenarioEngine, recommendationEngine, riskScoringEngine, impactCalculator };
