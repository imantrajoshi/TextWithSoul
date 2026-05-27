import WebSocket from 'ws';

const ws = new WebSocket('wss://api.hume.ai/v0/stream/models?apikey=invalid_key');

ws.on('error', (err) => {
  console.log('Caught error:', err.message);
});

ws.on('unexpected-response', (req, res) => {
  console.log('Caught unexpected response:', res.statusCode);
});
