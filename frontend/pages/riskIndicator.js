// PetroPulse AI — Risk Indicator Page
import { riskScoringEngine, predictionEngine } from '../engines/engines.js';
import businessProfiles from '../mock-data/businessProfiles.js';
import scenarios        from '../mock-data/scenarios.js';

let riskChart = null;

export function renderRisk(state) {
  const risk    = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);
  const profile = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];
  const sc      = scenarios.find(s => s.id === state.activeScenarioId);

  /* ── Gauge Arc (SVG) ── */
  const score    = risk.score;
  const arcDeg   = score * 1.8; // 0-100 → 0-180 degrees on semicircle
  const arcColor = risk.color;

  /* ── Risk Level Timeline ── */
  const riskLevels = [
    { label: 'Low',      range: '0–39',  color: '#10b981', active: score < 40 },
    { label: 'Moderate', range: '40–59', color: '#f59e0b', active: score >= 40 && score < 60 },
    { label: 'High',     range: '60–79', color: '#ef4444', active: score >= 60 && score < 80 },
    { label: 'Critical', range: '80–100',color: '#dc2626', active: score >= 80 },
  ];

  const levelsHTML = riskLevels.map(l => `
    <div class="risk-level-item ${l.active ? 'active' : ''}" style="${l.active ? `border-color:${l.color};background:${l.color}12;` : ''}">
      <div class="rli-dot" style="background:${l.color};"></div>
      <div>
        <div class="rli-label" style="${l.active ? `color:${l.color};font-weight:700;` : ''}">${l.label}</div>
        <div class="rli-range">${l.range}</div>
      </div>
      ${l.active ? `<span class="rli-you">← You</span>` : ''}
    </div>`).join('');

  /* ── Component Breakdown ── */
  const componentsHTML = risk.components.map(c => `
    <div class="risk-component">
      <div class="rc-header">
        <span class="rc-name">${c.name}</span>
        <span class="rc-val" style="color:${c.color};">${c.value} / 100</span>
        <span class="rc-weight">${c.weight}</span>
      </div>
      <div class="rc-bar-bg">
        <div class="rc-bar-fill" style="width:${c.value}%;background:${c.color}; transition: width 1s ease;"></div>
      </div>
    </div>`).join('');

  /* ── Top 3 Causes ── */
  const causesHTML = risk.topCauses.map((c, i) => `
    <div class="cause-card" style="border-left:4px solid ${i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#8b5cf6'};">
      <div class="cc-rank">#${i + 1}</div>
      <div class="cc-icon">${c.icon}</div>
      <div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-score">Contribution score: ${c.score}</div>
      </div>
      <div class="cc-bar-wrap">
        <div class="cc-bar" style="width:${c.score}%;background:${i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#8b5cf6'};"></div>
      </div>
    </div>`).join('');

  /* ── Historical Risk context ── */
  const mom7  = predictionEngine.momentum(7);
  const vol   = predictionEngine.volatility(14);

  /* ── Mitigations ── */
  const mitigations = [
    { title: 'Diversify Supplier Base',       desc: 'Reduce single-supplier dependency below 50% to significantly lower supply risk.', saving: '-18 pts', icon: '🏭' },
    { title: 'Forward Contract Hedging',       desc: 'Lock in prices for 30–60 days to reduce price volatility exposure by up to 60%.', saving: '-12 pts', icon: '🛡️' },
    { title: 'Increase Buffer Inventory',      desc: 'Maintaining 21-day inventory buffer reduces operational disruption risk sharply.', saving: '-10 pts', icon: '📦' },
    { title: 'Alternative Route Planning',     desc: 'Pre-arrange alternative shipping routes to counter transport disruption risk.', saving: '-8 pts',  icon: '🚢' },
  ];

  const mitigationsHTML = mitigations.map(m => `
    <div class="mitigation-card">
      <div class="mc-icon">${m.icon}</div>
      <div class="mc-content">
        <div class="mc-title">${m.title}</div>
        <div class="mc-desc">${m.desc}</div>
      </div>
      <div class="mc-saving">${m.saving}</div>
    </div>`).join('');

  return `
  <div class="page" id="page-risk">
    <div class="page-header">
      <div>
        <h1 class="page-title">⚡ Risk Indicator</h1>
        <p class="page-subtitle">Composite risk assessment for ${profile.label} · ${new Date().toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" onclick="window.APP.navigate('simulator')">Run Simulation</button>
        <button class="btn btn-primary" onclick="window.APP.navigate('assistant')">Get AI Advice →</button>
      </div>
    </div>

    <div class="risk-grid">

      <!-- MAIN SCORE CARD -->
      <div class="risk-score-card" style="border:2px solid ${arcColor}30;">
        <div class="rsc-label">Overall Risk Score</div>
        
        <!-- SVG Gauge -->
        <div class="gauge-wrapper">
          <svg viewBox="0 0 200 110" class="gauge-svg">
            <!-- Background arc -->
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#eef2f7" stroke-width="14" stroke-linecap="round"/>
            
            <!-- Precise threshold zones -->
            <!-- 0-40 Low (Green) -->
            <path d="M 20 100 A 80 80 0 0 1 75.3 23.9" fill="none" stroke="#10b981" stroke-width="14" stroke-linecap="round" opacity="0.2"/>
            <!-- 40-60 Moderate (Yellow) -->
            <path d="M 75.3 23.9 A 80 80 0 0 1 124.7 23.9" fill="none" stroke="#f59e0b" stroke-width="14" stroke-linecap="round" opacity="0.2"/>
            <!-- 60-80 High (Red) -->
            <path d="M 124.7 23.9 A 80 80 0 0 1 164.7 53.0" fill="none" stroke="#ef4444" stroke-width="14" stroke-linecap="round" opacity="0.2"/>
            <!-- 80-100 Critical (Dark Red) -->
            <path d="M 164.7 53.0 A 80 80 0 0 1 180 100" fill="none" stroke="#dc2626" stroke-width="14" stroke-linecap="round" opacity="0.2"/>

            <!-- Score arc (dynamic) -->
            <path id="gauge-fill-arc" d="M 20 100 A 80 80 0 0 1 ${gaugePoint(score)}" fill="none" stroke="${arcColor}" stroke-width="14" stroke-linecap="round"/>
            
            <!-- Needle -->
            <line x1="100" y1="100" x2="${needleEnd(score).x}" y2="${needleEnd(score).y}" stroke="${arcColor}" stroke-width="3" stroke-linecap="round"/>
            <circle cx="100" cy="100" r="5" fill="${arcColor}"/>
            
            <!-- Score text centered in arc -->
            <text x="100" y="72" text-anchor="middle" dominant-baseline="middle" font-size="34" font-weight="900" fill="${arcColor}" font-family="var(--font-mono), monospace">${score}</text>
            <text x="100" y="90" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="700" fill="#94a3b8" font-family="var(--font-sans), sans-serif" style="text-transform: uppercase; letter-spacing: 0.1em;">OUT OF 100</text>
          </svg>
          <div class="gauge-label" style="color:${arcColor}; font-size: 1.15rem; font-weight: 800; margin-top: -8px;">${risk.label} Risk</div>
        </div>

        <!-- Risk Levels -->
        <div class="risk-levels-grid">
          ${levelsHTML}
        </div>

        <!-- Scenario indicator -->
        ${sc ? `<div class="active-scenario-tag" style="background:${sc.color}18;border:1px solid ${sc.color}40;color:${sc.color};">
          ${sc.icon} Active: ${sc.title}
        </div>` : ''}
      </div>

      <!-- TOP CAUSES -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔍 Top Risk Drivers</div>
        </div>
        <div class="causes-list">
          ${causesHTML}
        </div>
        <div class="rec-box" style="background:${arcColor}08;border:1px solid ${arcColor}30;border-radius:8px;padding:14px;margin-top:16px;">
          <div style="font-size:0.78rem;font-weight:700;color:${arcColor};margin-bottom:6px;">🤖 AI Recommendation</div>
          <p style="font-size:0.8rem;color:var(--text-secondary);line-height:1.55;">${risk.recommendation}</p>
        </div>
      </div>

      <!-- COMPONENTS BREAKDOWN -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Risk Breakdown</div>
          <span class="card-badge badge-accent">Weighted Score</span>
        </div>
        <div class="risk-components">
          ${componentsHTML}
        </div>
        <div class="risk-chart-container" style="height:200px;margin-top:20px;">
          <canvas id="risk-radar-chart"></canvas>
        </div>
      </div>

      <!-- MITIGATIONS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🛡️ Risk Mitigation Actions</div>
          <span class="card-badge badge-success">Reduce Risk</span>
        </div>
        <div class="mitigations-list">
          ${mitigationsHTML}
        </div>
      </div>

    </div>
  </div>`;
}

