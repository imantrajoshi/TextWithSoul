import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

console.log('Testing Hume API key...');
console.log('Key (first 8 chars):', process.env.HUME_API_KEY?.substring(0, 8) + '...');

const ws = new WebSocket(`wss://api.hume.ai/v0/stream/models?apikey=${process.env.HUME_API_KEY}`);

const timeout = setTimeout(() => {
  console.log('❌ Timeout — no response from Hume in 10s');
  ws.close();
  process.exit(1);
}, 10000);

ws.on('open', () => {
  console.log('✅ Hume WebSocket connected successfully!');
  clearTimeout(timeout);
  ws.close();
  process.exit(0);
});

ws.on('unexpected-response', (req, res) => {
  console.log(`❌ Hume rejected the connection: HTTP ${res.statusCode}`);
  clearTimeout(timeout);
  process.exit(1);
});

ws.on('error', (err) => {
  console.log('❌ Hume connection error:', err.message);
  clearTimeout(timeout);
  process.exit(1);
});
