import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGateway } from './ollama-gateway.mjs';

const token = 'test-token-for-gateway-not-a-real-secret-1234';
async function withGateway(fetchImpl, run) {
  const server = createGateway({ token, fetchImpl });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, authorization = `Bearer ${token}`, path = '/api/chat') => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization }, body: JSON.stringify(body),
  });
  try { await run({ post, base }); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

test('authentication and route restrictions prevent unauthorized Ollama access', async () => {
  let calls = 0;
  await withGateway(async () => { calls++; }, async ({ post, base }) => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await post({}, '')).status, 401);
    assert.equal((await post({}, 'Bearer wrong')).status, 401);
    assert.equal((await post({}, `Bearer ${token}`, '/api/pull')).status, 404);
    assert.equal(calls, 0);
  });
});

test('pins the model and limits caller options while forwarding image data and JSON mode', async () => {
  await withGateway(async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'qwen3.5:4b');
    assert.equal(body.options.num_predict, 1600);
    assert.equal(body.options.num_ctx, 4096);
    assert.equal(body.stream, false);
    assert.equal(body.think, false);
    assert.equal(body.format, 'json');
    assert.deepEqual(body.messages[0].images, ['aGVsbG8=']);
    return Response.json({ message: { content: '{"ingredients":["pasta"]}' }, internal: 'not forwarded' });
  }, async ({ post }) => {
    const response = await post({ model: 'untrusted-model', options: { num_predict: 99999, num_ctx: 100000 }, format: 'json', messages: [{ role: 'user', content: 'Food?', images: ['aGVsbG8='] }] });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { message: { role: 'assistant', content: '{"ingredients":["pasta"]}' } });
  });
});

test('rejects malformed messages and oversized images before inference', async () => {
  await withGateway(async () => { assert.fail('must not call Ollama'); }, async ({ post }) => {
    assert.equal((await post({ messages: [{ role: 'admin', content: 'hello' }] })).status, 400);
    assert.equal((await post({ messages: [{ role: 'user', content: 'hello', images: [Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64')] }] })).status, 400);
    assert.equal((await post({ messages: [{ role: 'user', content: 'hello', images: ['not base64'] }] })).status, 400);
  });
});

test('rejects concurrent inference instead of queuing unbounded GPU work', async () => {
  let release;
  let started;
  const waiting = new Promise((resolve) => { started = resolve; });
  await withGateway(async () => {
    started();
    await new Promise((resolve) => { release = resolve; });
    return Response.json({ message: { content: 'done' } });
  }, async ({ post }) => {
    const first = post({ messages: [{ role: 'user', content: 'hello' }] });
    await waiting;
    try { assert.equal((await post({ messages: [{ role: 'user', content: 'again' }] })).status, 429); }
    finally { release(); await first; }
  });
});
