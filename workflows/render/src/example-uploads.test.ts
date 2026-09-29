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
  const { z } = await import('zod');
  return {
    inputSchema: z.object({ draft: z.string().min(1) }),
    reviewMode: 'deterministic',
    editorialReview: { id: 'uploads', createRun: async () => ({ startAsync: calls.start }) },
  };
});
import { createExampleServer } from '../examples/editorial-review/http.js';

const servers: Server[] = [];
const clients: ClientRequest[] = [];
const tokens = { alice: 'alice-local-token-123', bob: 'bob-local-token-12345', carol: 'carol-local-token-123' };
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
  // The extra argument is ignored on the baseline, so regressions run before the fix.
  const create = createExampleServer as (...args: unknown[]) => ReturnType<typeof createExampleServer>;
  const server = create(tokens, { reserve: calls.reserve, close: async () => {} }, limits);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (owner: keyof typeof tokens = 'alice', body = JSON.stringify({ draft: 'valid' })) =>
    fetch(base + '/api/jobs', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens[owner]}` },
      body,
    });
  const upload = (owner: keyof typeof tokens = 'alice', headers: Record<string, string> = {}) => {
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
    const deadline = setTimeout(() => request.destroy(new Error('Test deadline')), 1000);
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
  expect(calls.reserve.mock.calls[0]?.[2]).toEqual({ draft });
  expect(calls.start).toHaveBeenCalledWith({ inputData: { draft } });
});

it('rejects oversized Content-Length before waiting for the body or reserving a job', async () => {
  const h = await start();
  const pending = h.upload('alice', { 'content-length': '200001' });
  pending.request.flushHeaders();
  expect((await pending.result).status).toBe(413);
  expect(calls.reserve).not.toHaveBeenCalled();
  expect(calls.start).not.toHaveBeenCalled();
});

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
