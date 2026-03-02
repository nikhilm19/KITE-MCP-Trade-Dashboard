/**
 * PULSTA — analyse.js
 *
 * Claude runs this via VS Code after fetching data from Kite MCP.
 * DO NOT run manually — paste prompt.md into VS Code Claude Chat instead.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Indicator Math ─────────────────────────────────────────────────────────

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function ema(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let val = average(data.slice(0, period));
  for (let i = period; i < data.length; i++) val = data[i] * k + val * (1 - k);
  return +val.toFixed(2);
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (al === 0) return 100;
  return +(100 - 100 / (1 + ag / al)).toFixed(2);
}

function macdLine(closes) {
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  if (e12 === null || e26 === null) return null;
  return +(e12 - e26).toFixed(2);
}

function bollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean  = average(slice);
  const sd    = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
  return {
    upper: +(mean + mult * sd).toFixed(2),
    mid:   +mean.toFixed(2),
    lower: +(mean - mult * sd).toFixed(2),
    bw:    +(4 * sd / mean * 100).toFixed(2),
  };
}

function atr(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i]  - closes[i - 1])
    ));
  }
  return +average(trs.slice(-period)).toFixed(2);
}

function stochastic(highs, lows, closes, period = 14) {
  if (highs.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  const c = closes[closes.length - 1];
  return h === l ? 50 : +((c - l) / (h - l) * 100).toFixed(2);
}

function getCandlePattern(open, high, low, close) {
  const body = Math.abs(close - open);
  const range = high - low;
  if (range === 0) return 'Doji';
  const upper = high - Math.max(open, close);
  const lower = Math.min(open, close) - low;
  
  if (body < range * 0.1) return 'Doji';
  if (lower > body * 2 && upper < body * 0.5) return 'Hammer';
  if (upper > body * 2 && lower < body * 0.5) return 'Shooting Star';
  if (body > range * 0.8) return 'Marubozu';
  return null;
}

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreStock(m) {
  let score = 0;
  const signals = [];
  const ltp = m.ltp;

  if (m.ema20  && ltp > m.ema20)  { score += 1; signals.push('Above EMA20'); }
  if (m.ema50  && ltp > m.ema50)  { score += 1; signals.push('Above EMA50'); }
  if (m.ema200 && ltp > m.ema200) { score += 1; signals.push('Above EMA200'); }
  if (m.ema20  && m.ema50 && m.ema20 > m.ema50) { score += 1; signals.push('EMA20 > EMA50'); }

  if (m.rsi !== null) {
    if (m.rsi > 55 && m.rsi < 75) { score += 2; signals.push(`RSI Bullish (${m.rsi})`); }
    else if (m.rsi >= 75)          { score -= 1; signals.push(`RSI Overbought (${m.rsi})`); }
    else if (m.rsi < 35)           { score -= 1; signals.push(`RSI Oversold (${m.rsi})`); }
  }

  if (m.stoch !== null) {
    if (m.stoch < 20) { score += 1; signals.push(`Stoch Oversold (${m.stoch})`); }
    else if (m.stoch > 80) { score -= 1; signals.push(`Stoch Overbought (${m.stoch})`); }
  }

  if (m.pattern) {
    if (m.pattern === 'Hammer') { score += 2; signals.push('Hammer Candle'); }
    if (m.pattern === 'Shooting Star') { score -= 2; signals.push('Shooting Star'); }
    if (m.pattern === 'Marubozu') { 
      if (m.change > 0) { score += 1; signals.push('Bullish Marubozu'); }
      else { score -= 1; signals.push('Bearish Marubozu'); }
    }
  }

  if (m.macd !== null) {
    if (m.macd > 0) { score += 2; signals.push(`MACD Positive (${m.macd})`); }
    else            { score -= 1; signals.push(`MACD Negative (${m.macd})`); }
  }

  if (m.volumeRatio > 1.5) { score += 2; signals.push(`Volume Surge (${m.volumeRatio.toFixed(1)}x avg)`); }
  if (m.volumeRatio > 2.5) { score += 1; signals.push('Exceptional Volume'); }

  if (m.bb) {
    if (ltp > m.bb.upper) { score += 1; signals.push('BB Upper Breakout'); }
    if (ltp < m.bb.lower) { score -= 1; signals.push('BB Lower Break'); }
    if (m.bb.bw < 5)      { score += 1; signals.push('BB Squeeze — breakout imminent'); }
  }

  if (m.pivots) {
    if (ltp > m.pivots.r1) { score += 1; signals.push('Above R1 Pivot'); }
    if (ltp < m.pivots.s1) { score -= 1; signals.push('Below S1 Pivot'); }
  }

  let setupType = 'Momentum';
  if (m.bb && ltp > m.bb.upper && m.volumeRatio > 1.5)      setupType = 'Breakout';
  else if (m.rsi && m.rsi < 45 && m.ema50 && ltp > m.ema50) setupType = 'Pullback';
  else if (m.rsi && m.rsi < 35)                               setupType = 'Reversal';
  else if (m.pattern === 'Hammer' && m.rsi < 40)              setupType = 'Reversal Buy';
  else if (m.pattern === 'Shooting Star' && m.rsi > 60)       setupType = 'Reversal Sell';

  const bias    = score >= 5 ? 'BULLISH' : score <= 1 ? 'BEARISH' : 'NEUTRAL';
  const atrVal  = m.atr || ltp * 0.015;
  const entry   = +ltp.toFixed(2);
  const sl      = bias === 'BULLISH' ? +(ltp - 1.5 * atrVal).toFixed(2) : +(ltp + 1.5 * atrVal).toFixed(2);
  const target1 = bias === 'BULLISH' ? +(ltp + 2.5 * atrVal).toFixed(2) : +(ltp - 2.5 * atrVal).toFixed(2);
  const target2 = bias === 'BULLISH' ? +(ltp + 4.0 * atrVal).toFixed(2) : +(ltp - 4.0 * atrVal).toFixed(2);
  const risk    = Math.abs(entry - sl);
  const reward  = Math.abs(target1 - entry);
  const rrRatio = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : '1:0';

  return { score, bias, setupType, signals: signals.slice(0, 5), entry, stopLoss: sl, target1, target2, rrRatio };
}

// ── Sector map ─────────────────────────────────────────────────────────────

const SECTOR_MAP = {
  TCS:'IT', INFY:'IT', WIPRO:'IT', HCLTECH:'IT', TECHM:'IT', LTIM:'IT',
  HDFCBANK:'Banks', ICICIBANK:'Banks', SBIN:'Banks', KOTAKBANK:'Banks', AXISBANK:'Banks',
  INDUSINDBK:'Banks', BANDHANBNK:'Banks', FEDERALBNK:'Banks', PNB:'Banks', BANKBARODA:'Banks',
  BAJFINANCE:'NBFC', BAJAJFINSV:'NBFC', CHOLAFIN:'NBFC',
  RELIANCE:'Energy', ONGC:'Energy', BPCL:'Energy', IOC:'Energy', NTPC:'Energy', POWERGRID:'Energy', ADANIGREEN:'Energy',
  SUNPHARMA:'Pharma', DRREDDY:'Pharma', CIPLA:'Pharma', DIVISLAB:'Pharma', LUPIN:'Pharma',
  MARUTI:'Auto', TATAMOTORS:'Auto', 'BAJAJ-AUTO':'Auto', HEROMOTOCO:'Auto', EICHERMOT:'Auto', M_M:'Auto',
  TATASTEEL:'Metal', JSWSTEEL:'Metal', HINDALCO:'Metal', VEDL:'Metal', COALINDIA:'Metal',
  ASIANPAINT:'FMCG', HINDUNILVR:'FMCG', ITC:'FMCG', NESTLEIND:'FMCG', BRITANNIA:'FMCG', TATACONSUM:'FMCG', PIDILITIND:'FMCG',
  LT:'Infra', ADANIPORTS:'Infra', ADANIENT:'Infra',
  ULTRACEMCO:'Cement', GRASIM:'Cement', SHREECEM:'Cement',
  APOLLOHOSP:'Healthcare', MAXHEALTH:'Healthcare',
  TITAN:'Consumer', TRENT:'Consumer', PAGEIND:'Consumer',
  DMART:'Retail', ZOMATO:'New Age', NAUKRI:'New Age',
};

function getSector(symbol) {
  return SECTOR_MAP[symbol] || 'Others';
}

// ── Main ───────────────────────────────────────────────────────────────────

/**
 * buildReport — called by Claude after fetching data from Kite MCP
 *
 * @param {Object} kiteLiveData
 *   quotes  : { RELIANCE: { ltp, change, volume, name? }, ... }
 *   history : { RELIANCE: [ { date, open, high, low, close, volume }, ... ], ... }
 */
