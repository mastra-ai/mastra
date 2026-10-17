// Measures Postgres queries and bytes written by durable/evented agent runs.
// See README.md in this directory for setup and how to read the output.
// Usage: node durable-bench.mjs <mode> <steps> <concurrency> <toolBytes> [memory]
//   mode: durable-off | durable-auto | evented
// Env: DATABASE_URL (default postgresql://postgres:postgres@127.0.0.1:5434/postgres),
//      POOL_MAX (PostgresStore pool size, default 20), RANDOM_BODY=1 (incompressible tool output),
//      SAVE_PER_STEP=1 (with [memory]: save messages each step so checkpoints reference them)
import { fileURLToPath } from 'node:url';
const M = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');
const pg = (await import(`${M}/stores/pg/node_modules/pg/lib/index.js`)).default;
const { Mastra } = await import(`${M}/packages/core/dist/mastra/index.js`);
const { Agent } = await import(`${M}/packages/core/dist/agent/index.js`);
const { createDurableAgent, createEventedAgent } = await import(`${M}/packages/core/dist/agent/durable/index.js`);
const { createTool } = await import(`${M}/packages/core/dist/tools/index.js`);
const { PostgresStore } = await import(`${M}/stores/pg/dist/index.js`);
const { z } = await import(`${M}/packages/core/node_modules/zod/index.js`);

const [mode = 'durable-off', stepsArg = '5', concArg = '1', toolBytesArg = '2000', memArg] = process.argv.slice(2);
const STEPS = Number(stepsArg);
const CONC = Number(concArg);
const TOOL_BYTES = Number(toolBytesArg);
const WITH_MEMORY = memArg === 'memory';
const CONN = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5434/postgres';

// ---- query accounting ---------------------------------------------------
let counting = false;
const stats = new Map();
const bump = (key, bytes) => {
  const s = stats.get(key) ?? { n: 0, bytes: 0 };
  s.n++;
  s.bytes += bytes;
  stats.set(key, s);
};
const classify = text => {
  const t = text.replace(/\s+/g, ' ').trim();
  const verb = (
    t.match(/^(WITH|SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|CREATE|ALTER|DO|SET)/i)?.[1] ??
    'OTHER'
  ).toUpperCase();
  const table = t.match(/"?(mastra_[a-z_]+)"?/i)?.[1] ?? '';
  const lock = /FOR UPDATE/i.test(t) ? ' FOR UPDATE' : '';
  return `${verb}${lock} ${table}`.trim();
};
const origQuery = pg.Client.prototype.query;
pg.Client.prototype.query = function (config, values, cb) {
  if (counting) {
    const text = typeof config === 'string' ? config : (config?.text ?? '');
    const vals = Array.isArray(values) ? values : (config?.values ?? []);
    const bytes =
      Buffer.byteLength(text) +
      vals.reduce((a, v) => a + (v == null ? 0 : Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v))), 0);
    bump(classify(text), bytes);
  }
  return origQuery.call(this, config, values, cb);
};

// ---- mock model: (STEPS-1) tool calls, then a final text answer ----------
const model = {
  specificationVersion: 'v2',
  provider: 'mock',
  modelId: 'mock-model',
  supportedUrls: {},
  async doGenerate() {
    throw new Error('not used');
  },
  async doStream(opts) {
    const toolMsgs = opts.prompt.filter(m => m.role === 'tool').length;
    const parts = [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: `r-${Math.random()}`, modelId: 'mock-model', timestamp: new Date(0) },
    ];
    if (toolMsgs < STEPS - 1) {
      parts.push({
        type: 'tool-call',
        toolCallId: `tc-${toolMsgs}-${Math.random().toString(36).slice(2)}`,
        toolName: 'fetchDoc',
        input: JSON.stringify({ i: toolMsgs }),
      });
      parts.push({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      });
    } else {
      parts.push(
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'done '.repeat(40) },
        { type: 'text-end', id: 't1' },
      );
      parts.push({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
      });
    }
    return {
      stream: new ReadableStream({
        start(c) {
          for (const p of parts) c.enqueue(p);
          c.close();
        },
      }),
    };
  },
};

const fetchDoc = createTool({
  id: 'fetchDoc',
  description: 'fetch a document',
  inputSchema: z.object({ i: z.number() }),
  execute: async ({ i }) => ({
    i,
    body: process.env.RANDOM_BODY
      ? (await import('node:crypto'))
          .randomBytes(Math.ceil((TOOL_BYTES * 3) / 4))
          .toString('base64')
          .slice(0, TOOL_BYTES)
      : 'x'.repeat(TOOL_BYTES),
  }),
});

