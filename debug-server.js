const express = require('express');
const app = express();
const PORT = 3000;

console.log('Starting debug server...');

// Test basic Express setup
app.get('/test', (req, res) => {
  res.json({ message: 'Basic Express is working' });
});

console.log('Testing route imports...');

// Test each route import individually
try {
  console.log('Testing canvas route...');
  const canvasRoute = require('./routes/canvas');
  console.log('✅ Canvas route loaded successfully');
} catch (error) {
  console.error('❌ Canvas route failed:', error.message);
}

try {
  console.log('Testing sections route...');
  const sectionsRoute = require('./routes/sections');
  console.log('✅ Sections route loaded successfully');
} catch (error) {
  console.error('❌ Sections route failed:', error.message);
}

try {
  console.log('Testing allocations route...');
  const allocationsRoute = require('./routes/allocations');
  console.log('✅ Allocations route loaded successfully');
} catch (error) {
  console.error('❌ Allocations route failed:', error.message);
}

console.log('Starting server...');

app.listen(PORT, () => {
  console.log(`🚀 Debug server running on port ${PORT}`);
  console.log(`🌐 Test URL: http://localhost:${PORT}/test`);
});

// Export for Vercel
module.exports = app; 