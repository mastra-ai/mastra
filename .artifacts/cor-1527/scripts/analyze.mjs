// Builds the per-frame truth table and summary for one run directory.
//   node analyze.mjs runs/<label>   -> writes truth-table.csv + summary.json into that directory
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const tl = readFileSync(join(dir, 'timeline.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map(l => JSON.parse(l));
const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
const at = ev => tl.find(e => e.ev === ev)?.t;
const outageStart = at('outage.start');
const outageEnd = at('outage.end');
const rel = t =>
  t === undefined ? '' : outageStart ? ((t - outageStart) / 1000).toFixed(3) : ((t - tl[0].t) / 1000).toFixed(3);

// Redis ground truth: server-side execution time of each command carrying an event id.
const redisXaddByIndex = new Map();
const redisCacheById = new Map();
const uuid = /\\"id\\":\\"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\"/g;
const cmdCounts = { duringOutage: {}, afterOutage: {}, beforeOutage: {} };
for (const line of readFileSync(join(dir, 'monitor.log'), 'utf8').split('\n')) {
  const m = line.match(/^(\d+\.\d+) \[[^\]]*\] "([A-Za-z]+)"/);
  if (!m) continue;
  const t = Math.round(Number(m[1]) * 1000);
  const cmd = m[2].toUpperCase();
  const bucket = !outageStart || t < outageStart ? 'beforeOutage' : t < outageEnd ? 'duringOutage' : 'afterOutage';
  cmdCounts[bucket][cmd] = (cmdCounts[bucket][cmd] ?? 0) + 1;
  if (cmd !== 'XADD' && cmd !== 'EVAL' && cmd !== 'EVALSHA' && cmd !== 'RPUSH') continue;
  if (cmd === 'XADD') {
    if (!line.includes(':topic:agent.stream.')) continue;
    const ix = line.match(/\\"index\\":(\d+)/);
    if (ix) redisXaddByIndex.set(Number(ix[1]), redisXaddByIndex.get(Number(ix[1])) ?? t);
    continue;
  }
  const id = [...line.matchAll(uuid)].map(x => x[1]).at(-1);
  if (id) redisCacheById.set(id, redisCacheById.get(id) ?? t);
}

const frames = new Map();
const idToIndex = new Map();
for (const e of tl)
  if (e.ev === 'cache.exit' && e.op === 'listPushIndexed' && e.ok && e.id) idToIndex.set(e.id, e.result);
const keyOf = e => e.index ?? idToIndex.get(e.id) ?? 'id:' + e.id;
const frame = e => {
  const k = keyOf(e);
  if (!frames.has(k)) frames.set(k, { key: k, deliveries: 0 });
  return frames.get(k);
};
for (const e of tl) {
  if (e.ev === 'cache.enter' && e.op === 'listPushIndexed' && e.id)
    Object.assign(frame(e), { type: e.type, cacheEnter: e.t, id: e.id });
  if (e.ev === 'cache.exit' && e.op === 'listPushIndexed' && e.id)
    Object.assign(frame(e), { cacheExit: e.t, cacheOk: e.ok, index: e.result, cacheError: e.error?.message, id: e.id });
  if (e.ev === 'xadd.enter' && e.id)
    Object.assign(frame(e), { type: e.type, index: e.index, xaddEnter: e.t, id: e.id });
  if (e.ev === 'xadd.exit' && e.id)
    Object.assign(frame(e), {
      xaddExit: e.t,
      xaddOk: e.ok,
      budgetExhausted: e.budgetExhausted,
      xaddError: e.error?.message,
    });
  if (e.ev === 'deliver' && e.id) {
    const f = frame(e);
    f.deliveries++;
    f.deliver ??= e.t;
    if (e.chunkSeq !== undefined) f.chunkSeq = e.chunkSeq;
    f.type ??= e.type;
  }
}
for (const f of frames.values())
  Object.assign(f, { redisXadd: redisXaddByIndex.get(f.index), redisCache: redisCacheById.get(f.id) });

const rows = [...frames.values()].sort(
  (a, b) => (a.cacheEnter ?? a.xaddEnter ?? a.deliver ?? 0) - (b.cacheEnter ?? b.xaddEnter ?? b.deliver ?? 0),
);
const classify = f => {
  if (f.xaddOk === false) {
    if (f.deliveries > 0) return 'rejected-but-delivered';
    if (f.redisXadd) return 'rejected-but-reached-redis';
    return 'rejected-not-delivered';
  }
  if (f.xaddOk === true) return f.deliveries > 0 ? 'resolved-delivered' : 'resolved-not-delivered';
  if (f.xaddEnter) return 'publish-never-settled';
  return 'never-reached-transport';
};
const cols = [
  'key',
  'id',
  'type',
  'chunkSeq',
  'index',
  'class',
  'cacheEnter',
  'cacheExit',
  'cacheOk',
  'redisCache',
  'xaddEnter',
  'xaddExit',
  'xaddOk',
  'budgetExhausted',
  'redisXadd',
  'deliver',
  'deliveries',
];
const timeCols = new Set(['cacheEnter', 'cacheExit', 'redisCache', 'xaddEnter', 'xaddExit', 'redisXadd', 'deliver']);
const csv = [cols.join(',')]
  .concat(
    rows.map(f => cols.map(c => (c === 'class' ? classify(f) : timeCols.has(c) ? rel(f[c]) : (f[c] ?? ''))).join(',')),
  )
  .join('\n');
writeFileSync(join(dir, 'truth-table.csv'), csv + '\n');

const byClass = {};
for (const f of rows) byClass[classify(f)] = (byClass[classify(f)] ?? 0) + 1;
const rejected = rows.filter(f => f.xaddOk === false);
const longest = (a, b) => Math.max(0, ...rows.filter(f => f[a] && f[b]).map(f => f[b] - f[a]));
const consoleMsgs = {};
for (const e of tl.filter(e => e.ev.startsWith('console.'))) {
  const k = e.msg
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<uuid>')
    .replace(/cor1527-[\w-]+/g, '<run>')
    .slice(0, 140);
  consoleMsgs[k] ??= { count: 0, first: rel(e.t), last: '' };
  consoleMsgs[k].count++;
  consoleMsgs[k].last = rel(e.t);
}
const summary = {
  label: meta.label,
  mode: meta.mode,
  cache: meta.cache,
  timesAreSecondsRelativeTo: outageStart ? 'outage.start' : 'harness T0',
  outageWindow: outageStart ? [0, (outageEnd - outageStart) / 1000] : null,
  produced: tl.filter(e => e.ev === 'produce').length,
  framesSeen: rows.length,
  byClass,
  rejections: rejected.map(f => ({
    id: f.id,
    chunkSeq: f.chunkSeq,
    index: f.index,
    xaddEnter: rel(f.xaddEnter),
    rejectedAt: rel(f.xaddExit),
    budgetExhausted: f.budgetExhausted,
    error: f.xaddError,
    reachedRedisAt: rel(f.redisXadd),
    deliveredAt: rel(f.deliver),
  })),
  firstRejectionAt: rejected.length ? rel(Math.min(...rejected.map(f => f.xaddExit))) : null,
  longestCacheAppendMs: longest('cacheEnter', 'cacheExit'),
  longestPublishMs: longest('xaddEnter', 'xaddExit'),
  firstDeliveryAfterOutageEnd: rel(
    rows
      .map(f => f.deliver)
      .filter(t => t && t >= outageEnd)
      .sort()[0],
  ),
  lastDelivery: rel(Math.max(...rows.map(f => f.deliver ?? 0))),
  undeliveredChunkSeqs: (() => {
    const del = new Set(rows.filter(f => f.deliveries > 0 && f.chunkSeq !== undefined).map(f => f.chunkSeq));
    const n = tl.filter(e => e.ev === 'produce').length;
    const missing = [];
    for (let i = 0; i < n; i++) if (!del.has(i)) missing.push(i);
    return { count: missing.length, first: missing.slice(0, 20) };
  })(),
  duplicateDeliveries: rows.filter(f => f.deliveries > 1).length,
  redisCommands: cmdCounts,
  caller: tl
    .filter(e => e.ev.startsWith('caller.terminal') || e.ev === 'caller.throw' || e.ev === 'caller.done')
    .map(e => ({ ...e, at: rel(e.t) })),
  observerTerminalAt: rel(tl.find(e => e.ev === 'deliver' && ['finish', 'error', 'suspended'].includes(e.type))?.t),
  observerTerminals: tl
    .filter(e => e.ev === 'deliver' && ['finish', 'error', 'suspended'].includes(e.type))
    .map(e => ({ type: e.type, at: rel(e.t), index: e.index })),
  drain: tl.find(e => e.ev === 'drain.done'),
  consoleMessages: consoleMsgs,
};
writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(
  JSON.stringify(
    { ...summary, rejections: summary.rejections.length, redisCommands: undefined, consoleMessages: undefined },
    null,
    1,
  ),
);
