const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/cheeses/clear',
  method: 'POST',
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk.toString());
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', (error) => console.error('Error:', error));
req.end();
