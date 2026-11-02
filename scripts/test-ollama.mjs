import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ollamaChat } from '../app/lib/ollama.ts';

test('sends image bytes and chat history to Ollama without cloud credentials', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/api\/chat$/);
    const body = JSON.parse(options.body);
    assert.equal(body.stream, false);
    assert.equal(body.think, false);
    assert.equal(body.format, 'json');
    assert.deepEqual(body.messages, [
      { role: 'system', content: 'Mongolian only' },
      { role: 'user', content: 'Describe this food', images: ['aGVsbG8='] },
    ]);
    assert.equal(body.options.num_predict, 100);
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ message: { content: '  Хоол  ' } });
  };
  try {
    assert.equal(await ollamaChat({ max_tokens: 100, json: true, messages: [
      { role: 'system', content: 'Mongolian only' },
      { role: 'user', content: [
        { type: 'text', text: 'Describe this food' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' } },
      ] },
    ] }), 'Хоол');
  } finally { globalThis.fetch = original; }
});

test('reports a stopped Ollama service as 503', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try {
    await assert.rejects(ollamaChat({ messages: [], max_tokens: 10 }), { status: 503 });
  } finally { globalThis.fetch = original; }
});

test('gives model installation instructions when model is missing', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'model not found' }, { status: 404 });
  try {
    await assert.rejects(ollamaChat({ messages: [], max_tokens: 10 }), (error) =>
      error.status === 503 && error.message.includes('ollama pull'),
    );
  } finally { globalThis.fetch = original; }
});
