console.log('Express test starting...');

const express = require('express');
const app = express();
const PORT = 3002;

console.log('Express loaded successfully');

app.get('/', (req, res) => {
  console.log('Root route hit');
  res.json({ message: 'Express is working!' });
});

app.get('/api/health', (req, res) => {
  console.log('Health route hit');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

console.log('About to start Express server...');

app.listen(PORT, () => {
  console.log(`✅ Express server running on port ${PORT}`);
  console.log(`🌐 Test URL: http://localhost:${PORT}`);
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
});

console.log('Express test setup complete'); 