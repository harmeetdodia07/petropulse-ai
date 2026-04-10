// PetroPulse AI — Demo Scenarios Page
// Clickable presets that update the whole dashboard
import scenarios        from '../mock-data/scenarios.js';
import businessProfiles from '../mock-data/businessProfiles.js';

/* Demo preset definitions */
const demoPresets = [
  {
    id: 'demo_opec_spike',
    title: 'Oil Prices Rise 10% Next Month',
    description: 'OPEC+ extends cuts and Saudi Arabia announces surprise 500k bbl/day additional reduction.',
    emoji: '🚀',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    scenarioId: 'opec_cut',
    userTypeId: 'logistics',
    tags: ['OPEC+', 'Supply', 'Price Spike'],
    impacts: [
      { label: 'Brent Price', change: '+$8.2', direction: 'up' },
      { label: 'Diesel Cost', change: '+12%', direction: 'up' },
      { label: 'Risk Score', change: '71/100', direction: 'warn' },
    ],
    aiMessage: 'Prices are rising fast. Lock in fuel procurement now for the next 60 days to avoid an estimated ₹12–18 lakh in additional costs for a mid-sized logistics operation.',
  },
  {
    id: 'demo_gulf_shipping',
    title: 'Shipping Delay from Gulf Region',
    description: 'Houthi attacks intensify. 40% of tankers reroute via Cape of Good Hope, adding 14 days.',
    emoji: '🚢',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    scenarioId: 'shipping_blockage',
    userTypeId: 'importer',
    tags: ['Shipping', 'Red Sea', 'Delays'],
    impacts: [
      { label: 'Delivery Time', change: '+14 days', direction: 'up' },
      { label: 'Freight Cost', change: '+$3.8/bbl', direction: 'up' },
      { label: 'Supply Risk', change: '91/100', direction: 'warn' },
    ],
    aiMessage: 'Immediate action required: Contact alternative suppliers closer to market. Build 21-day buffer inventory to cover extended delivery window. Insurance premiums up 280%.',
  },
  {
    id: 'demo_india_supplier_cut',
    title: 'India Cuts One Supplier by 20%',
    description: 'India reduces Russian crude imports by 20% due to G7 pressure, reallocating to Middle East.',
    emoji: '🇮🇳',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    scenarioId: 'sanctions',
    userTypeId: 'importer',
    tags: ['India', 'Sanctions', 'Strategy'],
    impacts: [
      { label: 'Cost per bbl', change: '+$4.2', direction: 'up' },
      { label: 'Import Cost', change: '+₹35 Cr/mo', direction: 'up' },
      { label: 'Supply Diversity', change: 'Improved', direction: 'good' },
    ],
    aiMessage: 'Reallocation to Middle East grades adds $4–6/bbl. Budget impact for a 250,000 bbl/month importer: +₹30–42 Cr/month. Recommend securing forward contracts with Saudi Aramco immediately.',
  },
  {
    id: 'demo_rupee_shock',
    title: 'Rupee Weakens Sharply to ₹88/USD',
    description: 'RBI reserves fall and trade deficit widens. INR hits ₹88/USD — a 5% depreciation.',
    emoji: '₹',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    scenarioId: 'rupee_depreciation',
    userTypeId: 'manufacturer',
    tags: ['Currency', 'INR', 'Import Cost'],
    impacts: [
      { label: 'Import Cost', change: '+5% in INR', direction: 'up' },
      { label: 'Production Cost', change: '+₹8.4L/mo', direction: 'up' },
      { label: 'Margin Effect', change: '-1.8%', direction: 'down' },
    ],
    aiMessage: 'Every rupee depreciation against USD adds ~₹50/MT to crude oil import costs for Indian refiners. At ₹88/USD, manufacturers face a ₹6,200–8,400 additional cost per metric ton. Hedge USD exposure now.',
  },
  {
    id: 'demo_mfg_fuel_spike',
    title: 'Manufacturing Fuel Costs Spike 15%',
    description: 'Refinery outage in India combined with monsoon shutdowns causes diesel to spike ₹14/litre.',
    emoji: '🏭',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    scenarioId: 'refinery_outage',
    userTypeId: 'manufacturer',
    tags: ['Manufacturing', 'Diesel', 'Refinery'],
    impacts: [
      { label: 'Diesel Price', change: '+₹14/L', direction: 'up' },
      { label: 'Energy Cost', change: '+₹18L/mo', direction: 'up' },
      { label: 'Profit Margin', change: '-2.4%', direction: 'down' },
    ],
    aiMessage: 'For a manufacturer consuming 35,000 litres/month, a ₹14/litre spike means +₹4.9 lakh/month in energy costs. Front-load production in April. Review energy efficiency measures. Negotiate with your fuel supplier for a price cap agreement.',
  },
  {
    id: 'demo_market_crash',
    title: 'Global Recession — Oil Prices Drop 20%',
    description: 'US enters recession, China growth collapses to 2.1%. Brent falls to $66/bbl.',
    emoji: '📉',
    gradient: 'linear-gradient(135deg, #64748b, #475569)',
    scenarioId: 'price_crash',
    userTypeId: 'sme',
    tags: ['Recession', 'Price Drop', 'Opportunity'],
    impacts: [
      { label: 'Brent Price', change: '-$16/bbl', direction: 'good' },
      { label: 'Diesel Cost', change: '-₹12/L', direction: 'good' },
      { label: 'Risk Score', change: '28/100', direction: 'good' },
    ],
    aiMessage: 'Rare buying opportunity. At $66/bbl, diesel at pumps could fall to ₹82–86/litre. SME buyers should maximize purchases now and negotiate 6-month forward contracts at these deflated rates. Lock in before global recovery.',
  },
  {
    id: 'demo_middle_east_war',
    title: 'Middle East Conflict Escalates',
    description: 'Iran-Israel conflict leads to Strait of Hormuz partial closure. 21% of global oil at risk.',
    emoji: '⚠️',
    gradient: 'linear-gradient(135deg, #dc2626, #991b1b)',
    scenarioId: 'middle_east_conflict',
    userTypeId: 'importer',
    tags: ['Geopolitics', 'Critical', 'Hormuz'],
    impacts: [
      { label: 'Brent Spike', change: '+$18/bbl', direction: 'up' },
      { label: 'Supply Risk', change: '94/100', direction: 'warn' },
      { label: 'Transport Cost', change: '+280%', direction: 'up' },
    ],
    aiMessage: 'CRITICAL: This is the highest-impact scenario for oil markets. Activate emergency procurement plan immediately. Diversify to US, West African, and Norwegian suppliers. Maintain 45-day strategic reserve. Consult with your supply chain insurer.',
  },
  {
    id: 'demo_asia_demand',
    title: 'Asia Demand Surge — China Recovers',
    description: 'China Q2 GDP at 6.8%. Massive industrial restart creates 2Mbbl/day demand surge.',
    emoji: '🇨🇳',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    scenarioId: 'demand_surge_asia',
    userTypeId: 'logistics',
    tags: ['Demand', 'China', 'Asia'],
    impacts: [
      { label: 'Demand Impact', change: '+2Mbbl/d', direction: 'up' },
      { label: 'Freight Rates', change: '+45%', direction: 'up' },
      { label: 'Price Forecast', change: '$89/bbl', direction: 'up' },
    ],
    aiMessage: 'China demand surge will tighten global supply within 4–6 weeks. Logistics companies: freight rates for tankers will spike. Secure fuel supply contracts now. Expect diesel to rise ₹8–12/litre within 3 weeks.',
  },
];

