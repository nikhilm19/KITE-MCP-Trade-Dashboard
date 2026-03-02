# PULSTA Advanced Daily Analysis

You have the **Kite MCP server** connected. Run the following steps in order.

---

## Step 1 — Fetch live quotes

Use the Kite MCP `get_quote` and `get_ohlc_data` tool for these NSE symbols (pass all at once):

```
NSE:RELIANCE, NSE:TCS, NSE:HDFCBANK, NSE:ICICIBANK, NSE:INFY,
NSE:HINDUNILVR, NSE:SBIN, NSE:ITC, NSE:BAJFINANCE, NSE:BHARTIARTL,
NSE:KOTAKBANK, NSE:LT, NSE:AXISBANK, NSE:ASIANPAINT, NSE:MARUTI,
NSE:SUNPHARMA, NSE:TITAN, NSE:WIPRO, NSE:ULTRACEMCO, NSE:NESTLEIND,
NSE:TECHM, NSE:HCLTECH, NSE:POWERGRID, NSE:NTPC, NSE:TATAMOTORS,
NSE:ONGC, NSE:JSWSTEEL, NSE:TATASTEEL, NSE:ADANIENT, NSE:ADANIPORTS,
NSE:BAJAJFINSV, NSE:BAJAJ-AUTO, NSE:BPCL, NSE:BRITANNIA, NSE:CIPLA,
NSE:COALINDIA, NSE:DIVISLAB, NSE:DRREDDY, NSE:EICHERMOT, NSE:GRASIM,
NSE:HDFCLIFE, NSE:HEROMOTOCO, NSE:HINDALCO, NSE:INDUSINDBK, NSE:NAUKRI,
NSE:IOC, NSE:IRCTC, NSE:LTIM, NSE:M&M, NSE:MCDOWELL-N, NSE:PIDILITIND,
NSE:SBILIFE, NSE:SHREECEM, NSE:SIEMENS, NSE:TATACONSUM, NSE:VEDL,
NSE:ZOMATO, NSE:DMART
```

---

## Step 2 — Fetch 365-day daily OHLCV history

For **each symbol** above, call the Kite MCP `get_historical_data` tool with:
- `interval`: `day`
- `from_date`: 365 days before today
- `to_date`: today

Build a `history` object: `{ SYMBOL: [ {date, open, high, low, close, volume}, ... ] }`

---

## Step 3 — Run the analysis

Open `analyse.js` from this workspace. Call:

```js
const { buildReport } = require('./analyse.js');

buildReport({
  quotes: {
    // paste the quotes data you fetched — shape:
    // RELIANCE: { ltp, change, volume, name, sector, ohlc: { open, high, low, close } }
  },
  history: {
    // paste the history data you fetched — shape:
    // RELIANCE: [ { date, open, high, low, close, volume }, ... ]
  }
});
```

This will write `data/setups.json` automatically.

---

## Step 4 — Confirm

Tell me:
1. ✓ `data/setups.json` written successfully
2. How many stocks were scored
3. Top 3 setups with symbol, setup type, and R:R ratio

Create a dashboard also for this analysis and recommednations