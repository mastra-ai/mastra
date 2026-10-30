// Seeding-write benchmark. Run from stores/libsql:  npx tsx .perf/bench.ts <variant> <N> [budgetSec]
// variants: direct-mem direct-file tools-mem tools-file tools-file-semantic direct-file-multi
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { rmSync, statSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { LibSQLVector } from '../src/vector/index';
import { KnowledgeLibSQL } from '../src/storage/domains/knowledge/index';
import { RequestContext } from '../../../packages/core/src/request-context';
import { setRunAgentScopes } from '../../../packages/core/src/agent/scopes';
import { knowledgeMemoryScopes } from '../../../packages/core/src/knowledge/declarations';
import { buildKnowledgePageTools } from '../../../packages/core/src/knowledge/page-tools';
import { KnowledgeScopeRuntime } from '../../../packages/core/src/knowledge/scope-runtime';
import { KnowledgeSemanticIndex } from '../../../packages/core/src/knowledge/semantic';
import { emitKnowledgeChanges } from '../../../packages/core/src/knowledge/changes';

const [variant = 'direct-mem', nArg = '1000', budgetArg = '180'] = process.argv.slice(2);
const N = Number(nArg);
const budgetMs = Number(budgetArg) * 1000;
const file = `/tmp/seedperf-${variant}.db`;
for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-vec.db`]) rmSync(f, { force: true });
const url = variant.includes('mem') ? ':memory:' : `file:${file}`;
const who = { author: 'seed' };

// --- count statements / transactions at the client boundary
const client = createClient({ url });
const counts = { statements: 0, transactions: 0, sqlMs: 0 };
const byKind: Record<string, { n: number; ms: number }> = {};
const kindOf = (sql: string) => {
  const m = sql.trim().match(/^(\w+)(?:\s+(?:INTO|FROM|OR IGNORE INTO))?\s+"?(\w+)?/i);
  return `${m?.[1]?.toUpperCase()} ${m?.[2] ?? ''}`.trim();
};
const timed = async (sql: string, run: () => Promise<any>) => {
  const t = performance.now();
  try {
    return await run();
  } finally {
    const d = performance.now() - t;
    counts.statements++;
    counts.sqlMs += d;
    const k = kindOf(sql);
    (byKind[k] ??= { n: 0, ms: 0 }).n++;
    byKind[k]!.ms += d;
  }
};
const wrapExec = (target: any) => {
  const orig = target.execute.bind(target);
  target.execute = (s: any) => timed(typeof s === 'string' ? s : s.sql, () => orig(s));
};
wrapExec(client);
const origTx = client.transaction.bind(client);
(client as any).transaction = async (mode: any) => {
  counts.transactions++;
  const tx = await origTx(mode);
  wrapExec(tx);
  return tx;
};

const knowledgeStore = new KnowledgeLibSQL({ client });
await knowledgeStore.init();
const rawStore: any = knowledgeStore;

const scopes: any = {
  ...knowledgeMemoryScopes(),
  'role:$orgId:policy-admin': { description: 'Edits company policy' },
  'policy:$orgId': {
    access: [
      { principal: 'org:$orgId', role: 'viewer' },
      { principal: 'role:$orgId:policy-admin', role: 'owner' },
    ],
  },
  'customer:$orgId:$customerId': { access: [{ principal: 'role:$orgId:policy-admin', role: 'owner' }] },
};

const loop = monitorEventLoopDelay({ resolution: 1 });
loop.enable();

const phases: Record<string, number> = {};
const phase = async <T>(name: string, fn: () => Promise<T>) => {
  const t = performance.now();
  try {
    return await fn();
  } finally {
    phases[name] = (phases[name] ?? 0) + performance.now() - t;
  }
};

let write: (i: number) => Promise<void>;
let embedCalls = 0;
if (variant.startsWith('direct')) {
  const scope = (
    await rawStore.materializeScope({ address: 'policy:acme', declaration: 'policy:$orgId', name: 'policy:acme', provenance: who })
  ).scope;
  const multi = variant.endsWith('multi');
  const parents: string[] = [];
  if (multi) {
    for (let c = 0; c < 100; c++)
      parents.push(
        (
          await rawStore.materializeScope({
            address: `customer:acme:c${c}`,
            declaration: 'customer:$orgId:$customerId',
            name: `c${c}`,
            provenance: who,
          })
        ).scope.id,
      );
  }
  write = async i => {
    await rawStore.createPage({
      parentId: multi ? parents[i % parents.length]! : scope.id,
      name: `Page ${i}`,
      body: `Body of page ${i}. `.repeat(20),
      provenance: who,
    });
  };
} else {
  const runtime = new KnowledgeScopeRuntime(scopes, async () => rawStore, () => {});
  const phasedRuntime: any = runtime;
  for (const m of ['materializeScope', 'readScopeFor', 'roleOn']) {
    const orig = phasedRuntime[m].bind(phasedRuntime);
    phasedRuntime[m] = (...a: any[]) => phase(`runtime.${m}`, () => orig(...a));
  }
  let semantic: KnowledgeSemanticIndex | undefined;
  if (variant.endsWith('semantic')) {
    const vector = new LibSQLVector({ id: 'v', url: `file:${file}-vec.db` } as any);
    const embedder: any = {
      specificationVersion: 'v2',
      provider: 'fake',
      modelId: 'fake',
      maxEmbeddingsPerCall: 100,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: string[] }) => {
        embedCalls += values.length;
        return { embeddings: values.map(v => Array.from({ length: 64 }, (_, k) => Math.sin(v.length + k))), usage: { tokens: 1 } };
      },
    };
    semantic = new KnowledgeSemanticIndex(vector as any, embedder);
  }
  const storage = emitKnowledgeChanges(rawStore, () => {}, () => false, () => {});
  const tools = buildKnowledgePageTools({ runtime, getStorage: async () => storage, semantic, warn: m => console.warn(m) }, { read: true, write: true, pins: true });
  const sem: any = semantic;
  if (sem) {
    for (const m of ['indexPage']) {
      const orig = sem[m].bind(sem);
      sem[m] = (...a: any[]) => phase('semantic.indexPage', () => orig(...a));
    }
  }
  for (const m of ['createPage']) {
    const orig = rawStore[m].bind(rawStore);
    rawStore[m] = (...a: any[]) => phase('store.createPage', () => orig(...a));
  }
  write = async i => {
    const rc = new RequestContext();
    setRunAgentScopes(rc, ['org:acme', 'role:acme:policy-admin']);
    await phase('tool.total', () =>
      tools.knowledge_page!.execute!(
        { op: 'write', scope: 'policy:acme', name: `Page ${i}`, body: `Body of page ${i}. `.repeat(20) } as never,
        { requestContext: rc, agent: { agentId: 'seeder' } } as never,
      ),
    );
  };
}

const windows: string[] = [];
const start = performance.now();
let winStart = start;
let winSql = 0;
let done = 0;
const checkpoint = Math.max(500, Math.floor(N / 10));
for (let i = 0; i < N; i++) {
  await write(i);
  done++;
  if (done % checkpoint === 0) {
    const now = performance.now();
    windows.push(`${done}:${Math.round((checkpoint / (now - winStart)) * 1000)}/s`);
    winStart = now;
  }
  if (performance.now() - start > budgetMs) break;
}
const elapsed = performance.now() - start;
loop.disable();
const size = (() => {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
})();
const out = {
  variant,
  target: N,
  done,
  seconds: +(elapsed / 1000).toFixed(1),
  writesPerSec: Math.round((done / elapsed) * 1000),
  stmtsPerWrite: +(counts.statements / done).toFixed(1),
  txPerWrite: +(counts.transactions / done).toFixed(2),
  sqlShare: +((counts.sqlMs / elapsed) * 100).toFixed(0) + '%',
  sqlMsPerWrite: +(counts.sqlMs / done).toFixed(3),
  loopDelayMs: { mean: +(loop.mean / 1e6).toFixed(2), p99: +(loop.percentile(99) / 1e6).toFixed(1), max: +(loop.max / 1e6).toFixed(0) },
  phasesMsPerWrite: Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, +(v / done).toFixed(3)])),
  embedCalls,
  windows,
  dbMB: +(size / 1e6).toFixed(1),
  topSql: Object.entries(byKind)
    .sort((a, b) => b[1].ms - a[1].ms)
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${(v.n / done).toFixed(1)}/write ${(v.ms / done).toFixed(3)}ms`),
};
console.log(JSON.stringify(out, null, 1));
