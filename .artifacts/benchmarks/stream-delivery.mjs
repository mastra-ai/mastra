#!/usr/bin/env -S node --import tsx
// Run from the repository with its existing workspace dependencies installed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { CachingPubSub } from '../../packages/core/src/events/caching-pubsub.ts';
import { RedisStreamsPubSub } from '../../pubsub/redis-streams/src/index.ts';
import { RedisServerCache } from '../../stores/redis/src/cache.ts';

const requireRedis = createRequire(new URL('../../stores/redis/package.json', import.meta.url));
const Redis = requireRedis('ioredis');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function integer(name, fallback, min = 0) {
  const value = Number(process.env[name] ?? fallback);
  assert(Number.isSafeInteger(value) && value >= min, `${name} must be an integer >= ${min}`);
  return value;
}
const config = {
  chunks: integer('CHUNKS', 500, 1),
  bytes: integer('PAYLOAD_BYTES', 512),
  intervalMs: integer('INTERVAL_MS', 0),
  slowMs: integer('SLOW_MS', 5),
  repeats: integer('REPEATS', 3, 1),
  warmups: integer('WARMUPS', 1),
  failEvery: integer('FAIL_EVERY', 10, 1),
  timeoutMs: integer('TIMEOUT_MS', 60000, 1),
  profiles: (process.env.PROFILES ?? 'normal,slow,cache-failure,transport-failure').split(','),
};
assert(process.env.REDIS_URL, 'Set REDIS_URL explicitly to an isolated disposable Redis instance');
for (const profile of config.profiles)
  assert(['normal', 'slow', 'cache-failure', 'transport-failure'].includes(profile));
