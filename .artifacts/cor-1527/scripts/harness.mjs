// COR-1527 paired-cache outage harness (evidence tooling only — no package sources are modified).
//
// One run per process. Arms differ ONLY in --cache (memory | redis).
//   node harness.mjs --cache=memory --mode=plain --pre-s=5 --outage-s=300 --post-s=15 --label=A-memory
//
// Boundaries recorded in runs/<label>/timeline.jsonl:
//   produce        model emitted chunk seq N
//   cache.enter/exit   MastraServerCache method call (listPushIndexed etc.) with event id + outcome
//   xadd.enter/exit    inner RedisStreamsPubSub.publish (the transport; the 120s budget lives inside)
//   deliver        observer (separate RedisStreamsPubSub connection) received the frame
//   caller         chunk/terminal/error seen by the caller's fullStream
//   outage.*       docker pause/unpause of the disposable container
//   console.*      every warn/error printed by Mastra (publish failures are logged, not thrown)
// Redis ground truth: runs/<label>/monitor.log from `redis-cli MONITOR` inside the container.
import { execFile, spawn, execFileSync } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const imp = p => import(pathToFileURL(join(REPO, p)).href);

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const CACHE = args.cache ?? 'memory';
const MODE = args.mode ?? 'plain';
const PRE_S = Number(args['pre-s'] ?? 5);
const OUTAGE_S = Number(args['outage-s'] ?? 300);
const POST_S = Number(args['post-s'] ?? 15);
const DRAIN_S = Number(args['drain-s'] ?? 240);
const CHUNK_MS = Number(args['chunk-ms'] ?? 50); // 20 chunks/s
const LABEL = args.label ?? `${MODE}-${CACHE}-${Date.now()}`;
const CONTAINER = 'cor1527-redis';
const URL = 'redis://127.0.0.1:6399';
if (!['memory', 'redis'].includes(CACHE)) throw new Error('--cache must be memory|redis');
if (!['plain', 'durable'].includes(MODE)) throw new Error('--mode must be plain|durable');

const runDir = join(REPO, '.artifacts/cor-1527/runs', LABEL);
mkdirSync(runDir, { recursive: true });
const timeline = createWriteStream(join(runDir, 'timeline.jsonl'));
const T0 = Date.now();
const log = (ev, extra = {}) =>
  timeline.write(JSON.stringify({ t: Date.now(), rel: Date.now() - T0, ev, ...extra }) + '\n');
const errInfo = e =>
  e
    ? {
        name: e.name,
        message: String(e.message ?? e).slice(0, 300),
        cause: e.cause ? String(e.cause.message ?? e.cause).slice(0, 200) : undefined,
      }
    : undefined;

for (const level of ['warn', 'error', 'info']) {
  const orig = console[level].bind(console);
  console[level] = (...a) => {
    log(`console.${level}`, {
      msg: a
        .map(x => (x instanceof Error ? `${x.name}: ${x.message}` : typeof x === 'string' ? x : safeJson(x)))
        .join(' ')
        .slice(0, 600),
    });
    orig(...a);
  };
}
function safeJson(x) {
  try {
    return JSON.stringify(x, (k, v) => (v instanceof Error ? { name: v.name, message: v.message } : v));
  } catch {
    return String(x);
  }
}

// Safety: refuse to run against anything but the disposable container.
const portMap = execFileSync('docker', ['port', CONTAINER, '6379/tcp']).toString();
if (!portMap.includes(':6399')) throw new Error(`refusing to run: ${CONTAINER} is not on :6399 (${portMap})`);

const { Mastra } = await imp('packages/core/dist/mastra/index.js');
const { Agent } = await imp('packages/core/dist/agent/index.js');
const { createDurableAgent } = await imp('packages/core/dist/agent/durable/index.js');
const { InMemoryServerCache } = await imp('packages/core/dist/cache/index.js');
const { ConsoleLogger } = await imp('packages/core/dist/logger/index.js');
const { MockLanguageModelV2 } = await imp('packages/_vendored/ai_v5/dist/test.js');
const { RedisStreamsPubSub, PublishRetryBudgetExhaustedError } = await imp('pubsub/redis-streams/dist/index.js');
const { RedisServerCache } = await imp('stores/redis/dist/index.js');
// Documented wiring (docs harness/durable-agents.mdx, examples/durable-agents): ioredis with default options.
const Redis = createRequire(join(REPO, 'stores/redis/package.json'))('ioredis');

const keyPrefix = `cor1527:${LABEL}`;

// ---- Redis ground truth (separate process inside the container) ----
const monitor = spawn('docker', ['exec', CONTAINER, 'redis-cli', 'MONITOR'], { stdio: ['ignore', 'pipe', 'pipe'] });
monitor.stdout.pipe(createWriteStream(join(runDir, 'monitor.log')));
await new Promise(r => setTimeout(r, 500));

