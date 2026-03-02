require('dotenv').config();
const KiteConnect = require('kiteconnect').KiteConnect;
const fs = require('fs');
const path = require('path');

const api_key = process.env.KITE_API_KEY;
const access_token = process.env.KITE_ACCESS_TOKEN;

if (!api_key || !access_token) {
  console.error('❌ Missing KITE_API_KEY or KITE_ACCESS_TOKEN in .env');
  process.exit(1);
}

const kc = new KiteConnect({ api_key });
kc.setAccessToken(access_token);

const symbols = [
  "NSE:RELIANCE", "NSE:TCS", "NSE:HDFCBANK", "NSE:ICICIBANK", "NSE:INFY",
  "NSE:HINDUNILVR", "NSE:SBIN", "NSE:ITC", "NSE:BAJFINANCE", "NSE:BHARTIARTL",
  "NSE:KOTAKBANK", "NSE:LT", "NSE:AXISBANK", "NSE:ASIANPAINT", "NSE:MARUTI",
  "NSE:SUNPHARMA", "NSE:TITAN", "NSE:WIPRO", "NSE:ULTRACEMCO", "NSE:NESTLEIND",
  "NSE:TECHM", "NSE:HCLTECH", "NSE:POWERGRID", "NSE:NTPC", "NSE:TATAMOTORS",
  "NSE:ONGC", "NSE:JSWSTEEL", "NSE:TATASTEEL", "NSE:ADANIENT", "NSE:ADANIPORTS",
  "NSE:BAJAJFINSV", "NSE:BAJAJ-AUTO", "NSE:BPCL", "NSE:BRITANNIA", "NSE:CIPLA",
  "NSE:COALINDIA", "NSE:DIVISLAB", "NSE:DRREDDY", "NSE:EICHERMOT", "NSE:GRASIM",
  "NSE:HDFCLIFE", "NSE:HEROMOTOCO", "NSE:HINDALCO", "NSE:INDUSINDBK", "NSE:NAUKRI",
  "NSE:IOC", "NSE:IRCTC", "NSE:LTIM", "NSE:M&M", "NSE:MCDOWELL-N", "NSE:PIDILITIND",
  "NSE:SBILIFE", "NSE:SHREECEM", "NSE:SIEMENS", "NSE:TATACONSUM", "NSE:VEDL",
  "NSE:ZOMATO", "NSE:DMART"
];

async function fetchHistory() {
  try {
    console.log('Fetching instrument tokens...');
    const quotes = await kc.getQuote(symbols);
    
    const histDir = path.join(__dirname, 'histdata');
    if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });

    const to_date = new Date();
    const from_date = new Date();
    from_date.setDate(from_date.getDate() - 365);

    console.log(`Fetching 365-day history for ${symbols.length} symbols...`);

    for (const sym of symbols) {
      const token = quotes[sym].instrument_token;
      if (!token) {
        console.error(`No token for ${sym}`);
        continue;
      }
      
      // Rate limiting: 3 req/sec max usually. Sleep 400ms to be safe.
      await new Promise(r => setTimeout(r, 400)); 

      try {
        const history = await kc.getHistoricalData(token, 'day', from_date, to_date);
        const cleanSym = sym.split(':')[1];
        fs.writeFileSync(path.join(histDir, `${cleanSym}.json`), JSON.stringify(history, null, 2));
        console.log(`✓ ${cleanSym} (${history.length} candles)`);
      } catch (e) {
        console.error(`❌ Failed ${sym}: ${e.message}`);
      }
    }
    console.log('✅ History fetch complete.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

fetchHistory();