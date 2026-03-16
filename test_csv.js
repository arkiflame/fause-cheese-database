const http = require('http');

const data = JSON.stringify({
  cheeses: [
    { name: 'Gouda', origin: 'Netherlands', milk: 'Cow', description: 'A mild yellow cheese.' },
    { name: 'Camembert', origin: 'France', milk: 'Cow', description: 'A soft, creamy, surface-ripened cow milk cheese.' }
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/import/csv',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk.toString());
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (error) => console.error('Error:', error));
req.write(data);
req.end();
