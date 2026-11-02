import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MAX_BODY = 6 * 1024 * 1024;
const MAX_IMAGE = 4 * 1024 * 1024;
const digest = (value) => createHash('sha256').update(value).digest();

export function createGateway({ token, baseUrl = 'http://127.0.0.1:11434', model = 'qwen3.5:4b', fetchImpl = fetch } = {}) {
  if (!token || token.length < 32) throw new Error('OLLAMA_GATEWAY_TOKEN must contain at least 32 characters.');
  const expected = digest(`Bearer ${token}`);
  let busy = false;
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    if (req.url !== '/api/chat') return send(404, { error: 'Not found.' });
    if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
    if (!timingSafeEqual(digest(req.headers.authorization || ''), expected)) {
      return send(401, { error: 'Unauthorized.' });
    }
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Use application/json.' });
    if (Number(req.headers['content-length']) > MAX_BODY) return send(413, { error: 'Request exceeds 6 MiB.' });
    if (busy) {
      res.setHeader('Retry-After', '5');
      return send(429, { error: 'The local model is busy. Try again shortly.' });
    }
    busy = true;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return send(413, { error: 'Request exceeds 6 MiB.' });
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return send(400, { error: 'Invalid JSON.' }); }
      if (!Array.isArray(body?.messages) || !body.messages.length || body.messages.length > 13) {
        return send(400, { error: 'Provide between 1 and 13 messages.' });
      }
      const messages = [];
      let imageCount = 0;
      for (const message of body.messages) {
        if (!message || !['system', 'user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' || message.content.length > 16000) {
          return send(400, { error: 'Invalid message.' });
        }
        const clean = { role: message.role, content: message.content };
        if (message.images !== undefined) {
          if (!Array.isArray(message.images)) return send(400, { error: 'Invalid images.' });
          for (const image of message.images) {
            if (++imageCount > 1 || typeof image !== 'string' || !image.length ||
              image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) ||
              Buffer.byteLength(image, 'base64') > MAX_IMAGE) {
              return send(400, { error: 'Use one base64 image, no larger than 4 MiB.' });
            }
          }
          clean.images = message.images;
        }
        messages.push(clean);
      }
      const requested = body.options?.num_predict;
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages, stream: false,
          ...(model.startsWith('qwen') ? { think: false } : {}),
          ...(body.format === 'json' ? { format: 'json' } : {}),
          options: { num_predict: Number.isInteger(requested) ? Math.min(1600, Math.max(1, requested)) : 800, num_ctx: 4096, temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(50_000),
        redirect: 'error',
      });
      if (!response.ok) return send(503, { error: 'Ollama could not complete the request. Check the local service and model.' });
      const data = await response.json();
      if (typeof data.message?.content !== 'string' || !data.message.content.trim()) {
        return send(502, { error: 'Ollama returned an empty response.' });
      }
      send(200, { message: { role: 'assistant', content: data.message.content } });
    } catch (error) {
      const timeout = /timeout|abort/i.test(error?.name || '');
      send(timeout ? 504 : 503, { error: timeout ? 'Local inference timed out.' : 'Local inference is unavailable.' });
    } finally { busy = false; }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.OLLAMA_GATEWAY_PORT || 11435);
  const server = createGateway({ token: process.env.OLLAMA_GATEWAY_TOKEN, baseUrl: process.env.OLLAMA_BASE_URL, model: process.env.OLLAMA_MODEL });
  server.requestTimeout = 100_000;
  server.headersTimeout = 15_000;
  server.listen(port, '127.0.0.1', () => console.log(`Authenticated Ollama gateway: http://127.0.0.1:${port}`));
}
