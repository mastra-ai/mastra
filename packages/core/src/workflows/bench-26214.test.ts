// Storage benchmark for #26214 foreach checkpoints. Not a regression test; driven by env vars.
import { appendFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

const STORE = process.env.BENCH_STORE ?? 'libsql';
const N = Number(process.env.BENCH_N ?? 100);
const SIZE = Number(process.env.BENCH_SIZE ?? 2000);
const C = Number(process.env.BENCH_C ?? 1);
const LABEL = process.env.BENCH_LABEL ?? 'unknown';
const OUT = process.env.BENCH_OUT ?? '/tmp/bench.jsonl';
const DELAY = Number(process.env.BENCH_DELAY_MS ?? 0);
const INTERVAL = process.env.BENCH_INTERVAL_MS === undefined ? undefined : Number(process.env.BENCH_INTERVAL_MS);
const DB_FILE = '/tmp/bench-26214.db';
const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/bench';

function libsqlBytes() {
  let total = 0;
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) if (existsSync(f)) total += statSync(f).size;
  return total;
}

it(
  'bench',
  async () => {
    let realStorage: any;
    let pgQuery: ((sql: string) => Promise<any>) | undefined;
    if (STORE === 'libsql') {
      const { LibSQLStore } = await import('/workspace/mastra/stores/libsql/dist/index.js' as string);
      realStorage = new LibSQLStore({ id: 'bench', url: `file:${DB_FILE}` });
    } else {
      const { PostgresStore } = await import('/workspace/mastra/stores/pg/dist/index.js' as string);
      realStorage = new PostgresStore({ id: 'bench', connectionString: PG_URL });
    }
    await realStorage.init();
    const realWorkflows = await realStorage.getStore('workflows');

    if (STORE === 'pg') {
      const { default: pg } = await import('/workspace/mastra/stores/pg/node_modules/pg/lib/index.js' as string);
      const client = new pg.Client({ connectionString: PG_URL });
      await client.connect();
      pgQuery = (sql: string) => client.query(sql);
      await pgQuery('TRUNCATE mastra_workflow_snapshot');
      await pgQuery('VACUUM FULL mastra_workflow_snapshot');
    }
    const relSize = async () =>
      Number((await pgQuery!(`SELECT pg_total_relation_size('mastra_workflow_snapshot') AS s`)).rows[0].s);
    const diskBefore = STORE === 'pg' ? await relSize() : libsqlBytes();

    const stats = { writes: 0, bytes: 0, largest: 0, measureMs: 0, storeMs: 0 };
    const realPersist = realWorkflows.persistWorkflowSnapshot.bind(realWorkflows);
    const wrapped = realWorkflows;
    wrapped.persistWorkflowSnapshot = async (args: any) => {
      const t0 = performance.now();
      const len = Buffer.byteLength(JSON.stringify(args.snapshot));
      stats.measureMs += performance.now() - t0;
      stats.writes++;
      stats.bytes += len;
      stats.largest = Math.max(stats.largest, len);
      const t1 = performance.now();
      try {
        return await realPersist(args);
      } finally {
        stats.storeMs += performance.now() - t1;
      }
    };

    const storage = new MockStore();
    const origGetStore = storage.getStore.bind(storage);
    vi.spyOn(storage, 'getStore').mockImplementation((async (name: any) =>
      name === 'workflows' ? wrapped : origGetStore(name)) as any);

    const payload = 'x'.repeat(SIZE);
    const item = createStep({
      id: 'item',
      inputSchema: z.number(),
      outputSchema: z.object({ i: z.number(), data: z.string() }),
      execute: async ({ inputData }) => {
        if (DELAY) await new Promise(resolve => setTimeout(resolve, DELAY));
        return { i: inputData, data: payload };
      },
    });
    const workflow = createWorkflow({
      id: 'bench',
      inputSchema: z.array(z.number()),
      outputSchema: z.array(z.object({ i: z.number(), data: z.string() })),
    })
      .foreach(item, { concurrency: C, ...(INTERVAL !== undefined ? { checkpointIntervalMs: INTERVAL } : {}) })
      .commit();
    new Mastra({ logger: false, storage, workflows: { bench: workflow } });

    const partial = setInterval(
      () => writeFileSync('/tmp/bench-partial.json', JSON.stringify({ LABEL, STORE, N, SIZE, C, ...stats })),
      5000,
    );
    const start = performance.now();
    const run = await workflow.createRun();
    const result = await run.start({ inputData: Array.from({ length: N }, (_, i) => i) });
    const wallMs = performance.now() - start;
    clearInterval(partial);
    if (result.status !== 'success') throw new Error(`run ended ${result.status}`);

    let diskAfter: number;
    let diskAfterVacuum: number | undefined;
    if (STORE === 'pg') {
      diskAfter = await relSize();
      await pgQuery!('VACUUM mastra_workflow_snapshot');
      diskAfterVacuum = await relSize();
    } else {
      diskAfter = libsqlBytes();
    }

    const row = {
      label: LABEL,
      store: STORE,
      n: N,
      size: SIZE,
      delayMs: DELAY,
      intervalMs: INTERVAL ?? 1000,
      c: C,
      writes: stats.writes,
      bytes: stats.bytes,
      largest: stats.largest,
      wallMs: Math.round(wallMs - stats.measureMs),
      storeMs: Math.round(stats.storeMs),
      diskGrowth: diskAfter - diskBefore,
      diskGrowthAfterVacuum: diskAfterVacuum === undefined ? undefined : diskAfterVacuum - diskBefore,
    };
    appendFileSync(OUT, JSON.stringify(row) + '\n');
    console.log('BENCH', JSON.stringify(row));
  },
  30 * 60_000,
);
