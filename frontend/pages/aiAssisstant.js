// PetroPulse AI — AI Assistant Page (Chat Interface)
import { predictionEngine, riskScoringEngine, recommendationEngine, marketData } from '../engines/engines.js';
import businessProfiles from '../mock-data/businessProfiles.js';
import scenarios        from '../mock-data/scenarios.js';
import { getUsdInr }   from '../engines/liveRates.js';

const conversationHistory = [];

/* ── Predefined Q&A templates ── */
function generateResponse(query, state) {
  const q        = query.toLowerCase().trim();
  const profile  = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];
  const sc       = scenarios.find(s => s.id === state.activeScenarioId);
  const risk     = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);
  const mom7     = predictionEngine.momentum(7);
  const signal   = predictionEngine.getSignal();
  const forecast = predictionEngine.getForecast(marketData.brent, sc);
  const usdInr   = getUsdInr();

  // Scenario-specific answers
  if (q.includes('explain') || q.includes('market') || q.includes('today') || q.includes('current')) {
    return {
      text: `**Today's Market Summary — ${new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'})}**

Brent crude is trading at **$${marketData.brent.toFixed(2)}/bbl** (₹${Math.round(marketData.brent * usdInr / 158.987 * 100)/100}/litre), ${mom7 >= 0 ? '▲ up' : '▼ down'} ${Math.abs(mom7)}% over the past 7 days.

${sc ? `**Active scenario — ${sc.title}:** ${sc.summary}. This is expected to push prices ${sc.priceDirection === 'up' ? 'higher by' : 'lower by'} ${sc.priceImpactMin}–${sc.priceImpactMax}% in the coming ${sc.duration}.` : 'Markets are currently in a balanced state with no major disruption events.'}

**Key drivers today:**
• OPEC+ supply discipline remains firm, keeping floor above $78
• USD/INR at ₹${usdInr} — moderately elevated, raising import costs
• Red Sea route disruptions adding ~$2/bbl transport premium
• China demand recovery tracking above consensus estimates

**AI Signal:** ${signal.signal} — ${signal.reason}`,
      type: 'analysis',
    };
  }

  if (q.includes('affect') || q.includes('business') || q.includes('impact') || q.includes('me')) {
    const monthlyVol = profile.defaultInputs.monthlyConsumption;
    const costImpact = Math.round(monthlyVol * marketData.brent * usdInr / 158987 * (mom7 / 100));
    return {
      text: `**Impact on ${profile.label}**

Based on your profile (${profile.description}), here is how current market conditions affect you:

**Monthly Cost Impact:** ${mom7 >= 0 ? `+₹${Math.abs(costImpact).toLocaleString()} (additional cost)` : `-₹${Math.abs(costImpact).toLocaleString()} (cost saving)`}

**Your key exposures:**
• Supplier concentration: **${profile.supplierDependencyPct}%** from primary source — ${profile.supplierDependencyPct > 70 ? '⚠️ High risk, diversify now' : '✅ Acceptable level'}
• Transport dependency: **${profile.transportDependencyPct}%** — ${profile.transportDependencyPct > 80 ? 'Monitor diesel prices closely' : 'Moderate exposure'}
• Hedging coverage: **${profile.hedgingCapabilityPct}%** — ${profile.hedgingCapabilityPct < 20 ? '⚠️ Low — you are fully exposed to spot prices' : '✅ Reasonable coverage'}

${sc ? `**Scenario effect:** ${sc.businessImpacts[profile.label] || sc.recommendedAction}` : ''}

**Recommendation:** ${recommendationEngine.getInsights(state.userTypeId, state.activeScenarioId)[0]?.detail || 'Maintain regular procurement schedule.'}`,
      type: 'impact',
    };
  }

  if (q.includes('week') || q.includes('do') || q.includes('action') || q.includes('should')) {
    const outlk = recommendationEngine.getWeeklyOutlook(state.userTypeId, state.activeScenarioId);
    const ins   = recommendationEngine.getInsights(state.userTypeId, state.activeScenarioId);
    return {
      text: `**What You Should Do This Week**

**Market Bias:** ${outlk.outlook}
**Brent View:** ${outlk.brentView}

**Top 3 Actions for ${profile.label}:**
${ins.slice(0, 3).map((i, n) => `${n + 1}. **${i.headline}**  \n   → ${i.detail.slice(0, 100)}…`).join('\n\n')}

**Key Watch:** ${outlk.keyWatch}

${risk.score >= 60 ? `⚠️ **ELEVATED RISK (${risk.score}/100):** Consider activating your contingency procurement plan and securing alternative suppliers this week.` : `✅ **Risk Level OK (${risk.score}/100):** No urgent action required. Focus on cost optimisation.`}

AI Signal for this week: **${signal.signal}** — ${signal.reason}`,
      type: 'action',
    };
  }

  if (q.includes('risk') || q.includes('danger') || q.includes('biggest')) {
    const top = risk.topCauses[0];
    return {
      text: `**Biggest Risk Right Now**

Your composite risk score is **${risk.score} / 100** (${risk.label} Risk).

**#1 Risk Factor: ${top.name}** (Score: ${top.score}/100)
${top.name.includes('Geopolit') || sc ? `This is driven by ${sc ? sc.title + ' — ' + sc.explanation : 'elevated global geopolitical tensions impacting supply routes.'}` : `Price volatility at ${predictionEngine.volatility(14).toFixed(1)}% annualised is above normal thresholds.`}

**Top 3 Causes:**
${risk.topCauses.map((c, i) => `${i + 1}. **${c.name}** — ${c.score}/100`).join('\n')}

**How to reduce this risk:**
• Diversify suppliers → reduces supplier risk by ~18 points
• Forward hedge 30–60 days → reduces price risk by ~12 points  
• Build 21-day inventory buffer → reduces operational risk by ~10 points
• Pre-arrange alternative shipping routes → reduces transport risk by ~8 points

**Full mitigation plan:** [View Risk Indicator page]`,
      type: 'risk',
    };
  }

  if (q.includes('india') || q.includes('regional') || q.includes('inr') || q.includes('rupee')) {
    return {
      text: `**India Market Summary**

**INR/USD:** ₹${usdInr} (${usdInr > 90 ? '⚠️ Above 90 — elevated import cost pressure' : '✅ Within comfortable range'})

**India's Oil Import Situation:**
• Daily crude imports: ~5.2 Million barrels/day
• Russia remains #1 supplier: ~28% of imports (discounted Urals grade)
• Saudi Arabia #2: ~18%, Iraq #3: ~22%
• Refining capacity utilised at ~94%

**Price at Indian refineries:**
• Brent at ₹${Math.round(marketData.brent * usdInr)}/bbl = ₹${Math.round(marketData.brent * usdInr / 158.987 * 100)/100}/litre (crude only)
• Retail diesel (incl. taxes): ~₹94–98/litre across India
• Retail petrol: ~₹103–108/litre

**Key India risks this week:**
• Rupee weakness: Adding ~₹3,200/MT to import costs
• Red Sea routing: Affecting ~15% of India's imports
• Monsoon stocking: Refiners building inventory ahead of June season`,
      type: 'regional',
    };
  }

  if (q.includes('price') || q.includes('forecast') || q.includes('prediction') || q.includes('future')) {
    return {
      text: `**Price Forecast — AI Engine**

**Current Brent:** $82.40 / bbl

| Timeframe | Forecast | Confidence |
|---|---|---|
| 7 Days | $${forecast.day7} | ${forecast.confidence}% |
| 30 Days | $${forecast.day30} | ${Math.round(forecast.confidence * 0.83)}% |
| 60 Days | $${forecast.day60} | ${Math.round(forecast.confidence * 0.67)}% |

**Trend:** ${forecast.trend.toUpperCase()} — ${forecast.trend === 'bullish' ? 'prices expected to rise' : forecast.trend === 'bearish' ? 'prices expected to fall' : 'prices expected to stay range-bound'}

**Key forecast drivers:**
• OPEC+ compliance: High (supports floor price)
• China demand: Above consensus (upside pressure)  
• US production: Steady (caps upside)
• Geopolitical premium: ${sc ? `Elevated due to ${sc.title}` : 'Normal ~$2/bbl'}

${sc ? `\n**Scenario adjustment:** ${sc.title} adds ${sc.priceImpactMin}–${sc.priceImpactMax}% to base forecast with ${sc.confidence}% confidence.` : ''}

⚠️ *All forecasts use rule-based models and are for planning purposes only.*`,
      type: 'forecast',
    };
  }

  if (q.includes('opec') || q.includes('supply') || q.includes('production')) {
    return {
      text: `**OPEC+ Supply Outlook**

**Current production target:** 43.8 Mbbl/day (with voluntary cuts)
**Actual output:** ~42.1 Mbbl/day (compliance ~89%)

**Key OPEC+ moves this cycle:**
• Saudi Arabia: Maintaining 9.0 Mbbl/day voluntary cut
• Russia: Non-OPEC partner, cutting 0.5 Mbbl/day
• UAE, Kuwait, Iraq: Broadly compliant

**Market impact:**
• Global supply deficit: ~0.6–1.2 Mbbl/day
• This supports Brent floor above $78–80
• Next OPEC+ meeting: June 2026 — likely to review extension

**Supply risk score: ${sc?.supplyRisk || 38}/100**

For ${profile.label}: ${sc ? sc.businessImpacts[profile.label] || sc.recommendedAction : 'Standard procurement schedule applies. OPEC+ cuts provide price support — front-loading purchases slightly is advisable.'}`,
      type: 'supply',
    };
  }

  // Default response
  return {
    text: `**PetroPulse AI — Analysis**

I'm analyzing your query about: *"${query}"*

Based on current market data and ${profile.label} context:

**Market Status:** Brent at $82.40/bbl | Risk: ${risk.score}/100 (${risk.label}) | Signal: ${signal.signal}

**Quick Insight:** ${recommendationEngine.getInsights(state.userTypeId, state.activeScenarioId)[0]?.detail || 'Markets are relatively stable. Maintain regular procurement.'}

**Try asking:**
• "Explain today's market"
• "What should I do this week?"
• "How will this affect my business?"
• "What is my biggest risk?"
• "Give me the India oil situation"
• "What is the price forecast?"

I'm powered by PetroPulse's rule-based AI engine with mock market data. Real API integration is on the roadmap.`,
    type: 'default',
  };
}

