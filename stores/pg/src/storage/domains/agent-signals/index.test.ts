import { randomUUID } from 'node:crypto';
import { createAgentSignalsTests } from '@internal/storage-test-utils';
import type { AgentSignalsStorage, StoredAgentSignalPayload } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { connectionString } from '../../test-utils';
import { AgentSignalsPG } from './index';

const newThread = () => `thread-${randomUUID()}`;
const newRun = () => `run-${randomUUID()}`;
// Short enough that schema-prefixed index names stay under Postgres's 63-byte identifier limit.
const newSchema = (name: string) => `signals_${name}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;

async function signalsOf(store: PostgresStore): Promise<AgentSignalsStorage> {
  await store.init();
  return (await store.getStore('agentSignals'))!;
}

const ids = (count: number) => Array.from({ length: count }, (): string => randomUUID());

/** Enqueues in parallel chunks: the order of these rows does not matter to the tests that use it. */
async function enqueueMany(signals: AgentSignalsStorage, threadKey: string, runId: string | null, rowIds: string[]) {
  for (let start = 0; start < rowIds.length; start += 100) {
    await Promise.all(
      rowIds
        .slice(start, start + 100)
        .map(id => signals.enqueue({ id, threadKey, runId, scope: 'pending', signal: { id } })),
    );
  }
}

// Two stores with their own pools on one database and schema stand in for two processes, so the
// suite's races overlap on separate connections. The schema is the file's own because the suite
// clears the whole domain.
describe('Postgres agent signals', () => {
  const schemaName = newSchema('suite');
  const stores = ['a', 'b'].map(id => new PostgresStore({ id: `agent-signals-${id}`, connectionString, schemaName }));
  const pool = new Pool({ connectionString });

  afterAll(async () => {
    try {
      await Promise.allSettled(stores.map(store => store.close()));
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await pool.end();
    }
  });

  createAgentSignalsTests({ storage: stores[0]!, peerStorage: stores[1]! });

  describe('takeovers racing deletions', () => {
    let signals: AgentSignalsStorage;
    let peer: AgentSignalsStorage;

    beforeAll(async () => {
      signals = await signalsOf(stores[0]!);
      peer = await signalsOf(stores[1]!);
    });

    it('settles a takeover racing a cancel of its own row and a leftover without a deadlock', async () => {
      // The takeover needs several round trips before it locks rows, so the cancel starts after a
      // varying number of reads on its own pool, and several threads race at once.
      const race = async (_: unknown, lead: number) => {
        const threadKey = newThread();
        const claimer = newRun();
        const own = randomUUID();
        const leftover = randomUUID();
        await signals.enqueue({ id: own, threadKey, runId: claimer, scope: 'pre-run', signal: {} });
        await signals.enqueue({ id: leftover, threadKey, runId: null, scope: 'pending', signal: {} });

        const [claimed, cancelled] = await Promise.all([
          signals.claim({ threadKey, runId: claimer, scope: 'pre-run', leftovers: true }),
          (async () => {
            for (let read = 0; read < lead; read++) await peer.listPending({ threadKey: newThread() });
            return peer.cancel({ threadKey, ids: [own, leftover] });
          })(),
        ]);

        // Both rows go one way: the takeover claims both and the cancel finds them claimed, or the
        // cancel deletes both before the takeover reads them.
        const outcome = { claimed: claimed.map(row => row.id), cancelled: [...cancelled].sort() };
        expect([
          { claimed: [own, leftover], cancelled: [] },
          { claimed: [], cancelled: [own, leftover].sort() },
        ]).toContainEqual(outcome);
        expect(await signals.listPending({ threadKey })).toEqual([]);
      };
      for (let iteration = 0; iteration < 20; iteration++) {
        await Promise.all(Array.from({ length: 8 }, race));
      }
    });

    it('settles a takeover racing deleteThread without a deadlock', async () => {
      for (let iteration = 0; iteration < 30; iteration++) {
        const threadKey = newThread();
        const claimer = newRun();
        const other = newRun();
        const rows = [randomUUID(), randomUUID(), randomUUID()];
        await signals.enqueue({ id: rows[0]!, threadKey, runId: claimer, scope: 'pre-run', signal: {} });
        await signals.enqueue({ id: rows[1]!, threadKey, runId: null, scope: 'pending', signal: {} });
        await signals.enqueue({ id: rows[2]!, threadKey, runId: other, scope: 'pending', signal: {} });

        const [claimed] = await Promise.all([
          signals.claim({ threadKey, runId: claimer, scope: 'pre-run', leftovers: true }),
          peer.deleteThread({ threadKey }),
        ]);

        // The takeover ran first and claimed every row, or found the thread already deleted. Either
        // way the deletion leaves nothing pending, and the claimer is open.
        expect([[], rows]).toContainEqual(claimed.map(row => row.id));
        expect(await signals.listPending({ threadKey })).toEqual([]);
        expect(
          await signals.enqueue({ id: randomUUID(), threadKey, runId: claimer, scope: 'pending', signal: {} }),
        ).toBe('accepted');
      }
    });

    it('settles a readdress racing deleteThread without a deadlock', async () => {
      for (let iteration = 0; iteration < 30; iteration++) {
        const threadKey = newThread();
        const fromRunId = newRun();
        const toRunId = newRun();
        const row = randomUUID();
        await signals.enqueue({ id: row, threadKey, runId: fromRunId, scope: 'pending', signal: {} });

        const [result] = await Promise.all([
          signals.readdress({ threadKey, fromRunId, toRunId }),
          peer.deleteThread({ threadKey }),
        ]);

        // The target is open whichever ran first: deleteThread removes markers, and a marker the
        // readdress no longer finds is created again as open. The row is deleted either with the
        // thread or after it moved.
        expect(result).toBe('accepted');
        expect(await signals.listPending({ threadKey })).toEqual([]);
        expect(
          await signals.enqueue({ id: randomUUID(), threadKey, runId: toRunId, scope: 'pending', signal: {} }),
        ).toBe('accepted');
      }
    });
  });

  describe('Postgres specifics', () => {
    let signals: AgentSignalsStorage;
    let peer: AgentSignalsStorage;

    beforeAll(async () => {
      signals = await signalsOf(stores[0]!);
      peer = await signalsOf(stores[1]!);
    });

    it('keeps its tables, identity sequence and indexes in the store schema', async () => {
      const { rows } = await pool.query<{ name: string; kind: string; schema: string }>(
        `SELECT c.relname AS name, c.relkind AS kind, n.nspname AS schema
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.oid IN (
           SELECT t.oid FROM pg_class t JOIN pg_namespace tn ON tn.oid = t.relnamespace
           WHERE tn.nspname = $1 AND t.relname IN ('mastra_agent_signals', 'mastra_agent_signal_runs')
           UNION SELECT i.indexrelid FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
             JOIN pg_namespace tn ON tn.oid = t.relnamespace
             WHERE tn.nspname = $1 AND t.relname IN ('mastra_agent_signals', 'mastra_agent_signal_runs')
           UNION SELECT d.objid FROM pg_depend d JOIN pg_class t ON t.oid = d.refobjid
             JOIN pg_namespace tn ON tn.oid = t.relnamespace
             WHERE tn.nspname = $1 AND t.relname = 'mastra_agent_signals' AND d.classid = 'pg_class'::regclass
         )
         -- TOAST tables always live in pg_toast.
         AND c.relkind <> 't'
         ORDER BY c.relname`,
        [schemaName],
      );
      expect(rows.map(row => [row.name, row.kind, row.schema]).sort()).toEqual(
        [
          ['mastra_agent_signal_runs', 'r'],
          ['mastra_agent_signal_runs_pkey', 'i'],
          [`${schemaName}_idx_agent_signal_runs_open`, 'i'],
          ['mastra_agent_signals', 'r'],
          ['mastra_agent_signals_pkey', 'i'],
          ['mastra_agent_signals_seq_seq', 'S'],
          [`${schemaName}_idx_agent_signals_run_scope`, 'i'],
        ]
          .map(([name, kind]) => [name, kind, schemaName])
          .sort(),
      );

      const { rows: inPublic } = await pool.query(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname LIKE $1`,
        [`${schemaName}%`],
      );
      expect(inPublic).toEqual([]);
    });

    it('names the default schema in the exported identity statement as its CREATE TABLE does', () => {
      const ddl = AgentSignalsPG.getExportDDL().join('\n');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "public"."mastra_agent_signals"');
      expect(ddl).toContain(`to_regclass('"public"."mastra_agent_signals"')`);
      expect(ddl).toContain(
        'ALTER TABLE "public"."mastra_agent_signals" ALTER COLUMN "seq" ADD GENERATED ALWAYS AS IDENTITY',
      );
    });

    it('works on a schema created from the exported DDL alone', async () => {
      const exported = newSchema('ddl');
      try {
        await pool.query(`CREATE SCHEMA "${exported}"`);
        for (const statement of AgentSignalsPG.getExportDDL(exported)) await pool.query(statement);
        const domain = new AgentSignalsPG({ pool, schemaName: exported });
        const threadKey = newThread();
        const runId = newRun();

        await domain.enqueue({ id: 'first', threadKey, runId, scope: 'pending', signal: { n: 1 } });
        await domain.enqueue({ id: 'second', threadKey, runId, scope: 'pending', signal: { n: 2 } });
        expect((await domain.claim({ threadKey, runId, scope: 'pending' })).map(row => row.id)).toEqual([
          'first',
          'second',
        ]);
        const { rows } = await pool.query(
          `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename LIKE 'mastra_agent_signal%' ORDER BY 1`,
          [exported],
        );
        expect(rows.map(row => row.indexname).sort()).toEqual(
          [
            `${exported}_idx_agent_signal_runs_open`,
            `${exported}_idx_agent_signals_run_scope`,
            'mastra_agent_signal_runs_pkey',
            'mastra_agent_signals_pkey',
          ].sort(),
        );
      } finally {
        await pool.query(`DROP SCHEMA IF EXISTS "${exported}" CASCADE`);
      }
    });

    it('takes id lists longer than the bind parameter limit in closeRun, cancel and delete', async () => {
      // Postgres caps one statement at 65,535 bind parameters, so a placeholder per id fails on
      // these lists. Most ids have no row: the lists test the parameters, not the row count.
      const padding = () => ids(70_000);
      const threadKey = newThread();
      const runId = newRun();
      const closing = ids(50);
      await enqueueMany(signals, threadKey, runId, closing);
      await signals.claim({ threadKey, runId, scope: 'pending' });
      await signals.closeRun({ threadKey, runId, consumedIds: [...padding(), ...closing.slice(0, 40)] });
      expect((await signals.listPending({ threadKey, runId: null })).map(row => row.id).sort()).toEqual(
        closing.slice(40).sort(),
      );

      const otherThread = newThread();
      const cancelling = ids(200);
      await enqueueMany(signals, otherThread, null, cancelling);
      const cancelled = await signals.cancel({
        threadKey: otherThread,
        ids: [...cancelling.slice(0, 150), ...padding()],
      });
      expect(cancelled.sort()).toEqual(cancelling.slice(0, 150).sort());
      await signals.delete({ ids: [...padding(), ...cancelling.slice(150)] });
      expect(await signals.listPending({ threadKey: otherThread })).toEqual([]);
    });

    it('stores the normalized form of a payload with a NUL character and a lone surrogate', async () => {
      const threadKey = newThread();
      const id = randomUUID();
      const signal: StoredAgentSignalPayload = { text: 'a\u0000b', broken: 'x\uD800y', 'k\u0000ey': 'v' };

      await signals.enqueue({ id, threadKey, runId: null, scope: 'pending', signal });

      expect((await signals.listPending({ threadKey }))[0]!.signal).toEqual({
        text: 'ab',
        broken: 'x\uFFFDy',
        key: 'v',
      });
    });

    it('returns a large payload with nested values, numbers and unicode deep-equal to what was enqueued', async () => {
      const threadKey = newThread();
      const runId = newRun();
      const id = randomUUID();
      const signal: StoredAgentSignalPayload = {
        id,
        type: 'user',
        contents: [
          { type: 'text', text: 'Grüße aus Zürich, 東京からこんにちは 👋🏽 🧪 👨‍👩‍👧' },
          { type: 'text', text: 'x'.repeat(1024 * 1024) },
        ],
        numbers: [0, -1, 1.5, 0.1, 1e21, 123456789012345, Number.MAX_SAFE_INTEGER, -2.5e-7],
        attributes: { nested: { list: [true, false, null, { deep: ['a', { deeper: '🚀' }] }] } },
        empty: { object: {}, array: [], text: '' },
      };

      await signals.enqueue({ id, threadKey, runId, scope: 'pending', signal });

      expect((await peer.listPending({ threadKey }))[0]!.signal).toEqual(signal);
      expect((await signals.claim({ threadKey, runId, scope: 'pending' }))[0]!.signal).toEqual(signal);
    });

    it('initializes twice and from a second store on the same schema', async () => {
      const threadKey = newThread();
      const runId = newRun();
      const first = await signals.enqueue({ id: 'before-reinit', threadKey, runId, scope: 'pending', signal: {} });

      const again = new PostgresStore({ id: 'agent-signals-again', connectionString, schemaName });
      try {
        await again.init();
        await again.init();
        const reopened = (await again.getStore('agentSignals'))!;
        await reopened.init();
        await reopened.enqueue({ id: 'after-reinit', threadKey, runId, scope: 'pending', signal: {} });

        expect(first).toBe('accepted');
        expect((await reopened.listPending({ threadKey })).map(row => row.id)).toEqual([
          'before-reinit',
          'after-reinit',
        ]);
      } finally {
        await again.close();
      }
    });

    it('settles readdresses in both directions between two runs without a deadlock', async () => {
      for (let iteration = 0; iteration < 5; iteration++) {
        const threadKey = newThread();
        const runA = newRun();
        const runB = newRun();
        await enqueueMany(signals, threadKey, runA, ids(3));
        await enqueueMany(signals, threadKey, runB, ids(3));

        const calls = Array.from({ length: 20 }, (_, index) => {
          const [fromRunId, toRunId] = index % 2 === 0 ? [runA, runB] : [runB, runA];
          const store = index % 4 < 2 ? signals : peer;
          return store.readdress({ threadKey, fromRunId, toRunId }).then(result => ({ fromRunId, result }));
        });
        const results = await Promise.all(calls);

        // Calls commit one after another. Until the first call in the opposite direction commits,
        // calls toward the still-open target are accepted; that call finds its target closed and
        // deletes what it would have moved, and every later call finds both runs closed.
        const accepted = results.filter(call => call.result === 'accepted');
        expect(accepted.length).toBeGreaterThan(0);
        expect(new Set(accepted.map(call => call.fromRunId)).size).toBe(1);
        expect(
          results.filter(call => call.fromRunId !== accepted[0]!.fromRunId).every(call => call.result === 'run-closed'),
        ).toBe(true);
        expect(await signals.listPending({ threadKey })).toEqual([]);
        for (const runId of [runA, runB]) {
          expect(await signals.enqueue({ id: randomUUID(), threadKey, runId, scope: 'pending', signal: {} })).toBe(
            'run-closed',
          );
        }
      }
    });

    it('settles concurrent takeovers by two runs of one thread without a deadlock', async () => {
      for (let iteration = 0; iteration < 10; iteration++) {
        const threadKey = newThread();
        const others = [newRun(), newRun(), newRun()];
        const unclaimed: string[] = [];
        for (const runId of others) {
          const claimedId = randomUUID();
          await signals.enqueue({ id: claimedId, threadKey, runId, scope: 'pending', signal: {} });
          await signals.claim({ threadKey, runId, scope: 'pending' });
          for (const id of ids(3)) {
            await signals.enqueue({ id, threadKey, runId, scope: 'pending', signal: {} });
            unclaimed.push(id);
          }
        }
        for (const id of ids(2)) {
          await signals.enqueue({ id, threadKey, runId: null, scope: 'pending', signal: {} });
          unclaimed.push(id);
        }
        const claimers = [newRun(), newRun()];

        const results = await Promise.all(
          claimers.map((runId, index) =>
            (index === 0 ? signals : peer).claim({ threadKey, runId, scope: 'pre-run', leftovers: true }),
          ),
        );

        // The takeovers serialize. The first takes every unclaimed row; the second either finds
        // itself closed by the first or takes over in turn, finds nothing unclaimed, and deletes the
        // rows the first claimed. Either way one claimer got every row and the other got none.
        const counts = results.map(rows => rows.length).sort((a, b) => a - b);
        expect(counts).toEqual([0, unclaimed.length]);
        const winner = results.find(rows => rows.length > 0)!;
        expect(winner.map(row => row.id).sort()).toEqual([...unclaimed].sort());
        expect(winner.every(row => row.scope === 'pre-run' && row.claimedBy === winner[0]!.runId)).toBe(true);

        expect(await signals.listPending({ threadKey })).toEqual([]);
        for (const runId of others) {
          expect(await signals.enqueue({ id: randomUUID(), threadKey, runId, scope: 'pending', signal: {} })).toBe(
            'run-closed',
          );
        }
        const probes = await Promise.all(
          claimers.map(runId => signals.enqueue({ id: randomUUID(), threadKey, runId, scope: 'pending', signal: {} })),
        );
        expect(probes.filter(result => result === 'accepted')).toHaveLength(1);
      }
    });
  });
});

