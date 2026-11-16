/**
 * Synthetic completion burst against a local collector that holds responses.
 * Run each mode in a fresh process from observability/mastra:
 * node --expose-gc --import tsx scripts/benchmark-platform-byte-batching.ts count
 * node --expose-gc --import tsx scripts/benchmark-platform-byte-batching.ts bytes
 *
 * Both modes retain every record. The byte mode limits concurrent uploads,
 * while allowing queued bytes to grow when the collector is slow.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { MastraPlatformExporter } from '../src/exporters/mastra-platform';

const mode = process.argv[2];
assert(mode === 'count' || mode === 'bytes', 'Pass count or bytes');
assert(globalThis.gc, 'Run with --expose-gc');
const collect = globalThis.gc;
const responses: ServerResponse[] = [];
let hold = false;
let received = 0;
let bytes = 0;
let maxBytes = 0;
const server = createServer((req, res) => {
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
  });
  req.on('end', () => {
    received++;
    bytes += size;
    maxBytes = Math.max(maxBytes, size);
    if (hold) responses.push(res);
    else res.writeHead(204).end();
  });
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
const exporter = new MastraPlatformExporter({
  accessToken: 'local-benchmark-only',
  resolveFromEnv: false,
  endpoint: `http://127.0.0.1:${address.port}`,
  maxBatchSize: 10,
  maxBatchWaitMs: 60_000,
  maxRetries: 1,
  ...(mode === 'bytes'
    ? {
        byteBatching: {
          maxBatchBytes: 128 * 1024,
          maxConcurrentUploads: 2,
          uploadTimeoutMs: 30_000,
        },
      }
    : {}),
});

function release() {
  hold = false;
  for (const res of responses) if (!res.writableEnded) res.writeHead(204).end();
}

try {
  await exporter.onLogEvent({
    type: 'log',
    log: {
      logId: 'warmup',
      timestamp: new Date(),
      level: 'info',
      message: 'warmup',
    },
  });
  await exporter.flush();
  hold = true;
  received = 0;
  bytes = 0;
  maxBytes = 0;
  collect();
  const before = process.memoryUsage();
  for (let i = 0; i < 800; i++) {
    await exporter.onLogEvent({
      type: 'log',
      log: {
        logId: String(i),
        timestamp: new Date(),
        level: 'info',
        message: `${i}:` + 'x'.repeat(64 * 1024),
      },
    });
  }
  const target = mode === 'bytes' ? 2 : 80;
  const deadline = Date.now() + 10_000;
  while (received < target && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(received, target);
  collect();
  const after = process.memoryUsage();
  const keys = ['heapUsed', 'external', 'arrayBuffers', 'rss'] as const;
  console.log(
    JSON.stringify({
      mode,
      recordsOffered: 800,
      requestsBeforeAnyResponse: received,
      bodyMiBBeforeAnyResponse: bytes / 1024 / 1024,
      maxRequestBytes: maxBytes,
      queue: exporter.getByteBatchingStats(),
      deltaMiB: Object.fromEntries(keys.map(key => [key, +((after[key] - before[key]) / 1024 / 1024).toFixed(2)])),
    }),
  );
  release();
  await exporter.flush();
  console.log(
    JSON.stringify({
      mode,
      requestsAfterDrain: received,
      bodyMiBAfterDrain: bytes / 1024 / 1024,
      queue: exporter.getByteBatchingStats(),
    }),
  );
} finally {
  release();
  await exporter.shutdown();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