export function renderAssistant(state) {
  const profile = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];
  const risk    = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);

  const quickPrompts = [
    { icon: '📊', text: 'Explain today\'s market' },
    { icon: '💼', text: 'How will this affect my business?' },
    { icon: '📅', text: 'What should I do this week?' },
    { icon: '⚠️', text: 'What is my biggest risk?' },
    { icon: '🇮🇳', text: 'Summarize risks for India' },
    { icon: '🔮', text: 'What is the price forecast?' },
    { icon: '🛢️', text: 'OPEC+ supply outlook?' },
    { icon: '💱', text: 'INR and import cost impact?' },
  ];

  const quickPromptsHTML = quickPrompts.map(p => `
    <button class="quick-prompt-btn" onclick="window.sendAssistantMessage('${p.text.replace(/'/g, "\\'")}')">
      ${p.icon} ${p.text}
    </button>`).join('');

  // Rebuild messages from history
  const messagesHTML = conversationHistory.length ? conversationHistory.map(m => buildMessageHTML(m)).join('') : `
    <div class="assistant-welcome">
      <div class="aw-icon">🤖</div>
      <div class="aw-title">PetroPulse AI Assistant</div>
      <div class="aw-sub">I can explain market conditions, analyze business impact, and give actionable recommendations — all based on current oil market intelligence and your business context.</div>
      <div class="aw-context">
        <span>You are: <strong>${profile.label}</strong></span>
        <span>Risk Level: <strong style="color:${risk.color}">${risk.label} (${risk.score}/100)</strong></span>
      </div>
    </div>`;

  return `
  <div class="page" id="page-assistant">
    <div class="page-header">
      <div>
        <h1 class="page-title">🤖 AI Assistant</h1>
        <p class="page-subtitle">Ask anything about oil markets, your business impact, or get strategic advice</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" onclick="window.clearAssistantChat()">Clear Chat</button>
      </div>
    </div>

    <div class="assistant-layout">
      <!-- Chat Window -->
      <div class="chat-column">
        <div class="chat-window" id="chat-messages">
          ${messagesHTML}
        </div>
        <div class="chat-input-area">
          <div class="chat-input-row">
            <input type="text" id="chat-input" class="chat-text-input"
                   placeholder="Ask about markets, risks, or your business impact…"
                   onkeydown="if(event.key==='Enter') window.sendAssistantMessage()">
            <button class="chat-send-btn" onclick="window.sendAssistantMessage()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <div class="chat-quick-prompts">
            ${quickPromptsHTML}
          </div>
        </div>
      </div>

      <!-- Context Panel -->
      <div class="assistant-context-panel">
        <div class="card mb-16">
          <div class="card-title mb-12">Current Context</div>
          <div class="ac-context-item">
            <span class="aci-icon">${profile.icon}</span>
            <div>
              <div class="aci-label">Business Type</div>
              <div class="aci-val">${profile.label}</div>
            </div>
          </div>
          <div class="ac-context-item">
            <span class="aci-icon">⚡</span>
            <div>
              <div class="aci-label">Risk Score</div>
              <div class="aci-val" style="color:${risk.color}">${risk.score}/100 — ${risk.label}</div>
            </div>
          </div>
          <div class="ac-context-item">
            <span class="aci-icon">🛢️</span>
            <div>
              <div class="aci-label">Brent Crude</div>
              <div class="aci-val">$82.40 / bbl</div>
            </div>
          </div>
          <div class="ac-context-item">
            <span class="aci-icon">💱</span>
            <div>
              <div class="aci-label">USD / INR</div>
              <div class="aci-val" data-usd-inr>₹${getUsdInr()}</div>
            </div>
          </div>
          ${state.activeScenarioId ? (() => {
            const sc = scenarios.find(s => s.id === state.activeScenarioId);
            return `<div class="ac-context-item" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">
              <span class="aci-icon">${sc.icon}</span>
              <div>
                <div class="aci-label">Active Scenario</div>
                <div class="aci-val" style="color:${sc.color}">${sc.title}</div>
              </div>
            </div>`;
          })() : ''}
          <button class="btn btn-outline w-full mt-8" onclick="window.APP.navigate('insights')">Change Settings</button>
        </div>

        <div class="card">
          <div class="card-title mb-12">Suggested Questions</div>
          <div class="suggested-qs">
            ${quickPrompts.slice(0, 5).map(p => `
              <button class="sq-btn" onclick="window.sendAssistantMessage('${p.text.replace(/'/g, "\\'")}')">
                ${p.icon} ${p.text}
              </button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildMessageHTML(msg) {
  if (msg.role === 'user') {
    return `<div class="chat-msg user-msg"><div class="msg-bubble user-bubble">${msg.text}</div></div>`;
  }
  // Convert markdown-like to HTML
  let html = msg.text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/^\|(.+)\|$/gm, '<tr><td>$1</td></tr>') // basic table rows
    .replace(/---/g, '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0;">');
  return `
    <div class="chat-msg ai-msg">
      <div class="ai-avatar">🤖</div>
      <div class="msg-bubble ai-bubble">${html}</div>
    </div>`;
}