export function renderDemoScenarios(state) {
  const activeScenario = scenarios.find(s => s.id === state.activeScenarioId);

  const presetCards = demoPresets.map(preset => {
    const isActive = state.activeScenarioId === preset.scenarioId &&
                     state.userTypeId === preset.userTypeId;
    return `
    <div class="demo-card ${isActive ? 'demo-card-active' : ''}" 
         style="${isActive ? `box-shadow:0 0 0 2px ${scenarios.find(s=>s.id===preset.scenarioId)?.color},var(--shadow-lg);` : ''}">
      <div class="dc-header" style="background:${preset.gradient};">
        <div class="dc-emoji">${preset.emoji}</div>
        <div class="dc-badges">
          ${preset.tags.map(t => `<span class="dc-tag">${t}</span>`).join('')}
        </div>
        ${isActive ? '<div class="dc-active-badge">● ACTIVE</div>' : ''}
      </div>
      <div class="dc-body">
        <div class="dc-title">${preset.title}</div>
        <div class="dc-desc">${preset.description}</div>
        <div class="dc-impacts">
          ${preset.impacts.map(imp => `
            <div class="dci-item">
              <div class="dci-label">${imp.label}</div>
              <div class="dci-val ${imp.direction}">${imp.change}</div>
            </div>`).join('')}
        </div>
        <div class="dc-ai-msg">
          <span class="dc-ai-icon">🤖</span>
          <span>${preset.aiMessage.slice(0, 120)}…</span>
        </div>
        <div class="dc-actions">
          <button class="btn btn-primary dc-load-btn" onclick="window.loadDemoPreset('${preset.id}')">
            ${isActive ? '✓ Active' : '⚡ Load Scenario'}
          </button>
          <button class="btn btn-outline" onclick="window.APP.navigate('simulator')">Simulate →</button>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="page" id="page-demo">
    <div class="page-header">
      <div>
        <h1 class="page-title">⚡ Demo Scenarios</h1>
        <p class="page-subtitle">Click any scenario to simulate its full market impact across the dashboard</p>
      </div>
      <div class="page-actions">
        ${state.activeScenarioId ? `
        <button class="btn btn-outline" onclick="window.APP.clearScenario()">
          ✕ Clear Active Scenario
        </button>` : ''}
        <button class="btn btn-primary" onclick="window.APP.navigate('simulator')">Build Custom →</button>
      </div>
    </div>

    ${state.activeScenarioId ? (() => {
      const sc = scenarios.find(s => s.id === state.activeScenarioId);
      return sc ? `
      <div class="active-demo-banner" style="background:${sc.color}12;border:1px solid ${sc.color}40;">
        <div class="adb-left">
          <span style="font-size:2rem;">${sc.icon}</span>
          <div>
            <div class="adb-title">Active Scenario: <strong>${sc.title}</strong></div>
            <div class="adb-sub">Dashboard is now showing scenario-adjusted insights across all pages</div>
          </div>
        </div>
        <div class="adb-actions">
          <button class="btn btn-outline" onclick="window.APP.navigate('dashboard')">View Dashboard</button>
          <button class="btn btn-primary" onclick="window.APP.navigate('risk')">Risk Report</button>
        </div>
      </div>` : '';
    })() : `
    <div class="demo-intro-card">
      <div class="dic-icon">🎯</div>
      <div>
        <div class="dic-title">How Demo Scenarios Work</div>
        <div class="dic-sub">Click any scenario card below. The entire dashboard — insights, risk score, simulator, and AI assistant — will instantly update to reflect that market reality. Perfect for exploring "what-if" situations.</div>
      </div>
    </div>`}

    <!-- How it works steps -->
    <div class="demo-steps">
      <div class="ds-step"><span class="ds-num">1</span><span>Choose a scenario below</span></div>
      <div class="ds-arrow">→</div>
      <div class="ds-step"><span class="ds-num">2</span><span>Click "Load Scenario"</span></div>
      <div class="ds-arrow">→</div>
      <div class="ds-step"><span class="ds-num">3</span><span>Dashboard updates everywhere</span></div>
      <div class="ds-arrow">→</div>
      <div class="ds-step"><span class="ds-num">4</span><span>Run simulation or ask AI</span></div>
    </div>

    <!-- Scenario Cards Grid -->
    <div class="demo-grid">
      ${presetCards}
    </div>

    <!-- Bottom CTA -->
    <div class="card demo-bottom-cta">
      <div class="dbc-icon">🛠️</div>
      <div>
        <div class="dbc-title">Build a Custom Scenario</div>
        <div class="dbc-sub">Use the Scenario Simulator to enter your own market conditions, business inputs, and calculate a precise impact report.</div>
      </div>
      <button class="btn btn-primary" onclick="window.APP.navigate('simulator')">Open Simulator →</button>
    </div>
  </div>`;
}

window.loadDemoPreset = function(presetId) {
  const preset = demoPresets.find(p => p.id === presetId);
  if (!preset) return;

  window.APP.setUserType(preset.userTypeId);
  window.APP.setScenario(preset.scenarioId);

  // Show toast
  showToast(`⚡ "${preset.title}" scenario loaded! Dashboard updated.`, 'success');

  // Navigate to dashboard to see the effect
  setTimeout(() => window.APP.navigate('dashboard'), 1200);
};

function showToast(msg, type = 'info') {
  const existing = document.getElementById('pp-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pp-toast';
  toast.className = `pp-toast pp-toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3500);
}

export { showToast };
