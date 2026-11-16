import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient } from '@clickhouse/client';
import { Mastra } from '@mastra/core';
import { SpanType } from '@mastra/core/observability';
import { MastraStorage } from '@mastra/core/storage';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ObservabilityStorageClickhouseVNext } from './domains/observability/v-next';

// Uses the package test server and creates/removes only a database owned by this suite.
describe('Storage exporter byte batching with ClickHouse', () => {
  const database = `byte_batch_${randomUUID().replaceAll('-', '')}`;
  const connection = {
    url: process.env.CLICKHOUSE_URL ?? 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME ?? 'default',
    password: process.env.CLICKHOUSE_PASSWORD ?? 'password',
  };
  const admin = createClient(connection);
  let hold = false;
  let failuresRemaining = 0;
  let insertRequests = 0;
  const releases: (() => void)[] = [];
  const proxy = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const isInsert = decodeURIComponent(incoming.url ?? '').includes('INSERT') || body.toString().startsWith('INSERT');
    if (isInsert) {
      insertRequests++;
      if (hold) await new Promise<void>(resolve => releases.push(resolve));
      if (failuresRemaining > 0) {
        failuresRemaining--;
        outgoing.writeHead(503).end('Injected temporary transport failure');
        return;
      }
    }
    const upstream = request(
      new URL(incoming.url ?? '/', connection.url),
      {
        method: incoming.method,
        headers: incoming.headers,
      },
      response => {
        outgoing.writeHead(response.statusCode!, response.headers);
        response.pipe(outgoing);
      },
    );
    upstream.on('error', error => {
      outgoing.writeHead(502).end(error.message);
    });
    upstream.end(body);
  });
  let storage: ObservabilityStorageClickhouseVNext;
  let client: ReturnType<typeof createClient>;
  let mastra: Mastra;
  beforeAll(async () => {
    await admin.command({ query: `CREATE DATABASE ${database}` });
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    client = createClient({
      ...connection,
      database,
      url: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
    });
    storage = new ObservabilityStorageClickhouseVNext({ client });
    await storage.init();
    mastra = new Mastra({
      storage: new MastraStorage({ id: database, domains: { observability: storage }, disableInit: true }),
      logger: false,
    });
  }, 60_000);
  afterAll(async () => {
    hold = false;
    for (const release of releases.splice(0)) release();
    await client?.close();
    proxy.closeAllConnections();
    await new Promise<void>(resolve => proxy.close(() => resolve()));
    await admin.command({ query: `DROP DATABASE IF EXISTS ${database}` });
    await admin.close();
  });

  async function allLogs() {
    const logs = [];
    for (let page = 0; ; page++) {
      const result = await storage.listLogs({ pagination: { page, perPage: 100 } });
      logs.push(...result.logs);
      if (result.logs.length < 100) return { logs };
    }
  }

  it.each(Array.from({ length: 20 }, (_, i) => i))(
    'retains every record through slow inserts and retries (iteration %i)',
    async iteration => {
      const exporter = new MastraStorageExporter({
        maxBatchSize: 10,
        maxBatchWaitMs: 60_000,
        retryDelayMs: 10,
        maxRetries: 2,
        byteBatching: { maxBatchBytes: 16_384, maxConcurrentWrites: 1 },
      });
      await exporter.init({ mastra });
      hold = true;
      failuresRemaining = 1;
      const before = insertRequests;
      try {
        for (let i = 0; i < 100; i++) {
          await exporter.onLogEvent({
            type: 'log',
            log: {
              logId: `bounded-${iteration}-${i}`,
              timestamp: new Date(),
              level: 'info',
              message: 'x'.repeat(1000),
            },
          });
        }
        await expect.poll(() => releases.length).toBe(1);
        const pending = exporter.getByteBatchingStats()!;
        expect(pending.activeWrites).toBe(1);
        expect(pending.pendingRecords).toBe(100);
        expect(insertRequests - before).toBe(1);
        hold = false;
        releases.shift()!();
        await exporter.flush();
        expect(exporter.getByteBatchingStats()).toMatchObject({ pendingBytes: 0, pendingRecords: 0, activeWrites: 0 });
        const result = await allLogs();
        expect(result.logs.filter(row => row.logId?.startsWith(`bounded-${iteration}-`))).toHaveLength(100);
        expect(insertRequests - before).toBe(11);
      } finally {
        hold = false;
        for (const release of releases.splice(0)) release();
        await exporter.shutdown();
      }
    },
    30_000,
  );
  it('releases exhausted retries and accepts a subsequent healthy write', async () => {
    const exporter = new MastraStorageExporter({
      maxBatchSize: 1,
      retryDelayMs: 1,
      maxRetries: 2,
      byteBatching: { maxBatchBytes: 2048 },
    });
    await exporter.init({ mastra });
    const before = insertRequests;
    failuresRemaining = 3;
    try {
      await exporter.onLogEvent({
        type: 'log',
        log: { logId: 'exhausted', timestamp: new Date(), level: 'info', message: 'fails' },
      });
      await exporter.flush();
      expect(insertRequests - before).toBe(3);
      expect(exporter.getByteBatchingStats()).toMatchObject({ pendingBytes: 0, pendingRecords: 0, activeWrites: 0 });
      await exporter.onLogEvent({
        type: 'log',
        log: { logId: 'recovered', timestamp: new Date(), level: 'info', message: 'works' },
      });
      await exporter.flush();
      const result = await allLogs();
      expect(result.logs.some(row => row.logId === 'exhausted')).toBe(false);
      expect(result.logs.some(row => row.logId === 'recovered')).toBe(true);
    } finally {
      failuresRemaining = 0;
      await exporter.shutdown();
    }
  });
  it('splits on bytes before the record limit and respects configured concurrency', async () => {
    const exporter = new MastraStorageExporter({
      maxBatchSize: 1000,
      maxBatchWaitMs: 60_000,
      byteBatching: { maxBatchBytes: 2048, maxConcurrentWrites: 2 },
    });
    await exporter.init({ mastra });
    const before = insertRequests;
    hold = true;
    try {
      for (let i = 0; i < 8; i++) {
        await exporter.onLogEvent({
          type: 'log',
          log: { logId: `split-${i}`, timestamp: new Date(), level: 'info', message: 'x'.repeat(1000) },
        });
      }
      await expect.poll(() => releases.length).toBe(2);
      expect(exporter.getByteBatchingStats()).toMatchObject({
        activeWrites: 2,
        pendingRecords: 8,
      });
      hold = false;
      for (const release of releases.splice(0)) release();
      await exporter.flush();
      // Two events cross the byte threshold, before the 1,000-record limit.
      expect(insertRequests - before).toBe(4);
      const result = await allLogs();
      expect(result.logs.filter(row => row.logId?.startsWith('split-'))).toHaveLength(8);
    } finally {
      hold = false;
      for (const release of releases.splice(0)) release();
      await exporter.shutdown();
    }
  });
  it.each(Array.from({ length: 20 }, (_, i) => i))(
    'keeps events arriving during shutdown (iteration %i)',
    async iteration => {
      const exporter = new MastraStorageExporter({ maxBatchSize: 1, byteBatching: {} });
      const observability = new Observability({
        configs: { default: { serviceName: 'shutdown-test', exporters: [exporter] } },
      });
      const localMastra = new Mastra({ storage: mastra.getStorage(), observability, logger: false });
      await exporter.init({ mastra: localMastra });
      const tracing = observability.getDefaultInstance()!;
      const span = tracing.startSpan({ type: SpanType.GENERIC, name: 'ends during shutdown' });
      hold = true;
      let shutdown: Promise<void> | undefined;
      try {
        await exporter.onLogEvent({
          type: 'log',
          log: { logId: `shutdown-start-${iteration}`, timestamp: new Date(), level: 'info', message: 'before drain' },
        });
        await expect.poll(() => releases.length).toBe(1);
        shutdown = exporter.shutdown();
        span.end({ output: { result: 'completed during drain' } });
        await expect.poll(() => exporter.getByteBatchingStats()?.pendingRecords).toBe(2);
        await exporter.onLogEvent({
          type: 'log',
          log: { logId: `shutdown-end-${iteration}`, timestamp: new Date(), level: 'info', message: 'during drain' },
        });
        hold = false;
        for (const release of releases.splice(0)) release();
        await shutdown;
        const result = await allLogs();
        expect(result.logs.some(row => row.logId === `shutdown-end-${iteration}`)).toBe(true);
        const persisted = await storage.getSpan({ traceId: span.traceId, spanId: span.id });
        expect(persisted?.span.output).toEqual({ result: 'completed during drain' });
      } finally {
        hold = false;
        for (const release of releases.splice(0)) release();
        await (shutdown ?? exporter.shutdown());
      }
    },
  );
});
