let allSetups = [];
let refreshTimer = null;

async function init() {
  console.log('Initializing Dashboard...');
  
  // Clear existing timer if any
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  try {
    const res = await fetch('/api/setups');
    const data = await res.json();
    
    if (data.error) {
      document.getElementById('setups-grid').innerHTML = `<div style="padding:20px;color:var(--bear)">${data.error}</div>`;
      return;
    }

    allSetups = data.setups || [];
    
    // Update Header
    document.getElementById('last-updated').textContent = `UPDATED: ${data.generatedAt}`;
    const moodEl = document.getElementById('market-status');
    if (data.marketMood) {
      moodEl.textContent = `MARKET MOOD: ${data.marketMood.label.toUpperCase()} (${data.marketMood.score}%)`;
      moodEl.style.color = data.marketMood.score > 50 ? 'var(--bull)' : data.marketMood.score < 40 ? 'var(--bear)' : 'var(--text)';
    }

    // Update Stats
    if (data.niftyTechnicals) {
      const statsHtml = data.niftyTechnicals.map(t => `
        <div class="stat-card">
          <div class="stat-label">${t.name}</div>
          <div class="stat-value" style="color: ${t.bias === 'bull' ? 'var(--bull)' : t.bias === 'bear' ? 'var(--bear)' : 'var(--text)'}">${t.value}</div>
        </div>
      `).join('');
      document.getElementById('stats-bar').innerHTML = statsHtml;
    }

    renderSetups(allSetups);

    // Load strategy checks
    try {
      const sres = await fetch('/api/strategies');
      if (sres.ok) {
        const sdata = await sres.json();
        renderStrategies(sdata);
      }
    } catch (e) {
      console.warn('Strategy data not available');
    }

    setupAutoRefresh();

  } catch (e) {
    console.error('Fetch error:', e);
    document.getElementById('setups-grid').innerHTML = `<div style="padding:20px;color:var(--bear)">Connection Error. Is server running?</div>`;
  }
}

function setupAutoRefresh() {
  const select = document.getElementById('refresh-period');
  const minutes = parseInt(select.value);
  
  if (refreshTimer) clearInterval(refreshTimer);
  
  if (minutes > 0) {
    console.log(`Auto-refresh set for every ${minutes} minutes`);
    refreshTimer = setInterval(() => {
      console.log('Triggering periodic refresh...');
      init(); 
    }, minutes * 60 * 1000);
  }
}

// Handle change in period select
document.getElementById('refresh-period').addEventListener('change', setupAutoRefresh);

function toggleStrategies() {
  const content = document.getElementById('strategy-content');
  const icon = document.getElementById('strategy-toggle-icon');
  const isCollapsed = content.classList.toggle('collapsed');
  icon.textContent = isCollapsed ? '+' : '−';
}

