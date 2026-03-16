const http = require('http');

const data = JSON.stringify({
  urls: [
    'https://en.wikipedia.org/wiki/Cheddar_cheese',
    'https://en.wikipedia.org/wiki/Gouda_cheese'
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/import',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
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
