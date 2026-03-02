const fs = require('fs');
const path = require('path');
const { buildReport } = require('./analyse.js');
const { execSync } = require('child_process');

function run() {
  console.log('--- PULSTA Main Analysis Pipeline ---');

  // 1. Sync history_temp.json to histdata/ folder
  console.log('Step 1: Syncing historical data...');
  const history = JSON.parse(fs.readFileSync('history_temp.json', 'utf8'));
  const histDir = path.join(__dirname, 'histdata');
  if (!fs.existsSync(histDir)) fs.mkdirSync(histDir);

  for (const [symbol, data] of Object.entries(history)) {
    fs.writeFileSync(path.join(histDir, `${symbol}.json`), JSON.stringify(data, null, 2));
  }
  console.log(`   - Synced ${Object.keys(history).length} symbols to ${histDir}`);

  // 2. Run Strategy Checks
  console.log('Step 2: Running strategy checks...');
  try {
    execSync('node strategy-checks.js', { stdio: 'inherit' });
  } catch (e) {
    console.error('   - Strategy checks failed, but continuing...');
  }

  // 3. Run Main Analysis Report
  console.log('Step 3: Generating setups report...');
  const quotes = JSON.parse(fs.readFileSync('quotes_temp.json', 'utf8'));
  buildReport({ quotes, history });

  console.log('--- ALL STEPS COMPLETE ---');
}

run();
