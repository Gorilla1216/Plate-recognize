import { readFileSync } from 'node:fs';
import { ollamaChat } from '../app/lib/ollama.ts';

if (!process.env.OLLAMA_GATEWAY_URL || !process.env.OLLAMA_GATEWAY_TOKEN) {
  throw new Error('Load .env.hosting.local to check the remote gateway.');
}
const denied = await fetch(`${process.env.OLLAMA_GATEWAY_URL}/api/chat`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
});
if (denied.status !== 401) throw new Error(`Expected unauthenticated HTTP 401, received ${denied.status}.`);
console.log('Unauthenticated inference: HTTP 401 (correct).');
const ingredients = await ollamaChat({
  max_tokens: 200, json: true,
  messages: [{ role: 'user', content: 'List the usual ingredients of pasta carbonara in English. Return JSON with an ingredients array.' }],
});
if (!Array.isArray(JSON.parse(ingredients).ingredients)) throw new Error('Invalid ingredient response.');
console.log('Authenticated text inference:', ingredients);
const summary = await ollamaChat({
  max_tokens: 250,
  messages: [{ role: 'user', content: [
    { type: 'text', text: 'Describe this food in one sentence in English. Do not guess hidden ingredients.' },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${readFileSync('public/demo-pasta.jpg').toString('base64')}` } },
  ] }],
});
console.log('Authenticated image inference:', summary);
