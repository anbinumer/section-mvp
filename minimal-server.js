const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

console.log('Setting up middleware...');

// Security middleware
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

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

console.log('Setting up routes...');

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check hit');
  res.json({
    status: 'healthy',
    service: 'Canvas Section Manager (Minimal)',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    vercel: !!process.env.VERCEL
  });
});

// Serve main application
app.get('/', (req, res) => {
  console.log('Root route hit');
  res.json({ message: 'Canvas Section Manager is running!' });
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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Canvas Section Manager (Minimal) running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
});

// Export the app for Vercel
module.exports = app; 