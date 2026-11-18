#!/usr/bin/env node
/**
 * Factory memory-breakdown harness.
 *
 * Simulates a Factory-like burst in one Node process: N concurrent "agent runs",
 * each holding a ~1–2 MB transcript (tool results sliced from a larger buffer, as
 * the real tool-result diffs are) on an in-memory Mastra storage. Samples
 * `process.memoryUsage()` and `v8.getHeapSpaceStatistics()` at baseline, peak,
 * post-burst, and after a forced `global.gc()` pass (requires `--expose-gc`).
 *
 * Writes two heap snapshots (baseline + post-GC) when `SNAPSHOTS=1`, so
 * you can diff them in Chrome DevTools for retainer paths.
 *
 * Env knobs:
 *   RUNS                 (default 20)   number of concurrent "runs" in the burst
 *   MESSAGES             (default 90)   messages per run
 *   TOOL_RESULT_KB       (default 60)   average size of each tool-result payload
 *   TOOL_RESULT_RATIO    (default 0.3)  share of messages that carry a tool result
 *   RETAIN               (default 0)    keep all runs resident until after GC (worst case)
 *   SNAPSHOTS            (default 0)    write heap snapshots to ./bench-out/
 *   LIST_AFTER           (default 1)    also listMessages() after saving, to force buffering
 *   RUN_ISOLATED         (default 0)    give each run its own in-memory storage (default is one shared)
 *
 * Example:
 *   pnpm turbo build --filter ./packages/core
 *   node --expose-gc --max-old-space-size=4096 scripts/bench/factory-memory-burst.mjs
 *   SNAPSHOTS=1 node --expose-gc scripts/bench/factory-memory-burst.mjs
 *   MALLOC_ARENA_MAX=2 node --expose-gc scripts/bench/factory-memory-burst.mjs
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import v8 from 'node:v8';

const RUNS = Number(process.env.RUNS ?? 20);
const MESSAGES = Number(process.env.MESSAGES ?? 90);
const TOOL_RESULT_KB = Number(process.env.TOOL_RESULT_KB ?? 60);
const TOOL_RESULT_RATIO = Number(process.env.TOOL_RESULT_RATIO ?? 0.3);
const RETAIN = /^(1|true|yes)$/i.test(process.env.RETAIN ?? '0');
const SNAPSHOTS = /^(1|true|yes)$/i.test(process.env.SNAPSHOTS ?? '0');
const LIST_AFTER = /^(1|true|yes)$/i.test(process.env.LIST_AFTER ?? '1');
const OUT_DIR = resolve('bench-out');

function fmtBytes(n) {
  if (!Number.isFinite(n)) return String(n);
  const mb = n / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

function sample(label) {
  const m = process.memoryUsage();
  const spaces = Object.fromEntries(v8.getHeapSpaceStatistics().map(s => [s.space_name, s.space_size]));
  return {
    label,
    t: Date.now(),
    rss: m.rss,
    heapTotal: m.heapTotal,
    heapUsed: m.heapUsed,
    external: m.external,
    arrayBuffers: m.arrayBuffers,
    spaces,
  };
}

function printSamples(samples) {
  const header = ['label', 'rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'];
  const rows = samples.map(s => [
    s.label,
    fmtBytes(s.rss),
    fmtBytes(s.heapTotal),
    fmtBytes(s.heapUsed),
    fmtBytes(s.external),
    fmtBytes(s.arrayBuffers),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = cells => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(header));
  for (const r of rows) console.log(line(r));

  console.log('\nTop heap spaces per sample:');
  for (const s of samples) {
    const top = Object.entries(s.spaces)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => `${k}=${fmtBytes(v)}`)
      .join('  ');
    console.log(`  ${s.label.padEnd(16)} ${top}`);
  }

  // RSS gap: rss - heapTotal - external = roughly "native overhead" (allocator fragmentation,
  // thread stacks, native modules, code cache). Useful signal for hypothesis 3 (fragmentation).
  console.log('\nNative overhead (rss - heap_total - external):');
  for (const s of samples) {
    const overhead = s.rss - s.heapTotal - s.external;
    console.log(`  ${s.label.padEnd(16)} ${fmtBytes(overhead)}`);
  }
}

async function loadCore() {
  // Local relative path — this file lives at scripts/bench/*.
  const { InMemoryMemory, InMemoryDB } = await import('../../packages/core/dist/storage/index.js');
  return { InMemoryMemory, InMemoryDB };
}

function makeToolResult(kb, seed) {
  // Build a random-looking payload. Use crypto randomness to keep it incompressible so v8
  // can't intern or dedup it.
  const bytes = kb * 1024;
  // Produce as a mix of structured JSON + a blob field (mimics command output embedded in a tool result).
  const blob = Buffer.allocUnsafe(bytes);
  for (let i = 0; i < bytes; i += 4) blob.writeUInt32LE(((seed * 2654435761) ^ i) >>> 0, i);
  return {
    stdout: blob.toString('base64'),
    stderr: '',
    exitCode: 0,
    durationMs: 1234,
    truncated: false,
  };
}

function makeMessage({ threadId, resourceId, i }) {
  const isToolResult = Math.random() < TOOL_RESULT_RATIO;
  const role = i % 2 === 0 ? 'user' : 'assistant';
  const text = isToolResult ? `Tool call ${i} finished.` : `Turn ${i}: ${'lorem ipsum dolor sit amet, '.repeat(60)}`;
  const content = isToolResult
    ? {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolName: 'shell',
              toolCallId: `t${i}`,
              state: 'result',
              args: { cmd: 'ls' },
              result: makeToolResult(TOOL_RESULT_KB, i),
            },
          },
        ],
      }
    : { format: 2, parts: [{ type: 'text', text }] };
  return {
    id: `${threadId}-${i}`,
    threadId,
    resourceId,
    role,
    type: 'text',
    content,
    createdAt: new Date(Date.now() - (MESSAGES - i) * 1000),
  };
}

async function oneRun(storage, i) {
  const threadId = `thread-${i}-${randomUUID()}`;
  const resourceId = `resource-${i}`;
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: `Run ${i}`, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
  });
  // Save messages in two batches to mimic incremental persistence during a run.
  const half = Math.floor(MESSAGES / 2);
  const first = [];
  const second = [];
  for (let j = 0; j < MESSAGES; j++) {
    const m = makeMessage({ threadId, resourceId, i: j });
    (j < half ? first : second).push(m);
  }
  await storage.saveMessages({ messages: first });
  await storage.saveMessages({ messages: second });
  if (LIST_AFTER) {
    const result = await storage.listMessages({
      threadId,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      perPage: false,
    });
    // Build a big string like a prompt would, to exercise MessageList and external string buffers.
    const concatenated = result.messages.map(m => JSON.stringify(m.content)).join('\n');
    return concatenated.length;
  }
  return 0;
}

async function waitSettled(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function writeSnapshot(name) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = resolve(OUT_DIR, `${name}.heapsnapshot`);
  v8.writeHeapSnapshot(path);
  console.log(`  wrote heap snapshot: ${path}`);
}

async function main() {
  console.log(
    `Factory memory-burst harness — runs=${RUNS} messages=${MESSAGES} tool_result_kb=${TOOL_RESULT_KB} retain=${RETAIN} snapshots=${SNAPSHOTS}`,
  );
  console.log(
    `node ${process.version}  pid ${process.pid}  heapLimit ${fmtBytes(v8.getHeapStatistics().heap_size_limit)}`,
  );
  if (process.env.MALLOC_ARENA_MAX) console.log(`MALLOC_ARENA_MAX=${process.env.MALLOC_ARENA_MAX}`);
  if (!globalThis.gc) console.log('(warning: run with --expose-gc to force GC between phases)');

  const { InMemoryMemory, InMemoryDB } = await loadCore();

  const samples = [];
  samples.push(sample('baseline'));
  if (SNAPSHOTS) writeSnapshot('baseline');

  // Each run gets its own storage object to mimic per-run retention; but sharing one storage
  // is closer to Factory. Toggle via RUN_ISOLATED if you want to compare.
  const RUN_ISOLATED = /^(1|true|yes)$/i.test(process.env.RUN_ISOLATED ?? '0');
  const sharedStorage = RUN_ISOLATED ? undefined : new InMemoryMemory({ db: new InMemoryDB() });

  // Phase 1: burst — all runs start concurrently.
  console.log(`\nPhase 1: ${RUNS} concurrent runs starting…`);
  const t0 = Date.now();
  const retained = [];
  const runPromises = Array.from({ length: RUNS }, async (_, i) => {
    const storage = RUN_ISOLATED ? new InMemoryMemory({ db: new InMemoryDB() }) : sharedStorage;
    const len = await oneRun(storage, i);
    if (RETAIN) retained.push({ storage, len });
    return len;
  });
  // Peek at memory mid-burst (allow a few runs to start).
  const peekPromise = (async () => {
    await waitSettled(20);
    return sample('mid-burst');
  })();
  const [, midSample] = await Promise.all([Promise.all(runPromises), peekPromise]);
  samples.push(midSample);
  console.log(`  burst finished in ${Date.now() - t0}ms  (retained ${retained.length} runs)`);

  samples.push(sample('post-burst'));

  // Phase 2: drop references and GC.
  console.log('\nPhase 2: drop references, force GC');
  retained.length = 0;
  if (globalThis.gc) {
    globalThis.gc();
    globalThis.gc();
  }
  await waitSettled(50);
  samples.push(sample('post-gc'));
  if (SNAPSHOTS) writeSnapshot('post-gc');

  // Phase 3: idle for a bit so RSS has a chance to return to the OS.
  await waitSettled(2000);
  if (globalThis.gc) {
    globalThis.gc();
    globalThis.gc();
  }
  samples.push(sample('post-gc-settled'));

  console.log('\nResults:');
  printSamples(samples);

  // Machine-readable summary.
  console.log('\nJSON:');
  console.log(
    JSON.stringify(
      {
        env: {
          RUNS,
          MESSAGES,
          TOOL_RESULT_KB,
          TOOL_RESULT_RATIO,
          RETAIN,
          LIST_AFTER,
          SNAPSHOTS,
          RUN_ISOLATED,
          MALLOC_ARENA_MAX: process.env.MALLOC_ARENA_MAX ?? null,
        },
        samples,
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
