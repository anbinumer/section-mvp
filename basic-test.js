console.log('Basic test starting...');

const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Request received:', req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Basic HTTP server is working!' }));
});

server.listen(3001, () => {
  console.log('✅ Basic HTTP server running on port 3001');
  console.log('🌐 Test URL: http://localhost:3001');
});

console.log('Basic test setup complete'); 