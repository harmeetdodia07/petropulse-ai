// PetroPulse AI — Main Application Controller (ES Module)
"use strict";

import { renderDashboard, initDashboard }    from './pages/dashboard.js';
import { renderInsights }                     from './pages/insights.js';
import { renderSimulator, initSimulator }     from './pages/simulator.js';
import { renderRisk, initRisk }              from './pages/riskIndicator.js';
import { renderAssistant }                    from './pages/aiAssistant.js';
import { renderDemoScenarios }                from './pages/demoScenarios.js';
import { getUsdInr }                          from './engines/liveRates.js';
import { historicalPrices as _hp }             from './mock-data/historicalPrices.js';
// Cache for ticker access
window._historicalPrices = _hp;
import { marketData }                         from './engines/engines.js';

/* ═══════════════════════════════════════════════════════════
   GLOBAL APPLICATION STATE
   ═══════════════════════════════════════════════════════════ */
const STATE = {
  currentPage:      'dashboard',
  userTypeId:       'logistics',
  activeScenarioId: null,
  sidebarCollapsed: false,
};

/* ═══════════════════════════════════════════════════════════
   NAVIGATION REGISTRY
   ═══════════════════════════════════════════════════════════ */
const PAGES = {
  dashboard: {
    label: 'Global Dashboard',
    render: s => renderDashboard(s),
    init:   s => initDashboard(s),
  },
  insights: {
    label: 'AI Insights',
    render: s => renderInsights(s),
    init:   () => {},
  },
  simulator: {
    label: 'Scenario Simulator',
    render: s => renderSimulator(s),
    init:   s => initSimulator(s),
  },
  risk: {
    label: 'Risk Indicator',
    render: s => renderRisk(s),
    init:   s => initRisk(s),
  },
  assistant: {
    label: 'AI Assistant',
    render: s => renderAssistant(s),
    init:   () => {},
  },
  demoScenarios: {
    label: 'Demo Scenarios',
    render: s => renderDemoScenarios(s),
    init:   () => {},
  },
};

/* ═══════════════════════════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════════════════════════ */
function navigate(pageId) {
  if (!PAGES[pageId]) return;
  STATE.currentPage = pageId;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  // Update breadcrumb
  const bc = document.getElementById('breadcrumb-label');
  if (bc) bc.textContent = PAGES[pageId].label;

  // Render page
  const content = document.getElementById('content-area');
  if (content) {
    content.innerHTML = PAGES[pageId].render(STATE);
  }

  // Init charts / side-effects
  requestAnimationFrame(() => {
    PAGES[pageId].init(STATE);
    if (window.lucide) window.lucide.createIcons();
  });

  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    document.body.classList.add('sidebar-collapsed');
  }

  // Scroll to top
  if (content) content.scrollTop = 0;
}

/* ═══════════════════════════════════════════════════════════
   STATE ACTIONS
   ═══════════════════════════════════════════════════════════ */
function setUserType(id) {
  STATE.userTypeId = id;
  navigate(STATE.currentPage); // Re-render current page
}

function setScenario(id) {
  STATE.activeScenarioId = id;
  updateScenarioBadge(id);
  navigate(STATE.currentPage);
}

function clearScenario() {
  STATE.activeScenarioId = null;
  updateScenarioBadge(null);
  navigate(STATE.currentPage);
}

function updateScenarioBadge(id) {
  const badge = document.getElementById('nav-scenario-badge');
  if (badge) {
    badge.textContent = id ? '●' : '';
    badge.style.display = id ? 'inline-flex' : 'none';
  }
}

function getState() { return { ...STATE }; }

/* ═══════════════════════════════════════════════════════════
   SIDEBAR SETUP
   ═══════════════════════════════════════════════════════════ */
function setupSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
      document.body.classList.toggle('sidebar-collapsed', STATE.sidebarCollapsed);
    });
  }

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   LIVE CLOCK & DATE
   ═══════════════════════════════════════════════════════════ */
function startClock() {
  function tick() {
    const now = new Date();
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    }
  }
  tick();
  setInterval(tick, 60000);
}

/* ═══════════════════════════════════════════════════════════
   PRICE TICKER (Top Bar)
   ═══════════════════════════════════════════════════════════ */
