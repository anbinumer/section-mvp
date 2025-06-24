const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Canvas Section Manager - Canvas-Only MVP
const app = express();
const PORT = process.env.PORT || 3000;

console.log('Setting up middleware...');

// Security middleware - make it optional
try {
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
  console.log('✅ Helmet security middleware loaded');
} catch (error) {
  console.warn('⚠️ Helmet not available, skipping security middleware');
}

// Rate limiting - make it optional
try {
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use(limiter);
  console.log('✅ Rate limiting middleware loaded');
} catch (error) {
  console.warn('⚠️ Rate limiting not available, skipping');
}

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://*.vercel.app',
        'https://*.vercel.app/*',
        process.env.VERCEL_URL,
        process.env.VERCEL_URL + '/*'
      ].filter(Boolean)
    : true,
  credentials: true
}));
console.log('✅ CORS middleware loaded');

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
console.log('✅ Body parsing middleware loaded');

// Logging - make it optional
try {
  const morgan = require('morgan');
  app.use(morgan('combined'));
  console.log('✅ Morgan logging middleware loaded');
} catch (error) {
  console.warn('⚠️ Morgan not available, skipping logging middleware');
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
console.log('✅ Static file middleware loaded');

console.log('Setting up routes...');

// Routes
app.use('/api/canvas', require('./routes/canvas'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/allocations', require('./routes/allocations'));
app.use('/api/csv', require('./routes/csv'));
console.log('✅ All routes loaded');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Canvas Section Manager',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    vercel: !!process.env.VERCEL
  });
});

// Serve main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

console.log('Starting server...');

// Only start the server if we're not in a serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Canvas Section Manager (Canvas-Only) running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎨 Institution: ${process.env.INSTITUTION_NAME || 'Not specified'}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
  });
}

// Export the app for Vercel
module.exports = app; 