// ---- transport (instrumented on the instance; the class is untouched) ----
const pubsub = new RedisStreamsPubSub({ url: URL, keyPrefix: `${keyPrefix}:topic` });
const innerPublish = pubsub.publish.bind(pubsub);
const pending = new Set();
pubsub.publish = (topic, event, options) => {
  const meta = { topic, id: event?.id, index: event?.index, type: event?.type, chunkSeq: seqOf(event) };
  log('xadd.enter', meta);
  const p = innerPublish(topic, event, options).then(
    () => log('xadd.exit', { ...meta, ok: true }),
    e => {
      log('xadd.exit', {
        ...meta,
        ok: false,
        budgetExhausted: e instanceof PublishRetryBudgetExhaustedError,
        error: errInfo(e),
      });
      throw e;
    },
  );
  pending.add(p);
  p.catch(() => {}).finally(() => pending.delete(p));
  return p;
};

// ---- cache (memory | redis), instrumented via Proxy ----
let cacheClient;
let baseCache;
if (CACHE === 'redis') {
  cacheClient = new Redis(URL);
  cacheClient.on('error', e => log('cacheClient.error', { error: errInfo(e) }));
  await new Promise((res, rej) =>
    cacheClient.status === 'ready' ? res() : (cacheClient.once('ready', res), cacheClient.once('error', rej)),
  );
  baseCache = new RedisServerCache({ client: cacheClient }, { keyPrefix: `${keyPrefix}:cache:` });
} else {
  baseCache = new InMemoryServerCache();
}
const TRACKED = new Set([
  'listPushIndexed',
  'listPush',
  'increment',
  'listLength',
  'listFromTo',
  'get',
  'set',
  'delete',
]);
const cacheCalls = new Map(); // outstanding calls
let cacheCallId = 0;
const cache = new Proxy(baseCache, {
  get(target, prop, receiver) {
    const v = Reflect.get(target, prop, receiver);
    if (typeof v !== 'function' || !TRACKED.has(prop)) return typeof v === 'function' ? v.bind(target) : v;
    return (...a) => {
      const callId = ++cacheCallId;
      const value = a[2] && typeof a[2] === 'object' ? a[2] : prop === 'set' ? a[1] : undefined;
      const meta = {
        callId,
        op: prop,
        key: String(a[0]).slice(-60),
        id: value?.id,
        type: value?.type,
        chunkSeq: seqOf(value),
      };
      log('cache.enter', meta);
      cacheCalls.set(callId, meta);
      return Promise.resolve(v.apply(target, a)).then(
        r => {
          cacheCalls.delete(callId);
          log('cache.exit', { ...meta, ok: true, result: typeof r === 'number' ? r : undefined });
          return r;
        },
        e => {
          cacheCalls.delete(callId);
          log('cache.exit', { ...meta, ok: false, error: errInfo(e) });
          throw e;
        },
      );
    };
  },
});

function seqOf(event) {
  const d = event?.data;
  const text = d?.payload?.text ?? d?.text ?? d?.chunk?.payload?.text;
  const m = typeof text === 'string' && text.match(/^#(\d{6})/);
  return m ? Number(m[1]) : undefined;
}

// ---- deterministic local model: 16-char chunks every CHUNK_MS until stop ----
let stopProducing = false;
let produced = 0;
const model = new MockLanguageModelV2({
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: new ReadableStream({
      async start(controller) {
        controller.enqueue({ type: 'stream-start', warnings: [] });
        controller.enqueue({ type: 'response-metadata', id: 'r1', modelId: 'cor1527-mock', timestamp: new Date(0) });
        controller.enqueue({ type: 'text-start', id: 't1' });
        while (!stopProducing) {
          const seq = produced++;
          const delta = `#${String(seq).padStart(6, '0')}|abcdefgh`; // 16 chars
          log('produce', { chunkSeq: seq });
          controller.enqueue({ type: 'text-delta', id: 't1', delta });
          await new Promise(r => setTimeout(r, CHUNK_MS));
        }
        controller.enqueue({ type: 'text-end', id: 't1' });
        controller.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: produced, totalTokens: produced + 1 },
        });
        log('produce.done', { produced });
        controller.close();
      },
    }),
  }),
});

const baseAgent = new Agent({ id: 'cor1527', name: 'cor1527', instructions: 'echo', model });
// durable: the same agent behind createDurableAgent (awaited, publish-first step frames on mastra.pubsub).
const agent = MODE === 'durable' ? createDurableAgent({ agent: baseAgent }) : baseAgent;
const mastra = new Mastra({
  agents: { cor1527: agent },
  pubsub,
  cache,
  logger: new ConsoleLogger({ name: 'cor1527', level: 'warn' }),
});
const registered = mastra.getAgent('cor1527');