function buildReport(kiteLiveData) {
  const { quotes, history } = kiteLiveData;
  const allMetrics     = [];
  const sectorChanges  = {};

  for (const [rawSymbol, rawQ] of Object.entries(quotes)) {
    // Normalize symbol (remove NSE: prefix for sector lookup) and quote data (handle raw Kite API)
    const symbol = rawSymbol.replace(/^(NSE|BSE):/, '');
    const q = {
      ltp:    rawQ.ltp    || rawQ.last_price || 0,
      volume: rawQ.volume || 0,
      change: rawQ.change !== undefined ? rawQ.change : (rawQ.net_change || 0),
      ohlc:   rawQ.ohlc   || {},
      name:   rawQ.name   || symbol
    };

    const candles = history[rawSymbol] || history[symbol] || [];
    if (candles.length < 26) continue;

    const closes  = candles.map(c => c.close);
    const highs   = candles.map(c => c.high);
    const lows    = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const sector  = getSector(symbol);

    if (!sectorChanges[sector]) sectorChanges[sector] = [];
    sectorChanges[sector].push(q.change || 0);

    const prev = candles[candles.length - 2];
    const pivots = prev ? {
      p: (prev.high + prev.low + prev.close) / 3,
      r1: (2 * ((prev.high + prev.low + prev.close) / 3)) - prev.low,
      s1: (2 * ((prev.high + prev.low + prev.close) / 3)) - prev.high
    } : null;

    const m = {
      ltp:         q.ltp,
      change:      q.change   || 0,
      volume:      q.volume   || 0,
      volumeRatio: q.volume > 0 ? q.volume / average(volumes.slice(-20)) : 0,
      ema20:       ema(closes, 20),
      ema50:       ema(closes, 50),
      ema200:      closes.length >= 200 ? ema(closes, 200) : null,
      rsi:         rsi(closes, 14),
      macd:        macdLine(closes),
      bb:          bollingerBands(closes, 20, 2),
      atr:         atr(highs, lows, closes, 14),
      stoch:       stochastic(highs, lows, closes, 14),
      pattern:     getCandlePattern(q.ohlc.open, q.ohlc.high, q.ohlc.low, q.ohlc.close),
      pivots:      pivots
    };

    const scored = scoreStock(m);
    if (scored.bias === 'NEUTRAL') continue;

    allMetrics.push({
      symbol,
      name:       q.name || symbol,
      sector,
      ltp:        m.ltp,
      change:     m.change,
      confidence: Math.min(Math.max(scored.score, 1), 10),
      ...scored,
    });
  }

  const top10 = allMetrics
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((s, i) => ({ rank: i + 1, ...s }));

  const bullCount  = allMetrics.filter(s => s.bias === 'BULLISH').length;
  const moodScore  = allMetrics.length ? Math.round(bullCount / allMetrics.length * 100) : 50;
  const moodLabel  = moodScore > 65 ? 'Bullish' : moodScore > 52 ? 'Neutral Bullish' : moodScore > 45 ? 'Neutral' : moodScore > 30 ? 'Neutral Bearish' : 'Bearish';

  const sectors = Object.entries(sectorChanges)
    .map(([name, changes]) => ({ name, change: (changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2) }))
    .sort((a, b) => parseFloat(b.change) - parseFloat(a.change));

  const avgRsi = allMetrics.filter(m => m.rsi).length
    ? +average(allMetrics.filter(m => m.rsi).map(m => m.rsi)).toFixed(1)
    : null;

  const niftyTechnicals = [
    { name: 'Market Breadth',      value: `${bullCount} Bull / ${allMetrics.length - bullCount} Bear`, bias: moodScore > 50 ? 'bull' : 'bear' },
    { name: 'Avg RSI (Nifty 100)', value: avgRsi ? String(avgRsi) : 'N/A',                             bias: avgRsi > 55 ? 'bull' : avgRsi < 45 ? 'bear' : 'neutral' },
    { name: 'Stocks > EMA50',      value: allMetrics.filter(m => m.ltp > (m.ema50 || 0)).length + ' stocks', bias: 'neutral' },
    { name: 'Volume Surges',       value: allMetrics.filter(m => m.volumeRatio > 1.5).length + ' stocks', bias: 'neutral' },
    { name: 'Breakout Setups',     value: top10.filter(s => s.setupType === 'Breakout').length + ' found', bias: 'bull' },
    { name: 'Reversal Setups',     value: top10.filter(s => s.setupType === 'Reversal').length + ' found', bias: 'neutral' },
  ];

  const rrVals = top10.map(s => { const m = s.rrRatio.match(/1:([\d.]+)/); return m ? parseFloat(m[1]) : 0; }).filter(v => v > 0);
  const avgRR  = rrVals.length ? +(rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(1) : 0;

  const report = {
    generatedAt:     new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST',
    generatedDate:   new Date().toLocaleDateString('en-IN'),
    stocksScanned:   Object.keys(quotes).length,
    sectorsAnalysed: Object.keys(sectorChanges).length,
    avgRR,
    marketMood: {
      label:       moodLabel,
      score:       moodScore,
      description: `${bullCount} of ${allMetrics.length} Nifty 100 stocks show bullish technicals. Breadth is ${moodLabel.toLowerCase()}.`,
    },
    niftyTechnicals,
    sectors,
    setups: top10,
  };

  const outDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'setups.json'), JSON.stringify(report, null, 2));

  console.log('\n✓ data/setups.json written');
  console.log(`  Scanned: ${report.stocksScanned} | Setups: ${top10.length} | Mood: ${moodLabel} (${moodScore}) | Avg R:R: 1:${avgRR}`);
  console.log('\n  Top 3:');
  top10.slice(0, 3).forEach(s =>
    console.log(`    #${s.rank} ${s.symbol.padEnd(14)} ${s.setupType.padEnd(14)} R:R ${s.rrRatio}`)
  );
  console.log('\n  → Open http://localhost:3001 and click Refresh\n');

  return report;
}

module.exports = { buildReport };
