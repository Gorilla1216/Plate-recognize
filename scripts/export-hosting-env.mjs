import { writeFileSync } from 'node:fs';

const url = new URL(process.argv[2]);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
  throw new Error('Provide the HTTPS root URL of your gateway tunnel.');
}
if (!process.env.OLLAMA_GATEWAY_TOKEN || process.env.OLLAMA_GATEWAY_TOKEN.length < 32) {
  throw new Error('Load .env.gateway.local first.');
}
writeFileSync('.env.hosting.local', `OLLAMA_GATEWAY_URL=${url.href.replace(/\/$/, '')}\nOLLAMA_GATEWAY_TOKEN=${process.env.OLLAMA_GATEWAY_TOKEN}\nOLLAMA_MODEL=qwen3.5:4b\nOLLAMA_TIMEOUT_MS=55000\n`, { mode: 0o600 });
console.log('Hosting settings saved to .env.hosting.local. This file contains a secret; do not commit or share it.');
