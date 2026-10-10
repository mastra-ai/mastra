import { request as httpRequest } from 'node:http';
import type { ClientRequest, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  reserve: vi.fn(async (_runId: string, _owner: string, _input: unknown) => true),
  start: vi.fn(async (_input: unknown) => ({ runId: 'new' })),
}));
vi.mock('../examples/editorial-review/provider.js', () => ({ provider: { store: { get: async () => null } } }));
vi.mock('../examples/editorial-review/mastra.js', () => ({}));
vi.mock('../examples/editorial-review/workflow.js', async () => {
  const { inputSchema } = await import('../examples/editorial-review/input.js');
  return {
    inputSchema,
    reviewMode: 'deterministic',
    editorialReview: { id: 'uploads', createRun: async () => ({ startAsync: calls.start }) },
  };
});
import { createExampleServer } from '../examples/editorial-review/http.js';
import { inputLimits, inputSchema } from '../examples/editorial-review/input.js';
import { defaultUploadLimits, uploadLimitsFromEnv } from '../examples/editorial-review/uploads.js';

const servers: Server[] = [];
const clients: ClientRequest[] = [];
const tokens: Record<string, string> = {
  alice: 'alice-local-token-123',
  bob: 'bob-local-token-12345',
  carol: 'carol-local-token-123',
  ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`owner-${i}`, `owner-${i}-local-token-only`])),
};
type Limits = { maxBytes?: number; timeoutMs?: number; maxConcurrent?: number; maxPerOwner?: number };

afterEach(async () => {
  for (const client of clients.splice(0)) client.destroy();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  calls.reserve.mockClear();
  calls.start.mockClear();
});

