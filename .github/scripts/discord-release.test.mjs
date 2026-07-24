import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createPayload, sendPayload } from './discord-release.mjs';

const release = {
  name: 'Mastra 1.0',
  tag: 'v1.0.0',
  url: 'https://github.com/mastra-ai/mastra/releases/tag/v1.0.0',
  notes: '## What changed\n\n- Added a feature',
  repository: 'mastra-ai/mastra',
  timestamp: '2026-07-15T12:00:00Z',
  isTest: false,
};

test('creates a linked release embed and disables mentions', () => {
  const payload = createPayload(release);

  assert.equal(payload.username, 'Mastra Releases');
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.deepEqual(payload.embeds, [
    {
      title: 'New release: v1.0.0 — Mastra 1.0',
      url: release.url,
      description: release.notes,
      color: 7536496,
      timestamp: release.timestamp,
      footer: { text: release.repository },
    },
  ]);
});

test('clearly labels manual test notifications', () => {
  const payload = createPayload({ ...release, isTest: true });

  assert.equal(payload.embeds[0].title, 'Test release announcement: v1.0.0 — Mastra 1.0');
  assert.equal(payload.embeds[0].color, 7536496);
  assert.equal(payload.embeds[0].footer.text, 'mastra-ai/mastra • Test notification');
});

test('uses safe fallbacks and truncates long release notes', () => {
  const payload = createPayload({
    ...release,
    name: '',
    url: 'not-a-url',
    notes: 'a'.repeat(5000),
  });
  const embed = payload.embeds[0];

  assert.equal(embed.title, 'New release: v1.0.0');
  assert.equal(embed.url, release.url);
  assert.equal(Array.from(embed.description).length, 4096);
  assert.match(embed.description, /\[Read the full release notes\]\(.+\)$/);
});

test('posts the JSON payload to a webhook', async t => {
  let receivedPayload;
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
    });
    request.on('end', () => {
      receivedPayload = JSON.parse(body);
      response.writeHead(204).end();
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const payload = createPayload(release);
  const address = server.address();
  await sendPayload(`http://127.0.0.1:${address.port}`, payload);

  assert.deepEqual(receivedPayload, payload);
});

test('retries server errors before succeeding', async () => {
  let attempts = 0;
  const delays = [];
  const fetchImpl = async () => {
    attempts++;
    return attempts === 1 ? new Response('temporary failure', { status: 503 }) : new Response(null, { status: 204 });
  };

  await sendPayload('https://discord.test/webhook', createPayload(release), {
    fetchImpl,
    sleep: async delay => delays.push(delay),
  });

  assert.equal(attempts, 2);
  assert.deepEqual(delays, [500]);
});

test('honors Discord rate-limit retry timing', async () => {
  let attempts = 0;
  const delays = [];
  const fetchImpl = async () => {
    attempts++;
    return attempts === 1
      ? new Response(JSON.stringify({ retry_after: 0.25 }), { status: 429 })
      : new Response(null, { status: 204 });
  };

  await sendPayload('https://discord.test/webhook', createPayload(release), {
    fetchImpl,
    sleep: async delay => delays.push(delay),
  });

  assert.equal(attempts, 2);
  assert.deepEqual(delays, [250]);
});
