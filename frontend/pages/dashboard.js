// PetroPulse AI — Dashboard Page
import { predictionEngine, riskScoringEngine, recommendationEngine, marketData } from '../engines/engines.js';
import { historicalPrices }  from '../mock-data/historicalPrices.js';
import { forecastSummary }   from '../mock-data/forecasts.js';
import { getUsdInr }         from '../engines/liveRates.js';

let dashChart = null;

export function renderDashboard(state) {
  const recent   = predictionEngine.getRecent(30);
  const latest   = recent[recent.length - 1];
  const prev7    = recent[recent.length - 8];
  const signal   = predictionEngine.getSignal();
  const mom7     = predictionEngine.momentum(7);
  const risk     = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);
  const insights = recommendationEngine.getInsights(state.userTypeId, state.activeScenarioId);
  const outlook  = recommendationEngine.getWeeklyOutlook(state.userTypeId, state.activeScenarioId);
  const usdInr   = getUsdInr();

  const brentINR = Math.round(marketData.brent * usdInr / 158.987 * 1000) / 10;
  const wtiINR   = Math.round(marketData.wti   * usdInr / 158.987 * 1000) / 10;

  const brentChange = +(((marketData.brent - prev7.brent) / prev7.brent) * 100).toFixed(2);
  const brentDir    = brentChange >= 0 ? 'up' : 'down';

  /* ── KPI Strip ── */
  const usdInrSource = marketData.isLive ? 'Alpha Vantage · Live' : 'Market rate · Apr 2026';
  const usdInrSub    = `${usdInrSource}`;

  const kpis = [
    { label:'Brent Crude', value:`$${marketData.brent.toFixed(2)}`, sub:`₹${brentINR}/L`, change:brentChange, unit:'bbl', icon:'🛢️', color:'#2d5be3' },
    { label:'WTI Crude',   value:`$${marketData.wti.toFixed(2)}`, sub:`₹${wtiINR}/L`, change:+(((marketData.wti-prev7.wti)/prev7.wti)*100).toFixed(2), unit:'bbl', icon:'⛽', color:'#8b5cf6' },
    { label:'Diesel Index', value:`$${(marketData.brent * 1.28).toFixed(2)}`, sub:'Refined product', change:+((((marketData.brent * 1.28)-(recent[recent.length-8].diesel))/recent[recent.length-8].diesel)*100).toFixed(2), unit:'bbl', icon:'🚛', color:'#f59e0b' },
    { label:'Nat. Gas',     value:`$${latest.naturalGas.toFixed(2)}`, sub:'Henry Hub MMBtu', change:+(((latest.naturalGas-(recent[recent.length-8].naturalGas))/recent[recent.length-8].naturalGas)*100).toFixed(2), unit:'MMBtu', icon:'🔥', color:'#10b981' },
    { label:'USD / INR',    value:`<span data-usd-inr>₹${usdInr}</span>`, sub:usdInrSub, change:null, changeLabel: marketData.isLive ? '● Live feed' : '○ Cached rate', unit:'', icon:'💱', color:'#06b6d4' },
    { label:'Risk Score',   value:`${risk.score}`, sub:risk.label, change:null, changeLabel: `— ${risk.label}`, unit:'/ 100', icon:'🛡️', color: risk.color },
  ];

  const kpiHTML = kpis.map(k => `
    <div class="kpi-card" style="border-top: 3px solid ${k.color};">
      <div class="kpi-header">
        <span class="kpi-icon">${k.icon}</span>
        <span class="kpi-label">${k.label}</span>
      </div>
      <div class="kpi-value" style="color:${k.color}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
      ${k.change !== null ? `<div class="kpi-change ${k.change >= 0 ? 'up' : 'down'}">
        ${k.change >= 0 ? '▲' : '▼'} ${Math.abs(k.change)}% <span>7d</span>
      </div>` : `<div class="kpi-change neutral">${k.changeLabel || '—'}</div>`}
    </div>`).join('');

  /* ── Insight Cards (top 2) ── */
  const insightHTML = insights.slice(0, 2).map(ins => `
    <div class="dash-insight-card" style="border-left:4px solid ${ins.color};">
      <div class="di-header">
        <span class="di-icon">${ins.icon}</span>
        <span class="di-priority ${ins.priority}">${ins.priority.toUpperCase()}</span>
      </div>
      <div class="di-headline">${ins.headline}</div>
      <div class="di-detail">${ins.detail}</div>
      <button class="di-cta" style="background:${ins.color};" onclick="window.APP.navigate('insights')">${ins.cta} →</button>
    </div>`).join('');

  /* ── Risk Quick Card ── */
  const riskCauses = risk.topCauses.map(c => `
    <div class="risk-cause-row">
      <span>${c.icon} ${c.name}</span>
      <div class="risk-mini-bar"><div style="width:${c.score}%;background:${risk.color};height:100%;border-radius:4px;"></div></div>
      <span class="risk-cause-val">${c.score}</span>
    </div>`).join('');

  /* ── Price chart data ── */
  const chartLabels = recent.slice(-14).map(d => d.date.slice(5)); // MM-DD
  const chartBrent  = recent.slice(-14).map(d => d.brent);
  const chartWti    = recent.slice(-14).map(d => d.wti);

  /* ── Weekly outlook ── */
  const newsItems = [
    { time:'08:32', text:'OPEC+ maintains voluntary cuts through Q2 2026, supporting prices above $80.', dot:'#10b981' },
    { time:'07:15', text:`INR at ₹${usdInr}/USD — import costs elevated; RBI monitoring FX volatility.`, dot:'#f59e0b' },
    { time:'06:48', text:'Red Sea maritime risk persists — Bab-el-Mandab route under elevated threat.', dot:'#ef4444' },
    { time:'05:30', text:'China Q1 2026 GDP 5.4% — oil demand growth projections revised upward.', dot:'#2d5be3' },
    { time:'04:12', text:'US crude inventory draw of 3.2Mbbl signals robust domestic demand.', dot:'#10b981' },
    { time:'03:45', text:'India oil minister confirms plan to diversify away from Russian grade crude.', dot:'#8b5cf6' },
  ];

  const newsHTML = newsItems.map(n => `
    <div class="news-item">
      <div class="news-dot" style="background:${n.dot};"></div>
      <div>
        <div class="news-text">${n.text}</div>
        <div class="news-time">${n.time} IST</div>
      </div>
    </div>`).join('');

  return `
  <div class="page" id="page-dashboard">
    <div class="page-header">
      <div>
        <h1 class="page-title">Global Dashboard</h1>
        <p class="page-subtitle">AI-powered oil market intelligence · Last updated: ${new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})} IST</p>
      </div>
      <div class="page-actions">
        <div class="signal-badge" style="background:${signal.color}20;border:1px solid ${signal.color};color:${signal.color};">
          <span class="signal-dot" style="background:${signal.color};"></span>
          ${signal.signal} SIGNAL
        </div>
        <button class="btn btn-outline" onclick="window.APP.navigate('demoScenarios')">⚡ Load Scenario</button>
        <button class="btn btn-primary" onclick="window.APP.navigate('simulator')">Run Simulation</button>
      </div>
    </div>

    <!-- KPI Strip -->
    <div class="kpi-strip section-gap">
      ${kpiHTML}
    </div>

    <!-- Signal Banner (if active scenario) -->
    ${state.activeScenarioId ? `
    <div class="scenario-banner" style="background:${risk.color}15;border:1px solid ${risk.color}40;">
      <span class="sb-icon">⚡</span>
      <div class="sb-content">
        <strong>Active Scenario: ${scenarios_label(state.activeScenarioId)}</strong>
        <span>Market simulation running — all insights are scenario-adjusted</span>
      </div>
      <button class="btn-ghost" onclick="window.APP.clearScenario()">✕ Clear</button>
    </div>` : ''}

    <!-- Main Grid -->
    <div class="dashboard-grid">

      <!-- Price Chart -->
      <div class="card dash-chart-card">
        <div class="card-header">
          <div class="card-title">14-Day Price History</div>
          <div style="display:flex;gap:12px;font-size:0.72rem;">
            <span style="color:#2d5be3">● Brent</span>
            <span style="color:#8b5cf6">● WTI</span>
          </div>
        </div>
        <div style="height:240px;position:relative;">
          <canvas id="dash-price-chart"></canvas>
        </div>
        <div class="chart-footer">
          <span>7d momentum: <strong style="color:${brentDir==='up'?'#ef4444':'#10b981'}">${brentDir==='up'?'▲':'▼'} ${Math.abs(brentChange)}%</strong></span>
          <span>Forecast 30d: <strong style="color:#2d5be3">$${forecastSummary.priceIn30Days}</strong></span>
          <span>Confidence: <strong>${forecastSummary.confidenceAt30d}%</strong></span>
        </div>
      </div>

      <!-- AI Insights Panel -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🤖 AI Insights</div>
          <button class="btn-ghost text-xs" onclick="window.APP.navigate('insights')">View All →</button>
        </div>
        <div class="dash-insights">
          ${insightHTML}
        </div>
      </div>

      <!-- Risk Score -->
      <div class="card risk-card" style="border-top:4px solid ${risk.color};">
        <div class="card-header">
          <div class="card-title">⚡ Risk Score</div>
          <span class="risk-label-badge" style="background:${risk.color}20;color:${risk.color};">${risk.label}</span>
        </div>
        <div class="risk-gauge-row">
          <div class="risk-score-big" style="color:${risk.color};">${risk.score}</div>
          <div class="risk-gauge-bar">
            <div class="risk-gauge-fill" style="width:${risk.score}%;background:linear-gradient(90deg,#10b981,${risk.color});"></div>
          </div>
        </div>
        <div class="risk-causes">
          ${riskCauses}
        </div>
        <button class="btn btn-outline w-full mt-8" onclick="window.APP.navigate('risk')">Full Risk Report →</button>
      </div>

      <!-- Weekly Outlook -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📅 Week Outlook</div>
          <span class="card-badge badge-accent">${outlook.week}</span>
        </div>
        <div class="outlook-item">
          <div class="outlook-label">Market Bias</div>
          <div class="outlook-value">${outlook.outlook}</div>
        </div>
        <div class="outlook-item">
          <div class="outlook-label">Brent View</div>
          <div class="outlook-value">${outlook.brentView}</div>
        </div>
        <div class="outlook-item">
          <div class="outlook-label">Key Watch</div>
          <div class="outlook-value">${outlook.keyWatch}</div>
        </div>
        <div class="outlook-item">
          <div class="outlook-label">Risk Bias</div>
          <div class="outlook-value">${outlook.riskBias}</div>
        </div>
        <button class="btn btn-primary w-full mt-8" onclick="window.APP.navigate('assistant')">Ask AI Assistant →</button>
      </div>

      <!-- News Feed -->
      <div class="card news-card">
        <div class="card-header">
          <div class="card-title">📰 Market Intelligence</div>
          <span class="card-badge badge-success">Live</span>
        </div>
        <div class="news-feed">
          ${newsHTML}
        </div>
      </div>

    </div>
  </div>`;
}