window.sendAssistantMessage = function(preset) {
  const input = document.getElementById('chat-input');
  const query = preset || (input ? input.value.trim() : '');
  if (!query) return;

  const state = window.APP.getState();

  // Add user message
  conversationHistory.push({ role: 'user', text: query });
  appendMessage({ role: 'user', text: query });
  if (input) input.value = '';

  // Show typing indicator
  const msgs = document.getElementById('chat-messages');
  const typing = document.createElement('div');
  typing.className = 'chat-msg ai-msg typing-indicator-wrap';
  typing.id = 'typing-indicator';
  typing.innerHTML = `<div class="ai-avatar">🤖</div><div class="msg-bubble ai-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  if (msgs) { msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight; }

  setTimeout(() => {
    const response = generateResponse(query, state);
    conversationHistory.push({ role: 'assistant', text: response.text });
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
    appendMessage({ role: 'assistant', text: response.text });
  }, 800 + Math.random() * 600);
};

function appendMessage(msg) {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;

  // Remove welcome screen if present
  const welcome = msgs.querySelector('.assistant-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.innerHTML = buildMessageHTML(msg);
  msgs.appendChild(div.firstElementChild);
  msgs.scrollTop = msgs.scrollHeight;
}

window.clearAssistantChat = function() {
  conversationHistory.length = 0;
  const msgs = document.getElementById('chat-messages');
  if (msgs) {
    const state = window.APP.getState();
    const profile = businessProfiles.find(p => p.id === state.userTypeId) || businessProfiles[1];
    const risk = riskScoringEngine.calculate(state.activeScenarioId, state.userTypeId);
    msgs.innerHTML = `
      <div class="assistant-welcome">
        <div class="aw-icon">🤖</div>
        <div class="aw-title">PetroPulse AI Assistant</div>
        <div class="aw-sub">Chat cleared. Ask me anything about oil markets and your business.</div>
        <div class="aw-context">
          <span>You are: <strong>${profile.label}</strong></span>
          <span>Risk: <strong style="color:${risk.color}">${risk.label} (${risk.score}/100)</strong></span>
        </div>
      </div>`;
  }
};
