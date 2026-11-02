import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const path = '.env.gateway.local';
if (!existsSync(path)) {
  writeFileSync(path, `OLLAMA_GATEWAY_TOKEN=${randomBytes(32).toString('hex')}\nOLLAMA_BASE_URL=http://127.0.0.1:11434\nOLLAMA_MODEL=qwen3.5:4b\nOLLAMA_GATEWAY_PORT=11435\n`, { mode: 0o600 });
  console.log('Created .env.gateway.local. Keep this file private.');
} else {
  process.loadEnvFile(path);
  if (!process.env.OLLAMA_GATEWAY_TOKEN || process.env.OLLAMA_GATEWAY_TOKEN.length < 32) {
    throw new Error('Set a random OLLAMA_GATEWAY_TOKEN of at least 32 characters in .env.gateway.local.');
  }
  console.log('Existing gateway settings preserved.');
}