describe('Postgres agent signals setup', () => {
  const pool = new Pool({ connectionString });

  afterAll(async () => {
    await pool.end();
  });

  /** Runs `fn` with stores on a fresh schema, then closes them and drops the schema whatever happened. */
  async function onFreshSchema(name: string, fn: (schemaName: string, stores: PostgresStore[]) => Promise<void>) {
    const schemaName = newSchema(name);
    const stores: PostgresStore[] = [];
    try {
      await fn(schemaName, stores);
    } finally {
      await Promise.allSettled(stores.map(store => store.close()));
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  }

  const indexNames = async (schemaName: string) =>
    (
      await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename LIKE 'mastra_agent_signal%'`,
        [schemaName],
      )
    ).rows
      .map(row => row.indexname)
      .sort();

  it('leaves one identity counter when several stores initialize a fresh schema at once', async () => {
    // Whole stores, because concurrent DDL can deadlock and `PostgresStore.init()` is what retries it.
    await onFreshSchema('init', async (schemaName, stores) => {
      for (let index = 0; index < 3; index++) {
        stores.push(new PostgresStore({ id: `agent-signals-init-${index}`, connectionString, schemaName }));
      }
      await Promise.all(stores.map(store => store.init()));

      const { rows } = await pool.query(
        `SELECT a.attidentity, pg_get_serial_sequence($1, 'seq') AS sequence,
           (SELECT count(*) FROM pg_depend d JOIN pg_class s ON s.oid = d.objid
            WHERE d.refobjid = to_regclass($1) AND s.relkind = 'S')::int AS sequences
         FROM pg_attribute a WHERE a.attrelid = to_regclass($1) AND a.attname = 'seq'`,
        [`"${schemaName}"."mastra_agent_signals"`],
      );
      expect(rows).toEqual([
        { attidentity: 'a', sequence: `${schemaName}.mastra_agent_signals_seq_seq`, sequences: 1 },
      ]);
      const { rows: invalid } = await pool.query(
        `SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND NOT i.indisvalid`,
        [schemaName],
      );
      expect(invalid).toEqual([]);
      expect(await indexNames(schemaName)).toEqual(
        [
          `${schemaName}_idx_agent_signal_runs_open`,
          `${schemaName}_idx_agent_signals_run_scope`,
          'mastra_agent_signal_runs_pkey',
          'mastra_agent_signals_pkey',
        ].sort(),
      );

      const signals = (await stores[2]!.getStore('agentSignals'))!;
      const threadKey = newThread();
      for (const id of ['first', 'second']) {
        await signals.enqueue({ id, threadKey, runId: null, scope: 'pending', signal: {} });
      }
      expect((await signals.listPending({ threadKey })).map(row => row.id)).toEqual(['first', 'second']);
    });
  });

  it('creates only the indexes that skipDefaultIndexes and custom indexes ask for', async () => {
    await onFreshSchema('idx', async (schemaName, stores) => {
      const custom = `${schemaName}_custom_signals_created`;
      const store = new PostgresStore({
        id: 'agent-signals-indexes',
        connectionString,
        schemaName,
        skipDefaultIndexes: true,
        indexes: [{ name: custom, table: 'mastra_agent_signals', columns: ['createdAtZ'] }],
      });
      stores.push(store);
      await store.init();

      expect(await indexNames(schemaName)).toEqual(
        [custom, 'mastra_agent_signal_runs_pkey', 'mastra_agent_signals_pkey'].sort(),
      );
    });
  });
});

// A session default stricter than READ COMMITTED must not change what the domain's transactions see
// after waiting for a marker lock. Set through the connection, as a deployment would.
describe('Postgres agent signals on connections that default to REPEATABLE READ', () => {
  const schemaName = newSchema('rr');
  const pools = ['a', 'b'].map(
    () => new Pool({ connectionString, options: '-c default_transaction_isolation=repeatable\\ read' }),
  );
  const stores = pools.map((pool, index) => new PostgresStore({ id: `agent-signals-rr-${index}`, pool, schemaName }));
  let signals: AgentSignalsStorage;
  let peer: AgentSignalsStorage;

  beforeAll(async () => {
    signals = await signalsOf(stores[0]!);
    peer = await signalsOf(stores[1]!);
    const { rows } = await pools[0]!.query(`SHOW default_transaction_isolation`);
    expect(rows[0]!.default_transaction_isolation).toBe('repeatable read');
  });

  afterAll(async () => {
    try {
      await Promise.allSettled(stores.map(store => store.close()));
      await pools[0]!.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await Promise.allSettled(pools.map(pool => pool.end()));
    }
  });

  it('never strands a readdressed row on a run closed at the same time', async () => {
    for (let iteration = 0; iteration < 30; iteration++) {
      const threadKey = newThread();
      const fromRunId = newRun();
      const runId = newRun();
      const moved = randomUUID();
      const own = randomUUID();
      await signals.enqueue({ id: moved, threadKey, runId: fromRunId, scope: 'pending', signal: {} });
      await signals.enqueue({ id: own, threadKey, runId, scope: 'pending', signal: {} });

      const [result] = await Promise.all([
        signals.readdress({ threadKey, fromRunId, toRunId: runId }),
        peer.closeRun({ threadKey, runId, consumedIds: [] }),
      ]);

      // Readdress first: the moved row is released by the close. Close first: the readdress finds
      // the target closed and deletes the row. Nothing stays addressed to the closed run.
      expect(await signals.listPending({ threadKey, runId })).toEqual([]);
      const leftovers = (await signals.listPending({ threadKey, runId: null })).map(row => row.id);
      expect(leftovers.sort()).toEqual((result === 'accepted' ? [moved, own] : [own]).sort());
    }
  });

  it('never leaves a row claimed by a run closed at the same time', async () => {
    for (let iteration = 0; iteration < 30; iteration++) {
      const threadKey = newThread();
      const runId = newRun();
      const rows = [randomUUID(), randomUUID()];
      for (const id of rows) await signals.enqueue({ id, threadKey, runId, scope: 'pending', signal: {} });

      const [claimed] = await Promise.all([
        signals.claim({ threadKey, runId, scope: 'pending' }),
        peer.closeRun({ threadKey, runId, consumedIds: [] }),
      ]);

      // The claim ran entirely before the close, which released its rows, or after it.
      expect([[], rows]).toContainEqual(claimed.map(row => row.id));
      expect((await signals.listPending({ threadKey, runId: null })).map(row => row.id)).toEqual(rows);
      expect(await signals.claim({ threadKey, runId, scope: 'pending' })).toEqual([]);
    }
  });
});