async function start(limits: Limits = {}) {
  const server = createExampleServer(tokens, { reserve: calls.reserve, close: async () => {} }, limits);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (owner: keyof typeof tokens = 'alice', body = JSON.stringify({ draft: 'valid' })) =>
    fetch(base + '/api/jobs', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens[owner]}` },
      body,
    });
  const upload = (owner: keyof typeof tokens = 'alice', headers: Record<string, string> = {}, deadlineMs = 1000) => {
    let resolve!: (value: { status: number; body: string; retryAfter?: string }) => void;
    const result = new Promise<{ status: number; body: string; retryAfter?: string }>(done => {
      resolve = done;
    });
    const request = httpRequest(
      base + '/api/jobs',
      { method: 'POST', agent: false, headers: { authorization: `Bearer ${tokens[owner]}`, ...headers } },
      response => {
        let body = '';
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode!, body, retryAfter: response.headers['retry-after'] }),
        );
      },
    );
    request.on('error', () => resolve({ status: 0, body: 'Connection closed without a response' }));
    // Bound failing baseline tests too, without relying on the server's timeout.
    const deadline = setTimeout(() => request.destroy(new Error('Test deadline')), deadlineMs);
    void result.finally(() => clearTimeout(deadline));
    clients.push(request);
    return { request, result };
  };
  const hold = async (owner: keyof typeof tokens) => {
    let closed!: Promise<void>;
    const received = new Promise<void>(resolve =>
      server.once('request', request => {
        closed = new Promise<void>(done => request.once('close', done));
        request.once('data', () => resolve());
      }),
    );
    const pending = upload(owner, { 'transfer-encoding': 'chunked' });
    pending.request.write('{');
    await received;
    return { ...pending, closed };
  };
  return { server, base, post, upload, hold };
}

it('preserves UTF-8 characters split across HTTP chunks and accepts the exact byte limit', async () => {
  const draft = 'Café 🌍 漢字';
  const bytes = Buffer.from(JSON.stringify({ draft }));
  const h = await start({ maxBytes: bytes.length });
  const { request, result } = h.upload('alice', { 'transfer-encoding': 'chunked' });
  const split = bytes.indexOf(Buffer.from('🌍')) + 1;
  request.write(bytes.subarray(0, split));
  await delay(20);
  request.end(bytes.subarray(split));
  expect((await result).status).toBe(202);
  expect(calls.reserve.mock.calls[0]?.[2]).toEqual(inputSchema.parse({ draft }));
  expect(calls.start).toHaveBeenCalledWith({ inputData: inputSchema.parse({ draft }) });
});

it.each([
  ['ASCII', 'a'.repeat(inputLimits.draft)],
  ['Chinese', '界'.repeat(inputLimits.draft)],
  ['emoji', '😀'.repeat(inputLimits.draft / 2)],
])('accepts the advertised maximum %s draft with maximum criteria', async (_name, draft) => {
  const h = await start();
  const input = { draft, criteria: '界'.repeat(inputLimits.criteria), demoFailure: false };
  expect(inputSchema.safeParse(input).success).toBe(true);
  expect((await h.post('alice', JSON.stringify(input))).status).toBe(202);
  expect(calls.start).toHaveBeenCalledWith({ inputData: input });
});

it('accepts maximum fields encoded entirely as JSON Unicode escapes', async () => {
  const h = await start();
  const body =
    '{"draft":"' +
    '\\u754c'.repeat(inputLimits.draft) +
    '","criteria":"' +
    '\\u754c'.repeat(inputLimits.criteria) +
    '","demoFailure":false,"runId":"17768073-c7ad-4317-815f-cad876b057de"}';
  expect((await h.post('alice', body)).status).toBe(202);
  expect(calls.start).toHaveBeenCalledWith({ inputData: inputSchema.parse(JSON.parse(body)) });
});

it('rejects oversized Content-Length before waiting for the body or reserving a job', async () => {
  const h = await start();
  const pending = h.upload('alice', { 'content-length': String(defaultUploadLimits.maxBytes + 1) });
  pending.request.flushHeaders();
  expect((await pending.result).status).toBe(413);
  expect(calls.reserve).not.toHaveBeenCalled();
  expect(calls.start).not.toHaveBeenCalled();
});

it('accepts exactly the default byte budget and rejects one extra byte', async () => {
  const h = await start();
  const body = JSON.stringify({ draft: 'valid' }).padEnd(defaultUploadLimits.maxBytes, ' ');
  const accepted = await h.post('alice', body);
  expect(accepted.status).toBe(202);
  await accepted.text();
  const received = new Promise<void>(resolve =>
    h.server.once('request', request => {
      let bytes = 0;
      request.on('data', chunk => {
        bytes += chunk.length;
        if (bytes === Buffer.byteLength(body)) resolve();
      });
    }),
  );
  const pending = h.upload('alice', { 'transfer-encoding': 'chunked' });
  pending.request.write(body);
  await received;
  pending.request.end(' ');
  expect((await pending.result).status).toBe(413);
  expect(calls.reserve).toHaveBeenCalledTimes(1);
});

it.each([
  { draft: 'a'.repeat(inputLimits.draft + 1) },
  { draft: 'valid', criteria: 'a'.repeat(inputLimits.criteria + 1) },
])('still rejects schema-invalid input before admission', async input => {
  const h = await start();
  expect((await h.post('alice', JSON.stringify(input))).status).toBe(400);
  expect(calls.reserve).not.toHaveBeenCalled();
});

it('rejects malformed UTF-8 instead of silently changing draft content and frees the slot', async () => {
  const h = await start({ maxPerOwner: 1 });
  const pending = h.upload();
  pending.request.end(Buffer.concat([Buffer.from('{"draft":"'), Buffer.from([0xc3, 0x28]), Buffer.from('"}')]));
  expect((await pending.result).status).toBe(400);
  expect(calls.reserve).not.toHaveBeenCalled();
  expect((await h.post()).status).toBe(202);
});

it('serves the same input contract to the browser that the schema enforces', async () => {
  const h = await start();
  const response = await fetch(h.base + '/api/config', { headers: { authorization: `Bearer ${tokens.alice}` } });
  expect((await response.json()).inputLimits).toEqual(inputLimits);
});

it('handles the default owner/global saturation, then repeated full-size bursts without leaking slots', async () => {
  const h = await start();
  const held: Awaited<ReturnType<typeof h.hold>>[] = [];
  held.push(await h.hold('owner-0'), await h.hold('owner-0'));
  expect((await h.post('owner-0')).status).toBe(429);
  for (let i = 1; i < 8; i++) held.push(await h.hold(`owner-${i}`), await h.hold(`owner-${i}`));
  expect((await h.post('owner-8')).status).toBe(429);
  expect((await fetch(h.base + '/healthz')).status).toBe(200);
  expect(calls.reserve).not.toHaveBeenCalled();
  for (const pending of held) pending.request.end('"draft":"valid"}');
  expect((await Promise.all(held.map(pending => pending.result))).map(result => result.status)).toEqual(
    Array(16).fill(202),
  );
  const body = JSON.stringify({ draft: '界'.repeat(inputLimits.draft), criteria: '界'.repeat(inputLimits.criteria) });
  for (let wave = 0; wave < 4; wave++) {
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => h.post(`owner-${i}`, body)));
    expect(results.map(result => result.status)).toEqual(Array(16).fill(202));
    await Promise.all(results.map(result => result.text()));
  }
  expect(calls.reserve).toHaveBeenCalledTimes(80);
});

it('accepts a worst-case escaped draft at 32 KiB/s under the actual default deadline', async () => {
  const h = await start();
  const body = Buffer.from(
    '{"draft":"' +
      '\\u754c'.repeat(inputLimits.draft) +
      '","criteria":"' +
      '\\u754c'.repeat(inputLimits.criteria) +
      '"}',
  );
  const pending = h.upload('alice', { 'transfer-encoding': 'chunked' }, 35_000);
  const started = performance.now();
  for (let offset = 0; offset < body.length; offset += 8192) {
    const targetMs = (offset / (32 * 1024)) * 1000;
    await delay(Math.max(0, targetMs - (performance.now() - started)));
    pending.request.write(body.subarray(offset, offset + 8192));
  }
  pending.request.end();
  expect((await pending.result).status).toBe(202);
  expect(calls.start).toHaveBeenCalledWith({ inputData: inputSchema.parse(JSON.parse(body.toString())) });
  expect(performance.now() - started).toBeGreaterThan(15_000);
}, 40_000);

it('configures deploy-time upload policy while preserving the input byte contract', () => {
  expect(
    uploadLimitsFromEnv({ UPLOAD_TIMEOUT_MS: '45000', UPLOAD_MAX_CONCURRENT: '32', UPLOAD_MAX_PER_OWNER: '4' }),
  ).toEqual({ ...defaultUploadLimits, timeoutMs: 45_000, maxConcurrent: 32, maxPerOwner: 4 });
});

it.each(['', '0', '-1', '1.5', 'Infinity', '9007199254740992', '2147483648'])(
  'rejects invalid or overflowing upload deadlines (%s) at startup',
  value => {
    expect(() => uploadLimitsFromEnv({ UPLOAD_TIMEOUT_MS: value })).toThrow();
  },
);

it('counts raw bytes for chunked uploads and closes an oversized upload', async () => {
  const h = await start({ maxBytes: 32 });
  const pending = h.upload('alice', { 'transfer-encoding': 'chunked' });
  pending.request.write(Buffer.alloc(16, 'x'));
  await delay(10);
  pending.request.write(Buffer.alloc(17, 'x'));
  expect((await pending.result).status).toBe(413);
  expect(calls.reserve).not.toHaveBeenCalled();
  expect((await h.post()).status).toBe(202);
});

it('bounds uploads per owner while other owners and authenticated reads remain available', async () => {
  const h = await start({ maxPerOwner: 1, maxConcurrent: 2 });
  await h.hold('alice');
  const denied = await h.post();
  expect(denied.status).toBe(429);
  expect(denied.headers.get('retry-after')).toBeTruthy();
  expect(calls.reserve).not.toHaveBeenCalled();
  expect((await fetch(h.base + '/api/config', { headers: { authorization: `Bearer ${tokens.alice}` } })).status).toBe(
    200,
  );
  expect((await h.post('bob')).status).toBe(202);
});

it('bounds uploads globally across owners and releases an aborted upload slot', async () => {
  const h = await start({ maxPerOwner: 1, maxConcurrent: 2 });
  const alice = await h.hold('alice');
  await h.hold('bob');
  expect((await h.post('carol')).status).toBe(429);
  expect(calls.reserve).not.toHaveBeenCalled();
  alice.request.destroy();
  await alice.closed;
  expect((await h.post('carol')).status).toBe(202);
});

it('uses an absolute upload deadline even while bytes keep arriving, then frees the slot', async () => {
  const h = await start({ timeoutMs: 80, maxPerOwner: 1 });
  const pending = await h.hold('alice');
  const trickle = setInterval(() => pending.request.write(' '), 10);
  try {
    expect((await pending.result).status).toBe(408);
    expect(calls.reserve).not.toHaveBeenCalled();
  } finally {
    clearInterval(trickle);
  }
  expect((await h.post()).status).toBe(202);
});

it('releases upload slots on malformed JSON and successful bodies without changing admission', async () => {
  const h = await start({ maxPerOwner: 1 });
  expect((await h.post('alice', '{')).status).toBe(400);
  expect(calls.reserve).not.toHaveBeenCalled();
  expect((await h.post()).status).toBe(202);
  expect((await h.post()).status).toBe(202);
  expect(calls.reserve).toHaveBeenCalledTimes(2);
});
