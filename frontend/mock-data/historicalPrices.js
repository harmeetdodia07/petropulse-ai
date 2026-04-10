// PetroPulse AI — Historical Price Data Generator
// Generates ~1190 days of daily oil prices (Jan 2023 – Apr 2026)

function generatePriceData() {
  const data = [];
  const start = new Date('2023-01-01');
  const end   = new Date('2026-04-09');

  let brent = 83.5, wti = 77.8, diesel = 106.4, natGas = 3.2;

  // Major market shocks (date → brent Δ USD)
  const shocks = {
    '2023-03-12':  5.8,  // OPEC+ surprise production cut
    '2023-06-05': -7.5,  // Global demand slowdown concerns
    '2023-09-05':  4.2,  // Saudi voluntary cuts extended
    '2023-11-15': -3.8,  // Weak China manufacturing data
    '2024-01-08':  2.9,  // Red Sea Houthi attacks
    '2024-04-01':  7.1,  // Iran-Israel direct confrontation
    '2024-06-12': -4.8,  // OPEC+ output increase plans
    '2024-09-20': -6.2,  // Global recession fears
    '2024-11-10':  3.7,  // Winter demand spike Europe
    '2025-02-15':  8.3,  // Major refinery outage Kazakhstan
    '2025-05-01': -5.1,  // US strategic reserve release
    '2025-08-12':  6.4,  // Hurricane disrupts Gulf of Mexico
    '2025-10-20': -3.9,  // OPEC+ agrees capacity addition
    '2026-01-15':  5.2,  // New US sanctions on Venezuela
    '2026-03-01': -2.8,  // Russia-Ukraine ceasefire talks
  };

  let day = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), day++) {
    const key = d.toISOString().split('T')[0];

    if (shocks[key]) brent += shocks[key];

    // Mean-reverting random walk
    const cyclicTarget = 79 + 12 * Math.sin(day * 0.005) + 5 * Math.cos(day * 0.018);
    brent += (Math.random() - 0.49) * 2.0 + (cyclicTarget - brent) * 0.013;
    brent = Math.max(56, Math.min(110, brent));

    wti    = brent - (3.2 + Math.random() * 2.8);
    diesel = brent * 1.28 + (Math.random() - 0.5) * 4.2;
    diesel = Math.max(72, diesel);

    natGas += (Math.random() - 0.5) * 0.22;
    natGas = Math.max(1.4, Math.min(10.0, natGas));

    const spreadBrentWti = +(brent - wti).toFixed(2);
    const volatility = +(0.12 + Math.abs((Math.random() - 0.5) * 0.52)).toFixed(2);

    data.push({
      date:        key,
      brent:       +brent.toFixed(2),
      wti:         +wti.toFixed(2),
      diesel:      +diesel.toFixed(2),
      naturalGas:  +natGas.toFixed(2),
      spread:      spreadBrentWti,
      volatility,
      volume:      Math.round(88000 + Math.random() * 18000),
    });
  }
  return data;
}

export const historicalPrices = generatePriceData();
export default historicalPrices;