// ---- observer on its own connection (another process would look the same to Redis) ----
const runId = `cor1527-${LABEL}`;
const observerBus = new RedisStreamsPubSub({ url: URL, keyPrefix: `${keyPrefix}:topic` });
const delivered = new Map();
let observerTerminal;
const topic = `agent.stream.${runId}`;
await observerBus.subscribe(topic, async (event, ack) => {
  const seq = seqOf(event);
  log('deliver', { id: event.id, index: event.index, type: event.type, chunkSeq: seq, dup: delivered.has(event.id) });
  delivered.set(event.id, Date.now());
  if (['finish', 'error', 'suspended'].includes(event.type)) observerTerminal = { type: event.type, t: Date.now() };
  await ack?.();
});
log('observer.subscribed', { topic });

writeFileSync(
  join(runDir, 'meta.json'),
  JSON.stringify(
    {
      label: LABEL,
      cache: CACHE,
      mode: MODE,
      runId,
      keyPrefix,
      preS: PRE_S,
      outageS: OUTAGE_S,
      postS: POST_S,
      chunkMs: CHUNK_MS,
      chunkChars: 16,
      publishRetryBudgetMs: 'default (120000)',
      gitHead: execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD']).toString().trim(),
      node: process.version,
      redisImage: execFileSync('docker', ['inspect', '--format', '{{.Image}}', CONTAINER]).toString().trim(),
      redisVersion: execFileSync('docker', ['exec', CONTAINER, 'redis-cli', 'INFO', 'server'])
        .toString()
        .match(/redis_version:(\S+)/)?.[1],
      T0,
    },
    null,
    2,
  ),
);

const docker = (...a) =>
  new Promise((res, rej) => execFile('docker', a, (e, out, err) => (e ? rej(new Error(err || e.message)) : res(out))));

// ---- timeline ----
const outage = (async () => {
  if (OUTAGE_S <= 0) {
    await new Promise(r => setTimeout(r, (PRE_S + POST_S) * 1000));
    stopProducing = true;
    return;
  }
  await new Promise(r => setTimeout(r, PRE_S * 1000));
  log('outage.pause.call');
  await docker('pause', CONTAINER);
  log('outage.start');
  await new Promise(r => setTimeout(r, OUTAGE_S * 1000));
  log('outage.unpause.call', { outstandingCache: [...cacheCalls.values()].length, pendingXadd: pending.size });
  await docker('unpause', CONTAINER);
  log('outage.end');
  await new Promise(r => setTimeout(r, POST_S * 1000));
  stopProducing = true;
})();

const status = setInterval(
  () =>
    log('status', {
      produced,
      outstandingCache: cacheCalls.size,
      oldestCache: [...cacheCalls.values()][0],
      pendingXadd: pending.size,
      delivered: delivered.size,
    }),
  5000,
);

log('run.start', { runId });
let callerChunks = 0;
let callerTerminal;
try {
  const result = await registered.stream('go', { runId });
  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') {
      callerChunks++;
      if (callerChunks % 200 === 1) log('caller.chunk', { n: callerChunks, chunkSeq: seqOf({ data: chunk }) });
    } else if (['finish', 'error', 'abort', 'tripwire'].includes(chunk.type)) {
      callerTerminal = { type: chunk.type, error: errInfo(chunk.payload?.error) };
      log('caller.terminal', callerTerminal);
    }
  }
  log('caller.done', { callerChunks });
} catch (e) {
  log('caller.throw', { error: errInfo(e) });
}
await outage;

// Drain: wait until the observer saw a terminal frame and nothing is outstanding, or DRAIN_S passes.
const drainStart = Date.now();
while (Date.now() - drainStart < DRAIN_S * 1000) {
  if (observerTerminal && pending.size === 0 && cacheCalls.size === 0) break;
  await new Promise(r => setTimeout(r, 1000));
}
clearInterval(status);
log('drain.done', {
  waitedMs: Date.now() - drainStart,
  observerTerminal,
  pendingXadd: pending.size,
  outstandingCache: cacheCalls.size,
  produced,
  delivered: delivered.size,
  callerChunks,
  undeliveredIndices: (() => {
    try {
      const bus = registered.__getStreamBus?.()?.pubsub;
      return bus?.getUndeliveredIndices ? [...(bus.getUndeliveredIndices(topic) ?? [])] : 'n/a';
    } catch (e) {
      return `err: ${e.message}`;
    }
  })(),
});

await new Promise(r => setTimeout(r, 2000));
monitor.kill('SIGTERM');
await Promise.allSettled([observerBus.close(), pubsub.close(), cacheClient?.quit()]);
log('run.end');
timeline.end();
await new Promise(r => timeline.on('finish', r));
console.log(
  JSON.stringify({ label: LABEL, produced, delivered: delivered.size, callerChunks, observerTerminal, callerTerminal }),
);
process.exit(0);
