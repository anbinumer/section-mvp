console.log('Progressive server test starting...');

const express = require('express');
const app = express();
const PORT = 3000;

console.log('✅ Express loaded');

try {
  console.log('Testing cors...');
  const cors = require('cors');
  app.use(cors({ origin: true, credentials: true }));
  console.log('✅ CORS loaded');
} catch (error) {
  console.error('❌ CORS failed:', error.message);
}

try {
  console.log('Testing helmet...');
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
      },
    },
  }));
  console.log('✅ Helmet loaded');
} catch (error) {
  console.error('❌ Helmet failed:', error.message);
}

try {
  console.log('Testing morgan...');
  const morgan = require('morgan');
  app.use(morgan('combined'));
  console.log('✅ Morgan loaded');
} catch (error) {
  console.error('❌ Morgan failed:', error.message);
}

try {
  console.log('Testing rate-limit...');
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use(limiter);
  console.log('✅ Rate limit loaded');
} catch (error) {
  console.error('❌ Rate limit failed:', error.message);
}

try {
  console.log('Testing dotenv...');
  require('dotenv').config();
  console.log('✅ Dotenv loaded');
} catch (error) {
  console.error('❌ Dotenv failed:', error.message);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

console.log('Setting up routes...');

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check hit');
  res.json({
    status: 'healthy',
    service: 'Canvas Section Manager (Progressive)',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Serve main application
app.get('/', (req, res) => {
  console.log('Root route hit');
  res.json({ message: 'Canvas Section Manager is running!' });
});

console.log('About to start server...');

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Progressive server running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
});

console.log('Progressive server setup complete');

// Export the app for Vercel
module.exports = app; 