const url = process.env.REDIS_URL; // Deliberately never emitted, including error paths.
const runPrefix = `stream-bench:${randomUUID()}:`;
const admin = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
admin.on('error', () => {});
function stats(values) {
  if (!values.length) return { n: 0, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) };
}
function sink(delayMs) {
  let tail = Promise.resolve();
  const records = [];
  let pending = 0;
  let peak = 0;
  return {
    records,
    get peak() {
      return peak;
    },
    push(event) {
      pending++;
      peak = Math.max(peak, pending);
      tail = tail.then(async () => {
        if (delayMs) await sleep(delayMs); // Explicit subscriber workload, not simulated Redis RTT.
        records.push({
          seq: event.data.seq,
          at: performance.now(),
          produced: event.data.produced,
          bytes: Buffer.byteLength(event.data.text),
        });
        pending--;
      });
    },
    drain: () => tail,
  };
}
function counts(records) {
  const sequences = records.map(r => r.seq);
  const unique = new Set(sequences);
  return {
    count: records.length,
    unique: unique.size,
    duplicates: records.length - unique.size,
    missing: Array.from({ length: config.chunks }, (_, i) => i).filter(i => !unique.has(i)),
    outOfOrder: sequences.some((n, i) => i > 0 && n <= sequences[i - 1]),
    payloadBytes: records.reduce((sum, r) => sum + r.bytes, 0),
  };
}
function delivery(records, started) {
  const last = records.at(-1)?.at;
  return {
    ...counts(records),
    latencyMs: stats(records.map(r => r.at - r.produced)),
    firstFrameMs: records[0] ? records[0].at - started : null,
    completedMs: last ? last - started : null,
    chunksPerSecond: last ? (records.length * 1000) / (last - started) : null,
    payloadBytesPerSecond: last ? (records.reduce((sum, r) => sum + r.bytes, 0) * 1000) / (last - started) : null,
  };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), config.timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function trial(mode, profile, repeat, warmup) {
  const prefix = `${runPrefix}${randomUUID()}:`;
  const topic = 'agent.stream.benchmark';
  const cacheClient = new Redis(url, { maxRetriesPerRequest: 1, retryStrategy: () => null });
  cacheClient.on('error', () => {});
  const cache = new RedisServerCache({ client: cacheClient }, { keyPrefix: `${prefix}cache:`, ttlSeconds: 120 });
  const options = {
    url,
    keyPrefix: `${prefix}transport`,
    blockMs: 10,
    maxStreamLength: config.chunks + 100,
    streamIdleTtlMs: 120000,
  };
  const writer = new RedisStreamsPubSub(options);
  const reader = new RedisStreamsPubSub(options);
  let cacheAttempts = 0,
    transportAttempts = 0,
    cacheFaults = 0,
    transportFaults = 0,
    cacheWarnings = 0;
  const append = cache.listPushIndexed.bind(cache);
  cache.listPushIndexed = async (...args) => {
    cacheAttempts++;
    if (profile === 'cache-failure' && cacheAttempts % config.failEvery === 0) {
      cacheFaults++;
      throw new Error('benchmark injected cache append failure');
    }
    return append(...args);
  };
  const publish = writer.publish.bind(writer);
  writer.publish = async (...args) => {
    transportAttempts++;
    if (profile === 'transport-failure' && transportAttempts % config.failEvery === 0) {
      transportFaults++;
      throw new Error('benchmark injected transport publish failure');
    }
    return publish(...args);
  };
  const bus = new CachingPubSub(writer, cache, {
    logger: {
      error() {
        cacheWarnings++;
      },
    },
  });
  const observerBus = new CachingPubSub(reader, cache);
  const primary = sink(profile === 'slow' ? config.slowMs : 0);
  const observer = sink(0);
  const replay = sink(0);
  let lastIngress = performance.now();
  const callback = async (event, ack) => {
    lastIngress = performance.now();
    observer.push(event);
    if (mode === 'publish-first') primary.push(event);
    await ack?.();
  };
  const publishMs = [],
    queueWaitMs = [],
    queueToDurableMs = [];
  let queued = Promise.resolve(),
    pending = 0,
    peakPending = 0,
    publishErrors = 0;
  let lastPersisted;
  try {
    // Both variants have an attached, independent replay/live observer before generation.
    await observerBus.subscribeWithReplay(topic, callback);
    const started = performance.now();
    async function persist(event, enqueued) {
      const begin = performance.now();
      queueWaitMs.push(begin - enqueued);
      try {
        await bus.publish(topic, event);
      } catch {
        publishErrors++;
      }
      const end = performance.now();
      publishMs.push(end - begin);
      queueToDurableMs.push(end - enqueued);
      lastPersisted = end;
    }
    for (let seq = 0; seq < config.chunks; seq++) {
      const produced = performance.now();
      const event = {
        type: 'benchmark-chunk',
        runId: 'benchmark',
        data: { seq, produced, text: 'x'.repeat(config.bytes) },
      };
      if (mode === 'direct-queued-copy') {
        primary.push(event);
        pending++;
        peakPending = Math.max(peakPending, pending);
        queued = queued
          .then(() => persist(event, produced))
          .finally(() => {
            pending--;
          });
      } else {
        await persist(event, produced);
      }
      if (config.intervalMs) await sleep(config.intervalMs);
    }
    const producerDone = performance.now();
    await queued;
    const durableDrainDone = performance.now();
    // Wait for late transport delivery; settling overhead is excluded from throughput clocks.
    const waitStart = performance.now();
    while (
      (observer.records.length < config.chunks && performance.now() - lastIngress < 500) ||
      (observer.records.length < config.chunks && performance.now() - waitStart < 500)
    ) {
      assert(performance.now() - waitStart < config.timeoutMs, 'observer settlement timeout');
      await sleep(10);
    }
    await primary.drain();
    await observer.drain();
    // Replay through the real wrapper on a fresh transport, not direct reads of Redis lists.
    const replayReader = new RedisStreamsPubSub(options);
    const replayBus = new CachingPubSub(replayReader, cache);
    const replayStarted = performance.now();
    try {
      await replayBus.subscribeWithReplay(topic, async (event, ack) => {
        replay.push(event);
        await ack?.();
      });
      await replay.drain();
    } finally {
      await replayReader.close();
    }
    const result = {
      mode,
      profile,
      repeat,
      warmup,
      primary: delivery(primary.records, started),
      observer: delivery(observer.records, started),
      replay: { ...counts(replay.records), readMs: (replay.records.at(-1)?.at ?? replayStarted) - replayStarted },
      producerMs: producerDone - started,
      publishMs: stats(publishMs),
      queueWaitMs: stats(queueWaitMs),
      enqueueToPublishSettledMs: stats(queueToDurableMs),
      queueDrainAfterProducerMs: durableDrainDone - producerDone,
      publishSettledMs: (lastPersisted ?? started) - started,
      peakPersistenceQueue: peakPending,
      peakCallerQueue: primary.peak,
      cacheAttempts,
      cacheFaults,
      cacheWarnings,
      transportAttempts,
      transportFaults,
      publishErrors,
    };
    if (profile === 'normal' || profile === 'slow') {
      for (const records of [primary.records, observer.records, replay.records]) {
        assert.deepEqual(
          records.map(r => r.seq),
          Array.from({ length: config.chunks }, (_, i) => i),
        );
        assert.equal(counts(records).payloadBytes, config.chunks * config.bytes);
      }
      assert.equal(publishErrors, 0);
    } else {
      assert.equal(
        profile === 'cache-failure' ? cacheFaults : transportFaults,
        Math.floor(config.chunks / config.failEvery),
      );
      assert.equal(publishErrors, transportFaults);
      assert.equal(cacheWarnings, cacheFaults);
      if (mode === 'direct-queued-copy') assert.equal(primary.records.length, config.chunks);
    }
    return result;
  } finally {
    await Promise.allSettled([writer.close(), reader.close()]);
    await cacheClient.quit();
  }
}
async function cleanup() {
  // Never FLUSHDB or touch any prefix other than this invocation's random namespace.
  let cursor = '0';
  do {
    const [next, keys] = await admin.scan(cursor, 'MATCH', `${runPrefix}*`, 'COUNT', 1000);
    cursor = next;
    if (keys.length) await admin.del(...keys);
  } while (cursor !== '0');
}
let failed = false;
try {
  await admin.connect();
  const rtt = [];
  for (let i = 0; i < 30; i++) {
    const t = performance.now();
    await admin.ping();
    rtt.push(performance.now() - t);
  }
  let sourceCommit = 'unknown';
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      cwd: new URL('../../', import.meta.url),
    }).trim();
  } catch {}
  console.log(
    JSON.stringify({
      kind: 'environment',
      sourceCommit,
      node: process.version,
      config,
      redisPingRttMs: stats(rtt),
      scope: 'local wrapper microbenchmark; not full Agent/HTTP/PR3 verdict',
    }),
  );
  for (const profile of config.profiles) {
    for (let repeat = -config.warmups; repeat < config.repeats; repeat++) {
      // Alternate order to reduce systematic warm-cache/order bias. Warmups are labeled, never aggregated.
      const modes =
        repeat % 2 === 0 ? ['direct-queued-copy', 'publish-first'] : ['publish-first', 'direct-queued-copy'];
      for (const mode of modes) {
        const result = await bounded(trial(mode, profile, repeat, repeat < 0), 'trial deadline exceeded');
        console.log(JSON.stringify({ kind: 'trial', ...result }));
      }
    }
  }
} catch {
  failed = true;
  // Error stacks from Redis clients can contain credentials. Do not print them.
  console.error('Benchmark failed (connection, deadline, or invariant). Redis URL and error details suppressed.');
} finally {
  await cleanup().catch(() => {
    failed = true;
  });
  await admin.quit().catch(() => {});
}
// Ensures a timed-out Redis operation cannot leave this CLI hanging indefinitely.
process.exit(failed ? 1 : 0);
