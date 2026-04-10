// PetroPulse AI — Live USD/INR Rate Module
// Fetches real-time exchange rate from a free public API every minute

const FALLBACK_RATE = 93.01; // Updated fallback — USD/INR as of Apr 2026 (source: market data)
const UPDATE_INTERVAL_MS = 60_000; // 60 seconds

// Shared live rate object accessible across the entire app
export const liveRates = {
  usdInr: FALLBACK_RATE,
  lastUpdated: null,
  isLive: false,
};

/**
 * Fetches USD/INR from the open ExchangeRate-API (no key needed for this endpoint)
 * Falls back gracefully if the network is unavailable
 */
async function fetchUsdInr() {
  try {
    // Fetch from our new backend which uses Alpha Vantage
    const response = await fetch('/api/market-status', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rate = data?.usd_inr;
    if (typeof rate === 'number' && rate > 50 && rate < 200) {
      liveRates.usdInr = +rate.toFixed(2);
      liveRates.isLive = true;
      liveRates.lastUpdated = new Date();
      console.log(`[PetroPulse] Live USD/INR from backend: ₹${liveRates.usdInr}`);
    } else {
      throw new Error('Invalid rate received from backend');
    }
  } catch (err) {
    // Silently fall back to the last known rate
    if (!liveRates.isLive) {
      liveRates.usdInr = FALLBACK_RATE;
    }
    console.warn(`[PetroPulse] Backend USD/INR fetch failed (using ₹${liveRates.usdInr}):`, err.message);
  }

  // Update every UI element showing USD/INR on screen
  updateUiRateDisplay();
}

/**
 * Updates all elements with the data-usd-inr attribute live
 */
function updateUiRateDisplay() {
  const elements = document.querySelectorAll('[data-usd-inr]');
  elements.forEach(el => {
    el.textContent = `₹${liveRates.usdInr}`;
  });

  // Update ticker if it has the INR item
  const tickerInr = document.querySelector('.ticker-inr-val');
  if (tickerInr) {
    tickerInr.textContent = `₹${liveRates.usdInr}`;
  }
}

// Immediately fetch on load, then poll every minute
fetchUsdInr();
setInterval(fetchUsdInr, UPDATE_INTERVAL_MS);

/** Convenience getter — preferred way to access the rate */
export function getUsdInr() {
  return liveRates.usdInr;
}

export default liveRates;
