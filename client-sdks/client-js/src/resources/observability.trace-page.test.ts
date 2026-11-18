import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SpanType } from '@mastra/core/observability';
import { InMemoryStore, readTracePage } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';

// Real HTTP transport and real storage: proves the paged API does not serialize IDs or cursors as GET parameters.
describe('legacy and paged trace reads over HTTP', () => {
  const storage = new InMemoryStore();
  let client: MastraClient;
  let failures: (number | 'disconnect')[] = [];
  let requests: unknown[] = [];
  const makeClient = (retries?: number) =>
    new MastraClient({
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      retries,
      backoffMs: 1,
    });
  const server = createServer(async (req, res) => {
    try {
      expect(req.url).toBe(
        req.method === 'GET' ? '/api/observability/traces/trace' : '/api/observability/traces/trace/page',
      );
      const store = (await storage.getStore('observability'))!;
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      requests.push(body);
      const failure = failures.shift();
      if (failure === 'disconnect') {
        req.socket.destroy();
        return;
      }
      if (failure) {
        res.writeHead(failure).end(JSON.stringify({ error: 'Request failed' }));
        return;
      }
      const result =
        req.method === 'GET'
          ? await store.getTrace({ traceId: 'trace' })
          : await readTracePage(
              {
                scopeKey: 'test-backend',
                structure: async () => (await store.getStructure({ traceId: 'trace' }))?.spans ?? null,
                spans: async (_, spanIds) => (await store.getSpans({ traceId: 'trace', spanIds })).spans,
              },
              'trace',
              body,
            );
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500).end(JSON.stringify({ error: String(error) }));
    }
  });
  beforeAll(async () => {
    const store = (await storage.getStore('observability'))!;
    await store.batchCreateSpans({
      records: ['a', 'b'].map(spanId => ({
        traceId: 'trace',
        spanId,
        name: spanId,
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt: new Date('2026-11-01'),
        input: { value: spanId },
      })),
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    client = makeClient(0);
  });
  beforeEach(() => {
    failures = [];
    requests = [];
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });
  it('keeps legacy GET responses and reads bounded pages through POST', async () => {
    expect((await client.getTrace('trace')).spans.map(span => span.spanId)).toEqual(['a', 'b']);
    const first = await client.getTracePage({ traceId: 'trace', limit: 1 });
    expect(first.nodes.map(node => node.spanId)).toEqual(['a']);
    const next = await client.getTracePage({ traceId: 'trace', cursor: first.nextCursor! });
    expect(next.nodes.map(node => node.spanId)).toEqual(['b']);
    expect(next.nextCursor).toBeUndefined();
  });
  it('hydrates exactly the IDs absent from the caller cache', async () => {
    const page = await client.getTracePage({ traceId: 'trace', spanIds: ['b'], include: 'full' });
    expect(page.nodes).toHaveLength(1);
    expect(page.nodes[0]!.details?.input).toEqual({ value: 'b' });
  });
  it.each([503, 'disconnect'] as const)(
    'retries a trace page after %s without changing its selection',
    async failure => {
      failures = [failure];
      const page = await makeClient().getTracePage({ traceId: 'trace', spanIds: ['b'], include: 'full' });
      expect(page.nodes.map(node => node.spanId)).toEqual(['b']);
      expect(requests).toEqual([
        { spanIds: ['b'], include: 'full' },
        { spanIds: ['b'], include: 'full' },
      ]);
    },
  );
  it('retries a continuation without losing or repeating a span', async () => {
    const first = await client.getTracePage({ traceId: 'trace', limit: 1 });
    requests = [];
    failures = [503];
    const next = await makeClient().getTracePage({ traceId: 'trace', cursor: first.nextCursor! });
    expect([...first.nodes, ...next.nodes].map(node => node.spanId)).toEqual(['a', 'b']);
    expect(next.nextCursor).toBeUndefined();
    expect(requests).toEqual([{ cursor: first.nextCursor }, { cursor: first.nextCursor }]);
  });
  it.each([400, 409, 413, 422, 501])('does not retry terminal HTTP %s', async status => {
    failures = [status];
    await expect(makeClient().getTracePage({ traceId: 'trace' })).rejects.toMatchObject({ status });
    expect(requests).toEqual([{}]);
  });
  it('honors explicitly disabled retries', async () => {
    failures = [503];
    await expect(client.getTracePage({ traceId: 'trace' })).rejects.toMatchObject({ status: 503 });
    expect(requests).toEqual([{}]);
  });
});