function scenarios_label(id) {
  const map = {
    opec_cut:'OPEC Production Cut', middle_east_conflict:'Middle East Disruption',
    sanctions:'Sanctions on Exporter', shipping_blockage:'Shipping Route Blockage',
    demand_surge_asia:'Asia Demand Surge', rupee_depreciation:'Rupee Depreciation',
    refinery_outage:'Refinery Outage', port_congestion:'Port Congestion',
    price_crash:'Global Demand Collapse', normal_market:'Stable Market'
  };
  return map[id] || id;
}

export function initDashboard(state) {
  const canvas = document.getElementById('dash-price-chart');
  if (!canvas) return;
  if (dashChart) { dashChart.destroy(); dashChart = null; }

  const recent = predictionEngine.getRecent(14);
  const labels = recent.map(d => d.date.slice(5));
  const brent  = recent.map(d => d.brent);
  const wti    = recent.map(d => d.wti);

  dashChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Brent', data: brent,
          borderColor: '#2d5be3', backgroundColor: 'rgba(45,91,227,0.08)',
          fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: 'WTI', data: wti,
          borderColor: '#8b5cf6', backgroundColor: 'transparent',
          fill: false, tension: 0.4, pointRadius: 2, pointHoverRadius: 5,
          borderWidth: 2, borderDash: [4, 3],
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: '#1e2640', titleColor: '#fff', bodyColor: '#a8b3cc', padding: 10, cornerRadius: 8 } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 10 }, callback: v => '$' + v } },
      },
    },
  });
}
