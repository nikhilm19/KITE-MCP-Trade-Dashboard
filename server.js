require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.static(path.join(__dirname, 'public'), { index: 'dashboard.html' }));
app.use(express.json());

app.get('/api/status', (req, res) => {
  const file = path.join(__dirname, 'data', 'setups.json');
  if (!fs.existsSync(file)) return res.json({ ready: false, lastUpdated: null });
  const stat = fs.statSync(file);
  res.json({ ready: true, lastUpdated: stat.mtime });
});

app.get('/api/setups', (req, res) => {
  const file = path.join(__dirname, 'data', 'setups.json');
  if (!fs.existsSync(file)) {
    return res.status(404).json({
      error: 'No data yet. Paste prompt.md into VS Code Claude Chat to run the analysis.'
    });
  }
  try {
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse setups.json: ' + e.message });
  }
});

app.get('/api/strategies', (req, res) => {
  const file = path.join(__dirname, 'data', 'strategies.json');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No strategies data yet.' });
  try {
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse strategies.json: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log('\n  PULSTA running → http://localhost:' + PORT);
  console.log('  Next: paste prompt.md into VS Code Claude Chat to fetch Kite data.\n');
});