function setupMarketTicker() {
  const tickerEl = document.getElementById('market-ticker');
  if (!tickerEl) return;

  // Use live usdInr from marketData (updated by backend API), fallback to liveRates
  const usdInr   = marketData.usdInr || getUsdInr();
  const recent   = window._historicalPrices || [];
  const prev7    = recent.length >= 8 ? recent[recent.length - 8] : null;
  const lastGas  = recent.length ? recent[recent.length - 1]?.naturalGas : null;

  // Compute real % changes from historical data when available
  function chg(current, prev) {
    if (!prev || !current) return null;
    return +(((current - prev) / prev) * 100).toFixed(2);
  }
  function fmt(v) { return v === null ? '—' : `${v >= 0 ? '+' : ''}${v}%`; }

  const brentChg  = chg(marketData.brent,           prev7?.brent);
  const wtiChg    = chg(marketData.wti,              prev7?.wti);
  const dieselVal = +(marketData.brent * 1.28).toFixed(2);
  const dieselChg = chg(dieselVal,                   prev7?.diesel ? +(prev7.diesel).toFixed(2) : null);
  const gasVal    = lastGas ? +lastGas.toFixed(2) : 2.95;
  const gasChg    = chg(gasVal,                      prev7?.naturalGas);

  const items = [
    { label: 'Brent',  value: `$${marketData.brent.toFixed(2)}`, change: fmt(brentChg),  up: brentChg  === null || brentChg  >= 0 },
    { label: 'WTI',    value: `$${marketData.wti.toFixed(2)}`,   change: fmt(wtiChg),    up: wtiChg    === null || wtiChg    >= 0 },
    { label: 'Diesel', value: `$${dieselVal}`,                    change: fmt(dieselChg), up: dieselChg === null || dieselChg >= 0 },
    { label: 'Gas',    value: `$${gasVal.toFixed(2)}`,            change: fmt(gasChg),    up: gasChg    === null || gasChg    >= 0 },
    { label: 'INR',    value: `₹${usdInr}`,                  change: marketData.isLive ? 'Live' : 'Cached', up: true, isInr: true },
  ];

  tickerEl.innerHTML = items.map(t => `
    <span class="ticker-item">
      <span class="ticker-name">${t.label}</span>
      <span class="ticker-price${t.isInr ? ' ticker-inr-val' : ''}">${t.value}</span>
      <span class="${t.up ? 'ticker-change-up' : 'ticker-change-down'}">${t.change}</span>
    </span>
  `).join('<span class="ticker-divider">|</span>');

  // Live price flicker every 8 seconds
  setInterval(() => {
    tickerEl.querySelectorAll('.ticker-price').forEach(el => {
      el.classList.add('ticker-flash');
      setTimeout(() => el.classList.remove('ticker-flash'), 500);
    });
  }, 8000);
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════ */
function setupNotifications() {
  const btn = document.getElementById('notifications-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      const panel = document.getElementById('notif-panel');
      if (panel) panel.classList.toggle('visible');
    });
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('#notifications-btn') && !e.target.closest('#notif-panel')) {
      document.getElementById('notif-panel')?.classList.remove('visible');
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL APP OBJECT (exposed to page modules)
   ═══════════════════════════════════════════════════════════ */
window.APP = { navigate, setUserType, setScenario, clearScenario, getState };

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */
function boot() {
  setupSidebar();
  startClock();
  setupMarketTicker();
  setupNotifications();

  // Listen for real-time data updates from backend
  window.addEventListener('petropulse:data-updated', (e) => {
    // Sync usdInr into marketData if backend returned a newer rate
    if (e.detail?.usd_inr) marketData.usdInr = e.detail.usd_inr;
    setupMarketTicker();
    if (STATE.currentPage === 'dashboard') navigate('dashboard');
  });
  window.addEventListener('petropulse:ml-updated', () => {
    if (STATE.currentPage === 'dashboard') navigate('dashboard');
  });

  // Show loading screen briefly
  const loader = document.getElementById('app-loader');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('loader-done');
      setTimeout(() => loader.remove(), 400);
    }, 1200);
  }

  // Navigate to dashboard
  navigate('dashboard');

  if (window.lucide) window.lucide.createIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
