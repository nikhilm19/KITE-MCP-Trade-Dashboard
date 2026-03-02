const fs = require('fs');
const path = require('path');

const BATCHES = [
  // Batch 1 (starts with 177243546)
  { prefix: '177243546', tokens: [6401, 3861249, 60417, 1510401, 4267265, 4268801, 81153, 2714625, 134657, 140033] },
  // Batch 2 (starts with 177243547)
  { prefix: '177243547', tokens: [177665, 5215745, 2800641, 5097729, 225537, 232961, 315393, 1850625, 341249, 119553] },
  // Batch 3 (starts with 177243548)
  { prefix: '177243548', tokens: [345089, 348929, 356865, 1270529, 1346049, 408065, 1148417, 3506433, 424961, 3001089] },
  // Batch 4 (starts with 177243550)
  { prefix: '177243550', tokens: [492033, 2939649, 525825, 2815745, 2763265, 4544513, 2977281, 633601, 3153409, 3834113] },
  // Batch 5 (starts with 177243551)
  { prefix: '177243551', tokens: [738561, 5582849, 5633, 792833, 806401, 857857, 3465729, 895745, 2953217, 3465217] },
];

const TOKEN_MAP = {
  6401: 'ADANIENT', 3861249: 'ADANIPORTS', 60417: 'ASIANPAINT', 1510401: 'AXISBANK',
  4267265: 'BAJAJ-AUTO', 4268801: 'BAJAJFINSV', 81153: 'BAJFINANCE', 2714625: 'BHARTIARTL',
  134657: 'BPCL', 140033: 'BRITANNIA', 177665: 'CIPLA', 5215745: 'COALINDIA',
  2800641: 'DIVISLAB', 5097729: 'DMART', 225537: 'DRREDDY', 232961: 'EICHERMOT',
  315393: 'GRASIM', 1850625: 'HCLTECH', 341249: 'HDFCBANK', 119553: 'HDFCLIFE',
  345089: 'HEROMOTOCO', 348929: 'HINDALCO', 356865: 'HINDUNILVR', 1270529: 'ICICIBANK',
  1346049: 'INDUSINDBK', 408065: 'INFY', 424961: 'ITC', 3001089: 'JSWSTEEL',
  492033: 'KOTAKBANK', 2939649: 'LT', 525825: 'M&M', 2815745: 'MARUTI',
  2763265: 'NAUKRI', 4544513: 'NESTLEIND', 2977281: 'NTPC', 633601: 'ONGC',
  3834113: 'POWERGRID', 738561: 'RELIANCE', 5582849: 'SBILIFE', 5633: 'SBIN',
  806401: 'SIEMENS', 857857: 'SUNPHARMA', 3465729: 'TATACONSUM', 895745: 'TATASTEEL',
  2953217: 'TCS', 3465217: 'TECHM', 2952193: 'ULTRACEMCO', 784129: 'VEDL', 969473: 'WIPRO'
};

const dir = 'C:\\Users\\Nikhil\\.gemini\\tmp\\pulsta\\tool-outputs\\session-24aac8c6-1a9a-455d-95e3-8117d20c9d7f';
const files = fs.readdirSync(dir).filter(f => f.startsWith('get_historical_data_') && f.endsWith('.txt'));

const history = {};

files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  try {
    const data = JSON.parse(content);
    if (!data.output || data.output === 'Failed to get historical data') return;

    const parts = file.split('_');
    const tsFull = parts[6];
    const index = parseInt(parts[7]);

    const batch = BATCHES.find(b => tsFull.startsWith(b.prefix));
    if (batch && batch.tokens[index] !== undefined) {
      const token = batch.tokens[index];
      const symbol = TOKEN_MAP[token];
      if (symbol) {
        history[symbol] = JSON.parse(data.output);
      }
    }
  } catch (e) {}
});

fs.writeFileSync('history_temp.json', JSON.stringify(history, null, 2));
console.log(`✓ history_temp.json written with ${Object.keys(history).length} symbols`);
