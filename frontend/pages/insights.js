// PetroPulse AI — AI Insights Page
import { recommendationEngine, predictionEngine, riskScoringEngine, marketData } from '../engines/engines.js';
import businessProfiles from '../mock-data/businessProfiles.js';
import scenarios        from '../mock-data/scenarios.js';

export function renderInsights(state) {
  const profile  = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];
  const insights = recommendationEngine.getInsights(state.userTypeId, state.activeScenarioId);
  const forecast = predictionEngine.getForecast(marketData.brent, scenarios.find(s => s.id === state.activeScenarioId));
  const risk     = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);

  /* ── User Type Selector ── */
  const userTypesHTML = businessProfiles.map(p => `
    <button class="user-type-btn ${state.userTypeId === p.id ? 'active' : ''}"
            style="${state.userTypeId === p.id ? `background:${p.color};border-color:${p.color};color:#fff;` : ''}"
            onclick="window.APP.setUserType('${p.id}')">
      <span class="utb-icon">${p.icon}</span>
      <span class="utb-label">${p.label}</span>
    </button>`).join('');

  /* ── Profile KPIs ── */
  const profileKPIs = profile.kpis.map(k => `
    <div class="profile-kpi">
      <div class="pk-icon">${k.icon}</div>
      <div class="pk-label">${k.label}</div>
      <div class="pk-value">${k.value}</div>
    </div>`).join('');

  /* ── Insight Cards ── */
  const insightCards = insights.map((ins, i) => `
    <div class="insight-card-full" style="border-left:4px solid ${ins.color}; animation-delay:${i*0.05}s">
      <div class="icf-header">
        <div class="icf-icon-wrap" style="background:${ins.color}18;">
          <span style="font-size:1.4rem;">${ins.icon}</span>
        </div>
        <div class="icf-meta">
          <span class="icf-priority-badge priority-${ins.priority}">${ins.priority.toUpperCase()}</span>
          <div class="icf-headline">${ins.headline}</div>
        </div>
      </div>
      <div class="icf-detail">${ins.detail}</div>
      <div class="icf-actions">
        <button class="icf-cta" style="background:${ins.color};" onclick="window.APP.navigate('simulator')">${ins.cta} →</button>
        <button class="icf-dismiss btn-ghost text-xs">Dismiss</button>
      </div>
    </div>`).join('');

  /* ── Price Forecast Summary ── */
  const trendColor = forecast.trend === 'bullish' ? '#ef4444' : forecast.trend === 'bearish' ? '#10b981' : '#f59e0b';

  /* ── Market Summary ── */
  const mom7  = predictionEngine.momentum(7);
  const mom30 = predictionEngine.momentum(30);
  const vol   = predictionEngine.volatility(14);

  const marketConditions = [
    { label: '7-Day Momentum',  value: `${mom7 >= 0 ? '+' : ''}${mom7}%`,  color: mom7 >= 0 ? '#ef4444' : '#10b981', icon: mom7 >= 0 ? '📈' : '📉' },
    { label: '30-Day Momentum', value: `${mom30 >= 0 ? '+' : ''}${mom30}%`, color: mom30 >= 0 ? '#ef4444' : '#10b981', icon: mom30 >= 0 ? '📈' : '📉' },
    { label: 'Price Volatility', value: `${vol}%`,  color: vol > 2.5 ? '#f59e0b' : '#10b981', icon: '〰️' },
    { label: '30d Forecast',    value: `$${forecast.day30}`,  color: '#2d5be3', icon: '🎯' },
    { label: 'Confidence',      value: `${forecast.confidence}%`, color: '#8b5cf6', icon: '🤖' },
    { label: 'Overall Risk',    value: `${risk.score}/100`,   color: risk.color, icon: '🛡️' },
  ];

  const mcHTML = marketConditions.map(m => `
    <div class="market-condition-tile">
      <span class="mct-icon">${m.icon}</span>
      <span class="mct-label">${m.label}</span>
      <span class="mct-value" style="color:${m.color};">${m.value}</span>
    </div>`).join('');

  /* ── Scenario-Specific Tip ── */
  const activeScenario = scenarios.find(s => s.id === state.activeScenarioId);
  const scenarioTip = activeScenario ? `
    <div class="scenario-tip-card" style="border:1px solid ${activeScenario.color}40;background:${activeScenario.color}08;">
      <div class="stc-header">
        <span style="font-size:1.5rem;">${activeScenario.icon}</span>
        <div>
          <div class="stc-title">Active Scenario: ${activeScenario.title}</div>
          <div class="stc-sub">${activeScenario.duration} · ${activeScenario.confidence}% confidence</div>
        </div>
        <div class="stc-severity severity-${activeScenario.severity}">${activeScenario.severity.toUpperCase()}</div>
      </div>
      <p class="stc-explanation">${activeScenario.explanation}</p>
      <div class="stc-impact-for">
        <strong>Impact for ${profile.label}:</strong> ${activeScenario.businessImpacts[profile.label] || activeScenario.recommendedAction}
      </div>
    </div>` : '';

  return `
  <div class="page" id="page-insights">
    <div class="page-header">
      <div>
        <h1 class="page-title">🤖 AI Insights</h1>
        <p class="page-subtitle">Personalised recommendations based on your business type and current market state</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" onclick="window.APP.navigate('assistant')">Ask AI Assistant</button>
        <button class="btn btn-primary" onclick="window.APP.navigate('simulator')">Run Simulation →</button>
      </div>
    </div>

    <!-- User Type Selector -->
    <div class="card mb-16">
      <div class="card-header">
        <div class="card-title">Your Business Type</div>
        <span class="card-badge badge-accent">Personalized View</span>
      </div>
      <p class="text-sm text-muted mb-12">Select your business type to get relevant, actionable insights tailored to your context.</p>
      <div class="user-type-selector">
        ${userTypesHTML}
      </div>
    </div>

    <!-- Profile KPIs -->
    <div class="card mb-16" style="border-top:3px solid ${profile.color};">
      <div class="card-header">
        <div class="card-title">${profile.icon} ${profile.label} Profile</div>
        <span class="text-xs text-muted">${profile.description}</span>
      </div>
      <div class="profile-kpi-grid">
        ${profileKPIs}
      </div>
    </div>

    <!-- Scenario Tip -->
    ${scenarioTip}

    <!-- Market Conditions Strip -->
    <div class="card mb-16">
      <div class="card-header">
        <div class="card-title">Market Conditions</div>
        <span class="card-badge badge-accent">Live</span>
      </div>
      <div class="market-conditions-grid">
        ${mcHTML}
      </div>
    </div>

    <!-- AI Insight Cards -->
    <div class="card-header mb-12 px-0">
      <div class="card-title" style="font-size:1rem;font-weight:700;">
        Actionable Recommendations
        <span class="card-badge badge-accent ml-8">${insights.length} insights</span>
      </div>
    </div>
    <div class="insights-list">
      ${insightCards || '<div class="empty-state">No critical insights at this time — market conditions are stable.</div>'}
    </div>

    <!-- Price Forecast Card -->
    <div class="forecast-strip card mt-16">
      <div class="card-title mb-12">30-Day Price Forecast</div>
      <div class="forecast-grid">
        <div class="fg-item">
          <div class="fg-label">Current</div>
          <div class="fg-value">$${forecast.current}</div>
          <div class="fg-sub">Brent USD/bbl</div>
        </div>
        <div class="fg-arrow">→</div>
        <div class="fg-item">
          <div class="fg-label">7 Days</div>
          <div class="fg-value" style="color:${trendColor}">$${forecast.day7}</div>
          <div class="fg-sub">${forecast.confidence}% confidence</div>
        </div>
        <div class="fg-arrow">→</div>
        <div class="fg-item">
          <div class="fg-label">30 Days</div>
          <div class="fg-value" style="color:${trendColor}">$${forecast.day30}</div>
          <div class="fg-sub">${(forecast.confidence * 0.85).toFixed(0)}% confidence</div>
        </div>
        <div class="fg-arrow">→</div>
        <div class="fg-item">
          <div class="fg-label">60 Days</div>
          <div class="fg-value" style="color:${trendColor}">$${forecast.day60}</div>
          <div class="fg-sub">${(forecast.confidence * 0.68).toFixed(0)}% confidence</div>
        </div>
        <div class="fg-trend" style="background:${trendColor}18;border:1px solid ${trendColor}40;color:${trendColor};">
          ${forecast.trend === 'bullish' ? '⬆ BULLISH' : forecast.trend === 'bearish' ? '⬇ BEARISH' : '↔ NEUTRAL'}
        </div>
      </div>
    </div>
  </div>`;
}