function renderSetups(setups) {
  const grid = document.getElementById('setups-grid');
  if (!setups || setups.length === 0) {
    grid.innerHTML = '<div style="padding:20px;grid-column:1/-1;text-align:center;color:var(--text-muted)">No active setups found for current filters.</div>';
    return;
  }

  grid.innerHTML = setups.map(s => {
    const changeSign = s.change > 0 ? '+' : '';
    return `
      <div class="card" onclick="openModal('${s.symbol}')">
        <div class="card-header">
          <div>
            <span class="symbol">${s.symbol}</span>
            <span class="sector">${s.sector || 'N/A'}</span>
          </div>
          <div class="price-box">
            <div class="price">${(s.ltp || 0).toFixed(2)}</div>
            <div class="change ${s.change >= 0 ? 'bull' : 'bear'}">${changeSign}${(s.change || 0).toFixed(2)}</div>
          </div>
        </div>

        <div class="badges">
          <span class="badge setup">${s.setupType}</span>
          <span class="badge rr">R:R ${s.rrRatio}</span>
        </div>

        <div class="signals">
          ${(s.signals || []).slice(0, 2).map(sig => `<div class="signal-item">${sig}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function openModal(symbol) {
  const s = allSetups.find(x => x.symbol === symbol);
  if (!s) return;

  const overlay = document.getElementById('modal-overlay');
  const header = document.getElementById('modal-header');
  const body = document.getElementById('modal-body');

  header.innerHTML = `
    <div>
      <h2 style="margin:0;font-size:24px;">${s.symbol}</h2>
      <div style="color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">${s.sector || ''} • ${s.name || ''}</div>
    </div>
    <div class="close-modal" onclick="closeModal()">✕</div>
  `;

  const changeSign = s.change > 0 ? '+' : '';
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
      <div>
        <div style="font-size:32px;font-weight:800;font-family:var(--font-mono);">${(s.ltp || 0).toFixed(2)}</div>
        <div class="change ${s.change >= 0 ? 'bull' : 'bear'}" style="font-size:16px;">${changeSign}${(s.change || 0).toFixed(2)}</div>
      </div>
      <div style="text-align:right">
        <div class="badge ${s.bias === 'BULLISH' ? 'bull' : 'bear'}" style="font-size:14px;padding:6px 16px;border-radius:8px;">${s.bias} BIAS</div>
        <div style="margin-top:8px;font-weight:700;color:var(--primary);">${s.setupType} Setup</div>
      </div>
    </div>

    <div class="metrics" style="margin-bottom:32px;padding:1px;background:var(--border);">
      <div class="metric" style="padding:20px;">
        <span class="m-label">Recommended Entry</span>
        <span class="m-val" style="font-size:18px;">${s.entry}</span>
      </div>
      <div class="metric" style="padding:20px;">
        <span class="m-label">Stop Loss (ATR)</span>
        <span class="m-val" style="font-size:18px;color:var(--bear)">${s.stopLoss}</span>
      </div>
      <div class="metric" style="padding:20px;">
        <span class="m-label">Target (1:2.5)</span>
        <span class="m-val" style="font-size:18px;color:var(--bull)">${s.target1}</span>
      </div>
    </div>

    <div class="modal-detail-grid">
      <div class="detail-section">
        <h4>Technical Signals</h4>
        <div class="signals">
          ${(s.signals || []).map(sig => `<div class="signal-item" style="font-size:13px;margin-bottom:10px;">${sig}</div>`).join('')}
        </div>
      </div>
      <div class="detail-section">
        <h4>Risk Analysis</h4>
        <div style="background:var(--bg);padding:16px;border-radius:12px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <span style="color:var(--text-muted);font-size:12px;">Risk/Reward Ratio</span>
            <span style="font-weight:700;font-family:var(--font-mono);">${s.rrRatio}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--text-muted);font-size:12px;">Confidence Score</span>
            <span style="font-weight:700;color:var(--primary);">${s.confidence || 0}/10</span>
          </div>
        </div>
        <div style="margin-top:20px;">
          <h4 style="font-size:10px;">Targets Plan</h4>
          <div style="font-size:12px;margin-bottom:4px;">T1: <strong>${s.target1}</strong> (Primary)</div>
          <div style="font-size:12px;">T2: <strong>${s.target2}</strong> (Extended)</div>
        </div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden'; 
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.style.overflow = 'auto';
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function filterSetups(type, btn) {
  document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  let filtered = allSetups;
  if (type === 'Breakout') {
    filtered = allSetups.filter(s => s.setupType === 'Breakout');
  } else if (type !== 'all') {
    filtered = allSetups.filter(s => s.bias === type);
  }
  renderSetups(filtered);
}

function renderStrategies(sdata) {
  const container = document.getElementById('strategy-list');
  const tableBody = document.getElementById('strategy-table-body');
  
  if (!sdata || !sdata.results) {
    container.textContent = 'No strategy results available';
    tableBody.innerHTML = '<tr><td colspan="3">No signals</td></tr>';
    return;
  }
  
  const entries = Object.entries(sdata.results);
  
  // Summary
  const swing = entries.filter(([s, c]) => c.holdingPeriod === 'Swing').length;
  const intraday = entries.filter(([s, c]) => c.holdingPeriod === 'Intraday').length;
  const none = entries.filter(([s, c]) => c.holdingPeriod === 'None').length;
  document.getElementById('strategy-summary').innerHTML = `
    <div class="summary-row">
      Scanned: <strong>${entries.length}</strong> | 
      Swing: <strong style="color:var(--bull)">${swing}</strong> | 
      Intraday: <strong style="color:var(--primary)">${intraday}</strong> | 
      No Signal: <strong>${none}</strong>
    </div>`;
  
  // Table
  tableBody.innerHTML = entries.map(([sym, checks]) => {
    const passed = checks.passedSignals || [];
    const holding = checks.holdingPeriod || 'None';
    const holdingClass = holding === 'Swing' ? 'swing' : holding === 'Intraday' ? 'intraday' : 'none';
    const signals = passed.length ? passed.map(p => `<span class="signal-tag">${p}</span>`).join(' ') : '—';
    return `
      <tr>
        <td class="sym-col"><strong>${sym}</strong></td>
        <td class="holding-col"><span class="holding-badge ${holdingClass}">${holding}</span></td>
        <td class="signals-col">${signals}</td>
      </tr>
    `;
  }).join('');
  
  // Details panel (bottom list)
  container.innerHTML = entries.filter(([s, c]) => (c.passedSignals || []).length > 0).map(([sym, checks]) => {
    const passed = checks.passedSignals || [];
    const holding = checks.holdingPeriod || 'None';
    const holdingClass = holding === 'Swing' ? 'swing' : holding === 'Intraday' ? 'intraday' : '';
    
    const signalDetails = [];
    for (const [key, val] of Object.entries(checks)) {
      if (['holdingPeriod', 'passedSignals'].includes(key) || !val || typeof val !== 'object') continue;
      if (!val.ok) continue;
      const details = Object.entries(val).filter(([k]) => k !== 'ok').map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(', ');
      signalDetails.push(`<div class="signal-detail"><strong>${key}:</strong> ${details}</div>`);
    }
    
    return `
      <div class="strategy-row">
        <div class="sym-section">
          <div class="sym">${sym} <span class="holding ${holdingClass}">${holding}</span></div>
          <div class="tooltip-box">${signalDetails.join('')}</div>
        </div>
        <div class="passed">${passed.map(p => `<span class="badge">${p}</span>`).join(' ')}</div>
      </div>
    `;
  }).join('');
}

init();