/* Helper: calculate point on gauge arc for score (Left-to-Right Top Arc) */
function gaugePoint(score) {
  const theta = Math.PI + (Math.min(100, Math.max(0, score)) / 100) * Math.PI;
  const x = 100 + 80 * Math.cos(theta);
  const y = 100 + 80 * Math.sin(theta);
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
}

function needleEnd(score) {
  const theta = Math.PI + (Math.min(100, Math.max(0, score)) / 100) * Math.PI;
  return {
    x: +(100 + 60 * Math.cos(theta)).toFixed(1),
    y: +(100 + 60 * Math.sin(theta)).toFixed(1),
  };
}

export function initRisk(state) {
  const risk    = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);
  const canvas  = document.getElementById('risk-radar-chart');
  if (!canvas) return;
  if (riskChart) { riskChart.destroy(); riskChart = null; }

  riskChart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: risk.components.map(c => c.name.split(' ').slice(0, 2).join(' ')),
      datasets: [{
        label: 'Risk Score',
        data: risk.components.map(c => c.value),
        backgroundColor: `${risk.color}20`,
        borderColor: risk.color,
        borderWidth: 2,
        pointBackgroundColor: risk.color,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 25, color: '#9ca3af', font: { size: 9 }, backdropColor: 'transparent' },
          grid:        { color: 'rgba(0,0,0,0.07)' },
          pointLabels: { color: '#6b7280', font: { size: 10 } },
        },
      },
    },
  });
}
