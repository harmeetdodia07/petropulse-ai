// PetroPulse AI — Scenario Simulator + Profit Impact Calculator Page
import { scenarioEngine, impactCalculator, riskScoringEngine } from '../engines/engines.js';
import businessProfiles from '../mock-data/businessProfiles.js';
import scenarios        from '../mock-data/scenarios.js';
import { getUsdInr }   from '../engines/liveRates.js';

let simChart = null;

export function renderSimulator(state) {
  const profile = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];
  const def     = profile.defaultInputs;

  /* ── Scenario Cards ── */
  const scenarioCards = scenarios.map(sc => `
    <button class="scenario-chip ${state.activeScenarioId === sc.id ? 'active' : ''}"
            style="${state.activeScenarioId === sc.id ? `background:${sc.color};border-color:${sc.color};color:#fff;` : `border-color:${sc.color}50;`}"
            onclick="window.APP.setScenario('${sc.id}')">
      <span>${sc.icon}</span>
      <span class="sc-chip-title">${sc.title}</span>
      <span class="sc-chip-sev severity-${sc.severity}" style="${state.activeScenarioId === sc.id ? 'background:rgba(255,255,255,0.2);color:#fff;' : ''}">
        ${sc.severity}
      </span>
    </button>`).join('');

  /* ── User type tabs ── */
  const utTabs = businessProfiles.map(p => `
    <button class="sim-user-tab ${state.userTypeId === p.id ? 'active' : ''}"
            style="${state.userTypeId === p.id ? `background:${p.color};color:#fff;` : ''}"
            onclick="window.APP.setUserType('${p.id}')">
      ${p.icon} ${p.label}
    </button>`).join('');

  /* ── Active Scenario Info ── */
  const sc = scenarios.find(s => s.id === state.activeScenarioId);
  const scenarioInfoHTML = sc ? `
    <div class="sim-scenario-banner" style="background:${sc.color}10;border:1px solid ${sc.color}30;">
      <div class="ssb-left">
        <span style="font-size:2rem;">${sc.icon}</span>
        <div>
          <div class="ssb-title">${sc.title}</div>
          <div class="ssb-sub">${sc.summary}</div>
        </div>
      </div>
      <div class="ssb-stats">
        <div class="ssb-stat">
          <div class="ssb-stat-label">Price Impact</div>
          <div class="ssb-stat-val" style="color:${sc.color}">
            ${sc.priceDirection === 'down' ? '▼' : '▲'} ${sc.priceImpactMin}–${sc.priceImpactMax}%
          </div>
        </div>
        <div class="ssb-stat">
          <div class="ssb-stat-label">Supply Risk</div>
          <div class="ssb-stat-val" style="color:${sc.color}">${sc.supplyRisk}/100</div>
        </div>
        <div class="ssb-stat">
          <div class="ssb-stat-label">Transport Risk</div>
          <div class="ssb-stat-val" style="color:${sc.color}">${sc.transportRisk}/100</div>
        </div>
        <div class="ssb-stat">
          <div class="ssb-stat-label">Confidence</div>
          <div class="ssb-stat-val">${sc.confidence}%</div>
        </div>
      </div>
    </div>` : `
    <div class="sim-no-scenario">
      <span>⚡</span>
      <span>Select a scenario above to run a market simulation</span>
    </div>`;

  return `
  <div class="page" id="page-simulator">
    <div class="page-header">
      <div>
        <h1 class="page-title">⚡ Scenario Simulator</h1>
        <p class="page-subtitle">Model market scenarios and calculate their exact impact on your business</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" onclick="window.APP.clearScenario()">Reset</button>
        <button class="btn btn-primary" id="run-sim-btn" onclick="runSimulation()">Run Simulation →</button>
      </div>
    </div>

    <div class="sim-layout">
      <!-- LEFT: Inputs -->
      <div class="sim-inputs-col">

        <!-- User Type -->
        <div class="card mb-16">
          <div class="card-title mb-12">Step 1 — Select Business Type</div>
          <div class="sim-user-tabs">
            ${utTabs}
          </div>
        </div>

        <!-- Scenario Picker -->
        <div class="card mb-16">
          <div class="card-title mb-12">Step 2 — Choose Market Scenario</div>
          <div class="scenario-chips">
            ${scenarioCards}
          </div>
          ${scenarioInfoHTML}
        </div>

        <!-- Input Form -->
        <div class="card mb-16">
          <div class="card-title mb-16">Step 3 — Your Business Inputs</div>
          <div class="sim-form">
            <div class="form-row">
              <label class="form-label">Monthly Fuel / Oil Consumption (litres)</label>
              <input type="number" class="form-input" id="sim-consumption" value="${def.monthlyConsumption}" min="100" max="10000000" step="100">
            </div>
            <div class="form-row">
              <label class="form-label">Current Oil Price (USD/bbl)</label>
              <input type="number" class="form-input" id="sim-price" value="${def.currentPrice}" min="20" max="200" step="0.1">
            </div>
            <div class="form-row">
              <label class="form-label">Expected Price Change (%)</label>
              <div class="range-row">
                <input type="range" class="form-range" id="sim-change-range" min="-30" max="30" step="0.5" value="${def.priceChangeExpected}" oninput="document.getElementById('sim-change-val').textContent=this.value+'%'">
                <span class="range-display" id="sim-change-val">${def.priceChangeExpected}%</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">Transport Dependency (%)</label>
              <div class="range-row">
                <input type="range" class="form-range" id="sim-transport" min="0" max="100" step="1" value="${def.transportDependency}" oninput="document.getElementById('sim-transport-val').textContent=this.value+'%'">
                <span class="range-display" id="sim-transport-val">${def.transportDependency}%</span>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">Supplier Dependency - Single Source (%)</label>
              <div class="range-row">
                <input type="range" class="form-range" id="sim-supplier" min="0" max="100" step="1" value="${def.supplierDependency}" oninput="document.getElementById('sim-supplier-val').textContent=this.value+'%'">
                <span class="range-display" id="sim-supplier-val">${def.supplierDependency}%</span>
              </div>
            </div>
            <button class="btn btn-primary w-full" onclick="runSimulation()">
              🚀 Calculate Impact
            </button>
          </div>
        </div>

      </div>

      <!-- RIGHT: Outputs -->
      <div class="sim-outputs-col" id="sim-results">
        <div class="sim-empty-state">
          <div class="ses-icon">🎯</div>
          <div class="ses-title">Run a Simulation</div>
          <div class="ses-sub">Select your scenario and business inputs on the left, then click <strong>Calculate Impact</strong> to see your projected cost impact, savings opportunity, and AI recommendation.</div>
        </div>
      </div>

    </div>
  </div>`;
}

export function initSimulator(state) {
  // Auto-run if scenario already active — wait two frames so DOM is fully painted
  if (state.activeScenarioId) {
    requestAnimationFrame(() => requestAnimationFrame(() => window.runSimulation()));
  }
}

window.runSimulation = function() {
  const consumption  = parseFloat(document.getElementById('sim-consumption')?.value || 50000);
  const price        = parseFloat(document.getElementById('sim-price')?.value || 82.4);
  const changePct    = parseFloat(document.getElementById('sim-change-range')?.value || 6);
  const transportDep = parseFloat(document.getElementById('sim-transport')?.value || 80);
  const supplierDep  = parseFloat(document.getElementById('sim-supplier')?.value || 60);

  const state   = window.APP.getState();
  const profile = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];

  // Show loading pulse
  const resultsEl = document.getElementById('sim-results');
  if (resultsEl) {
    resultsEl.innerHTML = `<div class="sim-loading"><div class="loading-spinner"></div><span>AI Engine calculating impact…</span></div>`;
  }

  setTimeout(() => {
    const result = impactCalculator.calculate({
      userTypeId:         state.userTypeId,
      monthlyConsumption: consumption,
      currentPrice:       price,
      priceChangePct:     changePct,
      transportDepPct:    transportDep,
      supplierDepPct:     supplierDep,
      activeScenarioId:   state.activeScenarioId,
    });

    const out = result.outputs;
    const isRise = changePct >= 0;
    const deltaColor = isRise ? '#ef4444' : '#10b981';

    const fmt = n => Math.abs(n).toLocaleString('en-IN');
    const sign = n => n >= 0 ? '+' : '-';

    const sc = scenarios.find(s => s.id === state.activeScenarioId);

    const chartData = out.chartData;
    const chartHTML = `<div style="height:220px;position:relative;"><canvas id="sim-impact-chart"></canvas></div>`;

    const resultsHTML = `
      <div class="sim-results-wrapper">

        <!-- Result Header -->
        <div class="sim-result-header">
          <div class="srh-title">📊 Impact Analysis — ${profile.label}</div>
          <div class="srh-scenario">${sc ? `${sc.icon} ${sc.title}` : 'Custom Scenario'}</div>
        </div>

        <!-- KPI Row -->
        <div class="sim-kpi-row">
          <div class="sim-kpi" style="border-top:3px solid ${deltaColor};">
            <div class="sk-label">Monthly Cost Impact</div>
            <div class="sk-value" style="color:${deltaColor};">${sign(out.monthlyDeltaINR)}₹${fmt(out.monthlyDeltaINR)}</div>
            <div class="sk-sub">vs current spend</div>
          </div>
          <div class="sim-kpi" style="border-top:3px solid ${deltaColor};">
            <div class="sk-label">Quarterly Impact</div>
            <div class="sk-value" style="color:${deltaColor};">${sign(out.quarterlyDeltaINR)}₹${fmt(out.quarterlyDeltaINR)}</div>
            <div class="sk-sub">3-month projection</div>
          </div>
          <div class="sim-kpi" style="border-top:3px solid #10b981;">
            <div class="sk-label">Savings from Early Action</div>
            <div class="sk-value" style="color:#10b981;">₹${fmt(out.savingsFromAction)}</div>
            <div class="sk-sub">if you act this week</div>
          </div>
          <div class="sim-kpi" style="border-top:3px solid ${out.riskColor};">
            <div class="sk-label">Risk Score</div>
            <div class="sk-value" style="color:${out.riskColor};">${out.riskScore} / 100</div>
            <div class="sk-sub">${out.riskLabel} Risk</div>
          </div>
        </div>

        <!-- Price Row -->
        <div class="sim-price-row card">
          <div class="spr-item">
            <div class="spr-label">Current Price</div>
            <div class="spr-val">₹${out.priceNow.toFixed(2)}/L</div>
          </div>
          <div class="spr-arrow" style="color:${deltaColor};">${isRise ? '→📈' : '→📉'}</div>
          <div class="spr-item">
            <div class="spr-label">Projected Price</div>
            <div class="spr-val" style="color:${deltaColor};">₹${out.priceProjected.toFixed(2)}/L</div>
          </div>
          <div class="spr-divider"></div>
          <div class="spr-item">
            <div class="spr-label">Margin Effect</div>
            <div class="spr-val" style="color:${deltaColor};">${out.marginEffectPct.toFixed(2)}%</div>
          </div>
          <div class="spr-item">
            <div class="spr-label">Confidence</div>
            <div class="spr-val">${out.confidence}%</div>
          </div>
        </div>

        <!-- Chart -->
        <div class="card mb-16">
          <div class="card-title mb-12">Cost Projection (6 Months)</div>
          ${chartHTML}
          <div style="display:flex;gap:16px;font-size:0.72rem;margin-top:8px;">
            <span style="color:#2d5be3">● Base Cost</span>
            <span style="color:${deltaColor}">● Projected Cost</span>
          </div>
        </div>

        <!-- AI Recommendation -->
        <div class="ai-rec-card" style="border-left:4px solid #2d5be3;">
          <div class="arc-header">
            <span class="arc-icon">🤖</span>
            <div>
              <div class="arc-title">AI Recommendation</div>
              <div class="arc-conf">${out.confidence}% confidence · Rule-Based Engine v2.1</div>
            </div>
          </div>
          <p class="arc-text">${out.recommendedAction}</p>
          ${sc ? `<p class="arc-scenario-note"><strong>Scenario note:</strong> ${sc.businessImpacts[profile.label] || sc.recommendedAction}</p>` : ''}
          <div class="arc-actions">
            <button class="btn btn-primary" onclick="window.APP.navigate('insights')">View Full Insights</button>
            <button class="btn btn-outline" onclick="window.APP.navigate('assistant')">Ask AI Assistant</button>
          </div>
        </div>

      </div>`;

    if (resultsEl) {
      resultsEl.innerHTML = resultsHTML;
      // Safely destroy old chart before creating new one
      if (simChart) {
        try { simChart.destroy(); } catch (_) {}
        simChart = null;
      }
      const canvas = document.getElementById('sim-impact-chart');
      if (canvas && chartData.length) {
        simChart = new Chart(canvas, {
          type: 'bar',
          data: {
            labels: chartData.map(d => d.month),
            datasets: [
              { label: 'Base Cost', data: chartData.map(d => d.baseCost), backgroundColor: 'rgba(45,91,227,0.6)', borderRadius: 4 },
              { label: 'Projected Cost', data: chartData.map(d => d.newCost), backgroundColor: isRise ? 'rgba(239,68,68,0.7)' : 'rgba(16,185,129,0.7)', borderRadius: 4 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `₹${ctx.raw.toLocaleString()}` } } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
              y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9ca3af', font: { size: 10 }, callback: v => '₹' + (v >= 100000 ? (v/100000).toFixed(1) + 'L' : v.toLocaleString()) } },
            },
          },
        });
      }
    }
  }, 700);
};
