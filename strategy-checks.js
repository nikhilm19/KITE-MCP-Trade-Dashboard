const fs = require('fs');
const path = require('path');

function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i === 0) {
      prev = v;
      out.push(prev);
    } else {
      prev = v * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

function rsi(closes, period = 14) {
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }
  const avgG = [];
  const avgL = [];
  for (let i = 0; i < gains.length; i++) {
    if (i < period) {
      const g = gains.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1);
      const l = losses.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1);
      avgG.push(g);
      avgL.push(l);
    } else if (i === period) {
      const g = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const l = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      avgG.push(g);
      avgL.push(l);
    } else {
      const g = (avgG[i - 1] * (period - 1) + gains[i]) / period;
      const l = (avgL[i - 1] * (period - 1) + losses[i]) / period;
      avgG.push(g);
      avgL.push(l);
    }
  }
  const rsiArr = [];
  for (let i = 0; i < avgG.length; i++) {
    const rs = avgL[i] === 0 ? 100 : avgG[i] / avgL[i];
    const val = 100 - 100 / (1 + rs);
    rsiArr.push(val);
  }
  // align with closes: rsiArr[0] corresponds to closes[1]
  rsiArr.unshift(null);
  return rsiArr;
}

function macd(closes) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = ema(macdLine, 9);
  return { macd: macdLine, signal };
}

function maxOf(arr) {
  return arr.reduce((a, b) => Math.max(a, b), -Infinity);
}

// Strategy checks
function checkRSIBullish(history) {
  const closes = history.map(d => d.close);
  if (closes.length < 16) return { ok: false };
  const r = rsi(closes, 14);
  const prev = r[r.length - 2];
  const last = r[r.length - 1];
  return { ok: prev !== null && prev < 30 && last >= 30, prev, last };
}

function checkMACDBullish(history) {
  const closes = history.map(d => d.close);
  if (closes.length < 40) return { ok: false };
  const { macd: m, signal: s } = macd(closes);
  const prevM = m[m.length - 2];
  const prevS = s[s.length - 2];
  const lastM = m[m.length - 1];
  const lastS = s[s.length - 1];
  return { ok: prevM <= prevS && lastM > lastS && lastM > 0, prevM, prevS, lastM, lastS };
}

function checkGoldenCrossover(history) {
  const closes = history.map(d => d.close);
  if (closes.length < 210) return { ok: false };
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const prev50 = ema50[ema50.length - 2];
  const prev200 = ema200[ema200.length - 2];
  const last50 = ema50[ema50.length - 1];
  const last200 = ema200[ema200.length - 1];
  return { ok: prev50 <= prev200 && last50 > last200, prev50, prev200, last50, last200 };
}

function checkPrevHighBreak(history) {
  if (history.length < 21) return { ok: false };
  const highs = history.slice(history.length - 21, history.length - 1).map(d => d.high);
  const prevHigh = maxOf(highs);
  const lastClose = history[history.length - 1].close;
  return { ok: lastClose > prevHigh, lastClose, prevHigh };
}

function checkEMACrossoverMomentum(history) {
  const closes = history.map(d => d.close);
  if (closes.length < 30) return { ok: false };
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const prev9 = ema9[ema9.length - 2];
  const prev21 = ema21[ema21.length - 2];
  const last9 = ema9[ema9.length - 1];
  const last21 = ema21[ema21.length - 1];
  return { ok: prev9 <= prev21 && last9 > last21, prev9, prev21, last9, last21 };
}

// Main
const histdir = path.join(__dirname, 'histdata');
const targets = fs.readdirSync(histdir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort();
const results = {};
targets.forEach(sym => {
  const fp = path.join(histdir, `${sym}.json`);
  if (!fs.existsSync(fp)) {
    results[sym] = { error: 'history not found' };
    return;
  }
  const hist = JSON.parse(fs.readFileSync(fp, 'utf8'));
  results[sym] = {
    RSI_Bullish_Reversal: checkRSIBullish(hist),
    MACD_Bullish: checkMACDBullish(hist),
    Golden_Crossover: checkGoldenCrossover(hist),
    PrevHighBreak: checkPrevHighBreak(hist),
    EMA9_21_Crossover: checkEMACrossoverMomentum(hist)
  };
  // Determine holding period recommendation
  const checks = results[sym];
  const passed = Object.entries(checks).filter(([k, v]) => v && v.ok && k !== 'holdingPeriod').map(x => x[0]);
  const swingSignals = ['Golden_Crossover', 'MACD_Bullish', 'EMA9_21_Crossover'];
  const intradaySignals = ['PrevHighBreak', 'RSI_Bullish_Reversal'];
  let holding = 'None';
  if (passed.some(p => swingSignals.includes(p))) holding = 'Swing';
  else if (passed.some(p => intradaySignals.includes(p))) holding = 'Intraday';
  results[sym].holdingPeriod = holding;
  results[sym].passedSignals = passed;
});

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
fs.writeFileSync(path.join(__dirname, 'data', 'strategies.json'), JSON.stringify({ generatedAt: new Date().toISOString(), targets, results }, null, 2));
console.log('Strategy checks complete — results written to data/strategies.json');
console.log('\nStrategy Summary:');
targets.forEach(sym => {
  const passed = results[sym].passedSignals || [];
  const holding = results[sym].holdingPeriod;
  console.log(`  ${sym}: ${passed.length > 0 ? passed.join(', ') : 'No signals'} → ${holding}`);
});