// ---- setup ----------------------------------------------------------------
const storage = new PostgresStore({ id: 'bench', connectionString: CONN, max: Number(process.env.POOL_MAX ?? 20) });
let memory;
if (WITH_MEMORY) {
  const { Memory } = await import(`${M}/packages/memory/dist/index.js`);
  memory = new Memory({ storage, options: { lastMessages: 20 } });
}
const base = new Agent({
  id: 'bench',
  name: 'bench',
  instructions: 'You are a benchmark agent.',
  model,
  tools: { fetchDoc },
  ...(memory ? { memory } : {}),
});
const agent = mode === 'evented' ? createEventedAgent({ agent: base }) : createDurableAgent({ agent: base });
const mastra = new Mastra({
  storage,
  agents: { bench: agent },
  logger: false,
  ...(mode === 'durable-auto' ? { recovery: { durableAgents: 'auto' } } : {}),
});
await storage.init();

const pool = new pg.Pool({ connectionString: CONN, max: 1 });
const q = async (sql, p) => (await pool.query(sql, p)).rows;
const snapSize = async () =>
  (
    await q(
      `SELECT coalesce(pg_total_relation_size('mastra_workflow_snapshot'),0)::bigint AS total, (SELECT count(*) FROM mastra_workflow_snapshot)::int AS rows`,
    )
  )[0];

// Sample peak snapshot row size while runs are in flight.
let peakRow = 0;
let peakRows = 0;
let sampling = true;
const sampler = (async () => {
  const sp = new pg.Pool({ connectionString: CONN, max: 1 });
  while (sampling) {
    try {
      const r = (
        await sp.query(
          `SELECT coalesce(max(pg_column_size(snapshot)),0)::int AS m, count(*)::int AS c FROM mastra_workflow_snapshot`,
        )
      ).rows[0];
      peakRow = Math.max(peakRow, r.m);
      peakRows = Math.max(peakRows, r.c);
    } catch {}
    await new Promise(r => setTimeout(r, 20));
  }
  await sp.end();
})();

const before = await snapSize();
const a = mastra.getAgent('bench');
counting = true;
const t0 = Date.now();
await Promise.all(
  Array.from({ length: CONC }, async (_, k) => {
    const opts = {
      maxSteps: STEPS + 2,
      ...(WITH_MEMORY ? { memory: { thread: `t-${k}-${Date.now()}`, resource: `u-${k}` } } : {}),
      ...(WITH_MEMORY && process.env.SAVE_PER_STEP ? { savePerStep: true } : {}),
    };
    const res = await a.stream('start', opts);
    const out = res.output ?? res;
    if (out?.consumeStream) await out.consumeStream();
    else if (res.fullStream) for await (const _ of res.fullStream);
    if (out?.text) await out.text;
    if (res.cleanup) await res.cleanup();
  }),
);
const elapsed = Date.now() - t0;
await new Promise(r => setTimeout(r, 1500)); // let background terminal writes settle
counting = false;
sampling = false;
await sampler;
const after = await snapSize();

const rows = [...stats.entries()].sort((x, y) => y[1].n - x[1].n);
const totalQ = rows.reduce((s, [, v]) => s + v.n, 0);
const totalB = rows.reduce((s, [, v]) => s + v.bytes, 0);
const snapWrites = rows
  .filter(([k]) => /^(INSERT|UPDATE).*mastra_workflow_snapshot/.test(k))
  .reduce((s, [, v]) => s + v.n, 0);
const snapBytes = rows
  .filter(([k]) => /^(INSERT|UPDATE).*mastra_workflow_snapshot/.test(k))
  .reduce((s, [, v]) => s + v.bytes, 0);
console.log(
  JSON.stringify({
    mode,
    steps: STEPS,
    concurrency: CONC,
    toolBytes: TOOL_BYTES,
    memory: WITH_MEMORY,
    elapsedMs: elapsed,
    queriesTotal: totalQ,
    queriesPerRunStep: +(totalQ / (CONC * STEPS)).toFixed(1),
    bytesSentTotal: totalB,
    bytesPerRunStep: Math.round(totalB / (CONC * STEPS)),
    snapshotWrites: snapWrites,
    snapshotWriteBytes: snapBytes,
    peakSnapshotRowBytes: peakRow,
    peakSnapshotRows: peakRows,
    snapshotTableBytesBefore: Number(before.total),
    snapshotTableBytesAfter: Number(after.total),
    snapshotRowsAfter: after.rows,
    breakdown: Object.fromEntries(rows.map(([k, v]) => [k, v])),
  }),
);
await pool.end();
process.exit(0);
