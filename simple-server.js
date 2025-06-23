console.log('Starting simple server...');

const express = require('express');
console.log('Express loaded');

const app = express();
const PORT = 3002;

console.log('Setting up routes...');

app.get('/', (req, res) => {
  console.log('Root route hit');
  res.json({ message: 'Simple server is working!' });
});

app.get('/api/health', (req, res) => {
  console.log('Health route hit');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

console.log('About to start server...');

app.listen(PORT, () => {
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
});

console.log('Server setup complete'); 