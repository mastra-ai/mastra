#!/usr/bin/env -S node --import tsx
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { CachingPubSub } from '../../packages/core/src/events/caching-pubsub.ts';
import { RedisStreamsPubSub } from '../../pubsub/redis-streams/src/index.ts';
import { RedisServerCache } from '../../stores/redis/src/cache.ts';

const Redis = createRequire(new URL('../../stores/redis/package.json', import.meta.url))('ioredis');
const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
function number(name, fallback, min = 0) {
  const value = Number(process.env[name] ?? fallback);
  assert(Number.isFinite(value) && value >= min, `Invalid ${name}`);
  return value;
}
function integer(name, fallback, min = 0) {
  const value = number(name, fallback, min);
  assert(Number.isSafeInteger(value), `Invalid ${name}`);
  return value;
}
const config = {
  chunks: integer('CHUNKS', 180, 1),
  bytes: integer('PAYLOAD_BYTES', 512),
  hz: number('HZ', 30, 0.1),
  slowMs: integer('SLOW_MS', 60),
  repeats: integer('REPEATS', 2, 1),
  warmups: integer('WARMUPS', 0),
  capacity: integer('QUEUE_CAPACITY', 8, 1),
  proxyBufferBytes: integer('PROXY_BUFFER_BYTES', 262144, 65536),
  addedRttMs: number('ADDED_RTT_MS', 0),
  failEvery: integer('FAIL_EVERY', 10, 1),
  timeoutMs: integer('TIMEOUT_MS', 120000, 1),
  settleMs: integer('SETTLE_MS', 750, 1),
  profiles: (process.env.PROFILES ?? 'normal,slow,cache-failure,transport-failure').split(','),
  endpointClass: process.env.ENDPOINT_CLASS ?? 'local',
};
assert(config.bytes <= 16384, 'PAYLOAD_BYTES must be <= 16384 for the bounded RESP parser');
assert(process.env.REDIS_URL, 'Supply REDIS_URL for an approved isolated disposable Redis');
assert(['local', 'approved-remote'].includes(config.endpointClass), 'Invalid ENDPOINT_CLASS');
for (const p of config.profiles) assert(['normal', 'slow', 'cache-failure', 'transport-failure'].includes(p));
let originalUrl;
try {
  originalUrl = new URL(process.env.REDIS_URL);
} catch {
  throw new Error('Invalid REDIS_URL; credential-bearing input suppressed');
}
assert.equal(originalUrl.protocol, 'redis:', 'TCP proxy supports redis:// only, not TLS/Unix/cluster');
if (config.endpointClass === 'local') {
  assert(
    ['127.0.0.1', 'localhost', '[::1]'].includes(originalUrl.hostname),
    'Remote endpoints require explicit ENDPOINT_CLASS=approved-remote and prior approval',
  );
}
const runPrefix = `stream-bench-v2:${randomUUID()}:`;
const clientOptions = { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null, connectTimeout: 5000 };
const admin = new Redis(originalUrl.toString(), clientOptions);
admin.on('error', () => {});
function stats(values) {
  if (!values.length) return { n: 0, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1) };
}
function delta(after, before) {
  return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - (before[key] ?? 0)]));
}
// RESP parsing observes only top-level command names/counts, never arguments or credentials.
function commandParser(observed) {
  let buffered = Buffer.alloc(0);
  return bytes => {
    buffered = Buffer.concat([buffered, bytes]);
    assert(buffered.length <= 1048576, 'RESP observation buffer exceeded 1 MiB');
    for (;;) {
      const firstEnd = buffered.indexOf('\r\n');
      if (firstEnd < 0) return;
      assert.equal(buffered[0], 42, 'Expected RESP command array');
      const count = Number(buffered.subarray(1, firstEnd).toString());
      let cursor = firstEnd + 2;
      let command;
      for (let i = 0; i < count; i++) {
        const end = buffered.indexOf('\r\n', cursor);
        if (end < 0) return;
        assert.equal(buffered[cursor], 36, 'Expected RESP bulk argument');
        const length = Number(buffered.subarray(cursor + 1, end).toString());
        if (buffered.length < end + 2 + length + 2) return;
        if (i === 0)
          command = buffered
            .subarray(end + 2, end + 2 + length)
            .toString()
            .toLowerCase();
        cursor = end + 2 + length + 2;
      }
      observed.commands[command] = (observed.commands[command] ?? 0) + 1;
      observed.commandRequestBytes[command] = (observed.commandRequestBytes[command] ?? 0) + cursor;
      buffered = buffered.subarray(cursor);
      if (!buffered.length) return;
    }
  };
}
async function startProxy() {
  const sockets = new Set();
  const observed = {
    commands: {},
    commandRequestBytes: {},
    requestBytes: 0,
    responseBytes: 0,
    peakDelayedBytesPerDirection: 0,
    pauses: 0,
  };
  let proxyError = false;
  const server = net.createServer(incoming => {
    const outgoing = net.connect({
      host: originalUrl.hostname.replace(/^\[|\]$/g, ''),
      port: Number(originalUrl.port || 6379),
    });
    for (const socket of [incoming, outgoing]) {
      sockets.add(socket);
      socket.setNoDelay(true);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {
        proxyError = true;
        incoming.destroy();
        outgoing.destroy();
      });
    }
    const parse = commandParser(observed);
    function forward(source, target, request) {
      const queue = [];
      let bytes = 0;
      let timer;
      let blocked = false;
      let ended = false;
      function pump() {
        clearTimeout(timer);
        if (target.destroyed || blocked) return;
        while (queue.length) {
          const wait = queue[0].due - performance.now();
          if (wait > 0) {
            timer = setTimeout(pump, wait);
            return;
          }
          const item = queue.shift();
          bytes -= item.data.length;
          if (bytes < config.proxyBufferBytes) source.resume();
          if (!target.write(item.data)) {
            blocked = true;
            return;
          }
        }
        if (ended) target.end();
      }
      target.on('drain', () => {
        blocked = false;
        pump();
      });
      source.on('data', data => {
        try {
          if (request) parse(data);
        } catch {
          proxyError = true;
          source.destroy();
          target.destroy();
          return;
        }
        observed[request ? 'requestBytes' : 'responseBytes'] += data.length;
        bytes += data.length;
        observed.peakDelayedBytesPerDirection = Math.max(observed.peakDelayedBytesPerDirection, bytes);
        queue.push({ data, due: performance.now() + config.addedRttMs / 2 });
        if (bytes >= config.proxyBufferBytes) {
          observed.pauses++;
          source.pause();
        }
        pump();
      });
      source.on('end', () => {
        ended = true;
        pump();
      });
      source.on('close', () => {
        if (!ended) {
          clearTimeout(timer);
          target.destroy();
        }
      });
    }
    forward(incoming, outgoing, true);
    forward(outgoing, incoming, false);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const proxyUrl = new URL(originalUrl);
  proxyUrl.hostname = '127.0.0.1';
  proxyUrl.port = String(server.address().port);
  return {
    url: proxyUrl.toString(),
    observed,
    snapshot: () => ({
      ...observed,
      commands: { ...observed.commands },
      commandRequestBytes: { ...observed.commandRequestBytes },
    }),
    check: () => {
      assert(!proxyError, 'Proxy connection/parser failed');
      assert(observed.peakDelayedBytesPerDirection <= config.proxyBufferBytes + 65536, 'Proxy bound exceeded');
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
function gate(capacity) {
  let depth = 0,
    peak = 0,
    waitCount = 0,
    waitTotalMs = 0,
    saturatedMs = 0,
    saturatedAt;
  const waiters = [];
  return {
    async acquire() {
      const began = performance.now();
      const waited = depth >= capacity;
      if (waited) {
        waitCount++;
        await new Promise(resolve => waiters.push(resolve));
      } else depth++;
      if (waited) waitTotalMs += performance.now() - began;
      peak = Math.max(peak, depth);
      if (depth === capacity && saturatedAt === undefined) saturatedAt = performance.now();
      assert(depth <= capacity);
      return performance.now() - began;
    },
    release() {
      assert(depth > 0);
      if (waiters.length) waiters.shift()();
      else {
        if (saturatedAt !== undefined) {
          saturatedMs += performance.now() - saturatedAt;
          saturatedAt = undefined;
        }
        depth--;
      }
    },
    metrics: () => ({
      capacity,
      peak,
      depth,
      waitCount,
      waitTotalMs,
      saturatedMs: saturatedMs + (saturatedAt === undefined ? 0 : performance.now() - saturatedAt),
      peakApproxPayloadBytes: peak * config.bytes,
    }),
  };
}
function sink(delayMs, onConsumed = () => {}) {
  const admission = gate(config.capacity);
  const records = [];
  let tail = Promise.resolve();
  return {
    records,
    admission,
    async push(event) {
      const arrived = performance.now();
      await admission.acquire();
      const admitted = performance.now();
      tail = tail.then(async () => {
        try {
          if (delayMs) await sleep(delayMs);
          records.push({
            seq: event.data.seq,
            at: performance.now(),
            admitted,
            arrived,
            produced: event.data.produced,
            scheduled: event.data.scheduled,
            bytes: Buffer.byteLength(event.data.text),
          });
        } finally {
          admission.release();
          onConsumed(event.data.seq);
        }
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
    initialDeliveryMs: stats(records.map(r => r.arrived - r.produced)),
    admittedDeliveryMs: stats(records.map(r => r.admitted - r.produced)),
    observedDeliveryMs: stats(records.map(r => r.at - r.produced)),
    scheduledToObservedMs: stats(records.map(r => r.at - r.scheduled)),
    firstInitialFrameMs: records[0] ? records[0].arrived - started : null,
    firstFrameMs: records[0] ? records[0].at - started : null,
    completedMs: last ? last - started : null,
    chunksPerSecond: last ? (records.length * 1000) / (last - started) : null,
    payloadBytesPerSecond: last ? (records.reduce((sum, r) => sum + r.bytes, 0) * 1000) / (last - started) : null,
  };
}
async function dbStats() {
  const info = await admin.info('commandstats');
  return Object.fromEntries(
    info
      .split('\r\n')
      .filter(line => line.startsWith('cmdstat_'))
      .map(line => {
        const [key, values] = line.split(':');
        return [
          key.slice(8),
          Object.fromEntries(
            values.split(',').map(pair => {
              const [name, value] = pair.split('=');
              return [name, Number(value)];
            }),
          ),
        ];
      }),
  );
}
function dbDelta(after, before) {
  return Object.fromEntries(
    Object.entries(after)
      .map(([command, values]) => [
        command,
        { calls: values.calls - (before[command]?.calls ?? 0), usec: values.usec - (before[command]?.usec ?? 0) },
      ])
      .filter(([, values]) => values.calls),
  );
}
async function trial(proxy, mode, profile, repeat) {
  const prefix = `${runPrefix}${randomUUID()}:`;
  const topic = 'agent.stream.benchmark';
  const cacheClient = new Redis(proxy.url, clientOptions);
  cacheClient.on('error', () => {});
  const cache = new RedisServerCache({ client: cacheClient }, { keyPrefix: `${prefix}cache:`, ttlSeconds: 600 });
  const options = {
    url: proxy.url,
    keyPrefix: `${prefix}transport`,
    blockMs: 50,
    maxStreamLength: config.chunks + 100,
    streamIdleTtlMs: 600000,
  };
  const writer = new RedisStreamsPubSub(options);
  const reader = new RedisStreamsPubSub(options);
  let cacheAttempts = 0,
    transportAttempts = 0,
    cacheFaults = 0,
    transportFaults = 0,
    cacheWarnings = 0,
    publishErrors = 0;
  const append = cache.listPushIndexed.bind(cache);
  cache.listPushIndexed = async (...args) => {
    cacheAttempts++;
    if (profile === 'cache-failure' && cacheAttempts % config.failEvery === 0) {
      cacheFaults++;
      throw new Error('injected append failure');
    }
    return append(...args);
  };
  const publish = writer.publish.bind(writer);
  writer.publish = async (...args) => {
    transportAttempts++;
    if (profile === 'transport-failure' && transportAttempts % config.failEvery === 0) {
      transportFaults++;
      throw new Error('injected publish failure');
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
  // Experimental harness credit links bounded caller backlog to source production.
  // Release failed publication credits too: a missing last frame must not deadlock the producer.
  const sourceCredit = gate(config.capacity);
  const outstanding = new Set();
  const releaseSource = seq => {
    if (outstanding.delete(seq)) sourceCredit.release();
  };
  const primary = sink(profile === 'slow' ? config.slowMs : 0, releaseSource);
  const observer = sink(0);
  const replay = sink(0);
  const persistence = gate(config.capacity);
  const publishMs = [],
    queueWaitMs = [],
    queueToSettledMs = [],
    producerWaitMs = [],
    scheduleLagMs = [];
  let queued = Promise.resolve(),
    lastIngress = performance.now(),
    closed = false;
  let replayReader;
  try {
    await cacheClient.connect();
    await observerBus.subscribeWithReplay(topic, async (event, ack) => {
      if (closed) return ack?.();
      lastIngress = performance.now();
      await observer.push(event);
      if (mode === 'publish-first') await primary.push(event);
      await ack?.();
    });
    const wireBefore = proxy.snapshot();
    let dbBefore;
    try {
      dbBefore = await dbStats();
    } catch {
      /* INFO may be ACL-restricted. */
    }
    const started = performance.now();
    async function persist(event, enqueued) {
      const began = performance.now();
      queueWaitMs.push(began - enqueued);
      try {
        await bus.publish(topic, event);
      } catch {
        publishErrors++;
        if (mode === 'publish-first') releaseSource(event.data.seq);
      }
      const end = performance.now();
      publishMs.push(end - began);
      queueToSettledMs.push(end - enqueued);
    }
    let nextDue = started;
    for (let seq = 0; seq < config.chunks; seq++) {
      // Demand-paced source: never pre-allocate a catch-up queue when downstream is slow.
      const scheduled = nextDue;
      if (scheduled > performance.now()) await sleep(scheduled - performance.now());
      const waiting = performance.now();
      await sourceCredit.acquire();
      if (mode === 'direct-queued-copy') await persistence.acquire();
      producerWaitMs.push(performance.now() - waiting);
      const produced = performance.now();
      nextDue = produced + 1000 / config.hz;
      scheduleLagMs.push(produced - (started + (seq * 1000) / config.hz));
      outstanding.add(seq);
      const event = {
        type: 'benchmark-chunk',
        runId: 'benchmark',
        data: { seq, produced, scheduled: started + (seq * 1000) / config.hz, text: 'x'.repeat(config.bytes) },
      };
      if (mode === 'direct-queued-copy') {
        await primary.push(event);
        queued = queued.then(() => persist(event, produced)).finally(() => persistence.release());
      } else await persist(event, produced);
    }
    const producerDone = performance.now();
    await queued;
    const persistenceDone = performance.now();
    // Settle attached reader before fresh replay, and distinguish expected trailing fault gaps.
    const settling = performance.now();
    while (
      observer.records.length < config.chunks &&
      (performance.now() - lastIngress < config.settleMs || performance.now() - settling < config.settleMs)
    )
      await sleep(10);
    await primary.drain();
    await observer.drain();
    const liveDone = performance.now();
    await reader.close();
    closed = true;
    const wireAfter = proxy.snapshot();
    let dbAfter;
    try {
      if (dbBefore) dbAfter = await dbStats();
    } catch {
      /* Report unavailable rather than invent DB time. */
    }
    replayReader = new RedisStreamsPubSub(options);
    const replayBus = new CachingPubSub(replayReader, cache);
    const replayStart = performance.now();
    await replayBus.subscribeWithReplay(topic, async (event, ack) => {
      await replay.push(event);
      await ack?.();
    });
    await replay.drain();
    await replayReader.close();
    await replay.drain();
    for (const output of [primary, observer, replay]) {
      assert(output.admission.metrics().peak <= config.capacity);
      assert.equal(counts(output.records).duplicates, 0);
      assert.equal(counts(output.records).outOfOrder, false);
    }
    assert(persistence.metrics().peak <= config.capacity);
    assert(sourceCredit.metrics().peak <= config.capacity);
    if (profile === 'normal' || profile === 'slow') {
      for (const output of [primary, observer, replay]) {
        assert.deepEqual(
          output.records.map(r => r.seq),
          Array.from({ length: config.chunks }, (_, i) => i),
        );
        assert.equal(counts(output.records).payloadBytes, config.chunks * config.bytes);
      }
      assert.equal(outstanding.size, 0);
    } else {
      assert.equal(
        profile === 'cache-failure' ? cacheFaults : transportFaults,
        Math.floor(config.chunks / config.failEvery),
      );
      assert.equal(publishErrors, transportFaults);
      assert.equal(cacheWarnings, cacheFaults);
      if (mode === 'direct-queued-copy') assert.equal(primary.records.length, config.chunks);
    }
    proxy.check();
    return {
      kind: 'trial',
      mode,
      profile,
      repeat,
      warmup: repeat < 0,
      config,
      primary: delivery(primary.records, started),
      observer: delivery(observer.records, started),
      replay: { ...counts(replay.records), readMs: performance.now() - replayStart },
      producerMs: producerDone - started,
      producerWaitMs: stats(producerWaitMs),
      scheduleLagMs: stats(scheduleLagMs),
      publishMs: stats(publishMs),
      queueWaitMs: stats(queueWaitMs),
      enqueueToPublishSettledMs: stats(queueToSettledMs),
      persistenceDrainMs: persistenceDone - producerDone,
      liveDrainMs: liveDone - producerDone,
      queues: {
        source: sourceCredit.metrics(),
        persistence: persistence.metrics(),
        caller: primary.admission.metrics(),
        observer: observer.admission.metrics(),
        replay: replay.admission.metrics(),
      },
      wireLive: {
        commands: delta(wireAfter.commands, wireBefore.commands),
        commandRequestBytes: delta(wireAfter.commandRequestBytes, wireBefore.commandRequestBytes),
        requestBytes: wireAfter.requestBytes - wireBefore.requestBytes,
        responseBytes: wireAfter.responseBytes - wireBefore.responseBytes,
      },
      redisGlobalLiveCommandstats: dbAfter ? dbDelta(dbAfter, dbBefore) : null,
      proxy: {
        peakDelayedBytesPerDirection: wireAfter.peakDelayedBytesPerDirection,
        pauseCount: wireAfter.pauses - wireBefore.pauses,
      },
      cacheAttempts,
      cacheFaults,
      cacheWarnings,
      transportAttempts,
      transportFaults,
      publishErrors,
    };
  } finally {
    closed = true;
    await Promise.allSettled([writer.close(), reader.close(), replayReader?.close()]);
    cacheClient.disconnect();
  }
}
async function cleanup() {
  let cursor = '0';
  do {
    const [next, keys] = await admin.scan(cursor, 'MATCH', `${runPrefix}*`, 'COUNT', 1000);
    cursor = next;
    if (keys.length) await admin.del(...keys);
  } while (cursor !== '0');
}
let failed = false,
  proxy;
try {
  await admin.connect();
  proxy = await startProxy();
  const pingClient = new Redis(proxy.url, clientOptions);
  pingClient.on('error', () => {});
  await pingClient.connect();
  const rtt = [];
  for (let i = 0; i < 30; i++) {
    const began = performance.now();
    await pingClient.ping();
    rtt.push(performance.now() - began);
  }
  await pingClient.quit();
  const sourceFiles = [
    'packages/core/src/events/caching-pubsub.ts',
    'stores/redis/src/cache.ts',
    'pubsub/redis-streams/src/index.ts',
  ];
  const hashes = Object.fromEntries(
    sourceFiles.map(file => [
      file,
      createHash('sha256')
        .update(readFileSync(new URL(`../../${file}`, import.meta.url)))
        .digest('hex'),
    ]),
  );
  console.log(
    JSON.stringify({
      kind: 'environment',
      schema: 2,
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      scriptSha256: createHash('sha256')
        .update(readFileSync(new URL(import.meta.url)))
        .digest('hex'),
      sourceSha256: hashes,
      node: process.version,
      config,
      redisPingRttMs: stats(rtt),
      network: config.addedRttMs
        ? 'EMULATED added TCP RTT; NOT actual remote proof'
        : config.endpointClass === 'local'
          ? 'loopback via zero-delay observer proxy; NOT remote proof'
          : 'approved actual remote endpoint; no emulation',
      realRemoteGateVerified: config.endpointClass === 'approved-remote' && config.addedRttMs === 0,
    }),
  );
  for (const profile of config.profiles) {
    for (let repeat = -config.warmups; repeat < config.repeats; repeat++) {
      const modes =
        repeat % 2 === 0 ? ['direct-queued-copy', 'publish-first'] : ['publish-first', 'direct-queued-copy'];
      for (const mode of modes) {
        const watchdog = setTimeout(() => {
          console.error('Trial deadline exceeded; credentials suppressed');
          process.exit(1);
        }, config.timeoutMs);
        try {
          console.log(JSON.stringify(await trial(proxy, mode, profile, repeat)));
        } finally {
          clearTimeout(watchdog);
        }
      }
    }
  }
} catch {
  failed = true;
  console.error('Benchmark connection/deadline/invariant failure; credential-bearing details suppressed.');
} finally {
  await cleanup().catch(() => {
    failed = true;
  });
  admin.disconnect();
  await proxy?.close();
}
process.exit(failed ? 1 : 0);
