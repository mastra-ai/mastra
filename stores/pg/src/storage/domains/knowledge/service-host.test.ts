import { Knowledge, createKnowledgeImporterHost, knowledgeImporterFlushDigest } from '@mastra/core/knowledge';
import type { KnowledgeImporterOp, KnowledgeImporterRunBinding } from '@mastra/core/knowledge';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';
import { PgKnowledgeImporters } from './importers';
import { KnowledgePG, pgKnowledgeTransactionClient } from '.';

/**
 * A service host (r352 S1, S4) against real concurrency: a flush parked on a lock is cut off where
 * the run's lease ends, and a claim and a writer-generation advance serialize on the writer guard
 * in either order. The other session is held open and the test waits until Postgres reports the
 * waiter blocked on it, so the interleaving is fixed rather than timed.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;

const pool = new Pool({ connectionString });
const otherPool = new Pool({ connectionString });
const observerPool = new Pool({ connectionString, max: 1 });

afterAll(async () => {
  await Promise.all([pool.end(), otherPool.end(), observerPool.end()]);
});

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { opened, open };
}

async function waitUntilBlockedOn(pid: number): Promise<void> {
  for (let i = 0; i < 500; i++) {
    const { rows } = await observerPool.query(
      `SELECT count(*) AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [pid],
    );
    if (Number(rows[0].n) > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`nothing blocked on session ${pid}`);
}

const binding: KnowledgeImporterRunBinding = {
  id: 'b1',
  importer: 'notes',
  target: 'docs:acme#notion',
  settings: {},
  credentials: {},
};

let n = 0;
async function setup(leaseMs: number) {
  const schemaName = `knowledge_service_host_${process.pid}_${++n}`;
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  const knowledge = new Knowledge({
    scopes: { 'docs:$orgId': {} },
    storage: new PostgresStore({ id: 'service-host', pool, schemaName }),
  });
  const host = createKnowledgeImporterHost(knowledge, { bindings: [binding], leaseMs });
  const storage = await knowledge.getStorage();
  const other = new KnowledgePG({ pool: otherPool, schemaName });
  const guardTable = `"${schemaName}".mastra_knowledge_importer_writer_guard`;
  const scopeExists = async () => (await storage.getScopesByAddress(['docs:acme'])).length > 0;
  const drop = () => pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  return { host, storage, other, guardTable, scopeExists, drop, schemaName };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const ops: KnowledgeImporterOp[] = [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'x' } }];

/**
 * Wraps the store's clock read: `before`/`after` run around the query on the next `calls` reads
 * only. Returns the restore function.
 */
function patchStoreClock(calls: number, hooks: { before?: () => Promise<void>; after?: () => Promise<void> }) {
  const proto = PgKnowledgeImporters.prototype;
  const original = proto.now;
  let left = calls;
  proto.now = async function (this: PgKnowledgeImporters) {
    const hooked = left-- > 0;
    if (hooked) await hooks.before?.();
    const now = await original.call(this);
    if (hooked) await hooks.after?.();
    return now;
  };
  return () => {
    proto.now = original;
  };
}

/** Holds every page write in the schema (reads still pass) until the returned client rolls back. */
async function blockPageWrites(schemaName: string) {
  const client = await otherPool.connect();
  await client.query('BEGIN');
  await client.query(`LOCK TABLE "${schemaName}".mastra_knowledge_pages IN EXCLUSIVE MODE`);
  const pid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
  let released = false;
  return {
    pid,
    release: async () => {
      if (released) return;
      released = true;
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    },
  };
}

/** Sends the flush and settles to the error it fails with, or 'applied', or 'still waiting' after `ms`. */
function flushOutcome(t: Awaited<ReturnType<typeof setup>>, started: { runId: string; generation: number }, ms = 6000) {
  return (async () => {
    const digest = await knowledgeImporterFlushDigest({ ops });
    return Promise.race([
      t.host.flush({ runId: started.runId, generation: started.generation, seq: 1, digest, ops }).then(
        () => 'applied' as const,
        (error: unknown) => error,
      ),
      sleep(ms).then(() => 'still waiting' as const),
    ]);
  })();
}

describe('PG service importer host', () => {
  it('cuts a flush off where the lease ends while it waits on a lock, and records no receipt', async () => {
    const t = await setup(1500);
    let guardHolder: PoolClient | undefined;
    try {
      const started = await t.host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');

      guardHolder = await otherPool.connect();
      await guardHolder.query('BEGIN');
      await guardHolder.query(`SELECT * FROM ${t.guardTable} FOR UPDATE`);

      const digest = await knowledgeImporterFlushDigest({ ops });
      const sent = Date.now();
      // The flush budget alone (45 s) would let it wait far longer than the lease.
      const outcome = await Promise.race([
        t.host.flush({ runId: started.runId, generation: started.generation, seq: 1, digest, ops }).then(
          () => 'applied' as const,
          (error: unknown) => error,
        ),
        new Promise(resolve => setTimeout(() => resolve('still waiting'), 6000)),
      ]);
      const waited = Date.now() - sent;
      await guardHolder.query('ROLLBACK');

      expect(outcome).toMatchObject({ name: 'KnowledgeImporterHostError' });
      expect((outcome as { status?: number }).status ?? 500).toBeGreaterThanOrEqual(500);
      expect(waited).toBeLessThan(4000);
      expect(await t.storage.importers!.getFlush(started.runId, started.generation, 1)).toBeNull();
      // Its resend after the lease ended is refused, not applied.
      await expect(
        t.host.flush({ runId: started.runId, generation: started.generation, seq: 1, digest, ops }),
      ).rejects.toMatchObject({ code: 'run_not_active' });
    } finally {
      await guardHolder?.query('ROLLBACK').catch(() => {});
      guardHolder?.release();
      await t.drop();
    }
  }, 15_000);

  it('a claim that commits first leaves first_write_at for the generation advance waiting behind it', async () => {
    const t = await setup(60_000);
    try {
      const generation = (await t.storage.importers!.readWriterGuard()).generation;
      const admitted = gate();
      const release = gate();
      let claimPid = 0;
      const claim = t.host.startRun('b1', {
        generation,
        admit: async tx => {
          claimPid = Number((await pgKnowledgeTransactionClient(tx).one('SELECT pg_backend_pid() AS pid')).pid);
          admitted.open();
          await release.opened;
        },
      });
      await admitted.opened;
      const advance = t.other.transaction(async tx => {
        const importers = (tx as KnowledgePG).importers!;
        const guard = await importers.lockWriterGuard('update');
        await importers.advanceWriterGuard({ activePath: 'legacy', generation: guard.generation + 1 });
        return guard;
      });
      await waitUntilBlockedOn(claimPid);
      release.open();

      expect((await claim).status).toBe('started');
      // The advance saw the claim's committed write: an instance that was written is not
      // eligible for a rollback that assumes it wasn't.
      expect((await advance).firstWriteAt).not.toBeNull();
      expect(await t.scopeExists()).toBe(true);
    } finally {
      await t.drop();
    }
  }, 15_000);

  it('a generation advance that commits first refuses the claim waiting behind it, before admission', async () => {
    const t = await setup(60_000);
    let guardHolder: PoolClient | undefined;
    try {
      const generation = (await t.storage.importers!.readWriterGuard()).generation;
      guardHolder = await otherPool.connect();
      await guardHolder.query('BEGIN');
      const pid = Number((await guardHolder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      await guardHolder.query(`UPDATE ${t.guardTable} SET active_path = 'legacy', generation = generation + 1`);

      let admitted = false;
      const claim = t.host
        .startRun('b1', {
          generation,
          admit: async () => {
            admitted = true;
          },
        })
        .then(
          () => 'started' as const,
          (error: unknown) => error,
        );
      await waitUntilBlockedOn(pid);
      await guardHolder.query('COMMIT');

      expect(await claim).toMatchObject({ code: 'stale_generation' });
      expect(admitted).toBe(false);
      expect(await t.scopeExists()).toBe(false);
      expect((await t.storage.importers!.readWriterGuard()).firstWriteAt).toBeNull();
    } finally {
      await guardHolder?.query('ROLLBACK').catch(() => {});
      guardHolder?.release();
      await t.drop();
    }
  }, 15_000);
  it('bounds the flush by the locked run when the peeked lease looked past and a heartbeat renewed it', async () => {
    const t = await setup(1500);
    let blocker: Awaited<ReturnType<typeof blockPageWrites>> | undefined;
    let restore = () => {};
    try {
      const started = await t.host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      blocker = await blockPageWrites(t.schemaName);
      // The flush's first clock read is held until the peeked lease (from the start) is past; a
      // heartbeat renews the run meanwhile, so the locked run is live again.
      let renewedAt = 0;
      restore = patchStoreClock(1, {
        before: async () => {
          await sleep(500);
          await t.host.heartbeat(started.runId, started.generation);
          renewedAt = Date.now();
          await sleep(1200);
        },
      });
      const outcome = await flushOutcome(t, started);
      const ended = Date.now();

      // Without the locked re-bound the transaction keeps only the 45 s flush budget.
      expect(outcome).toMatchObject({ name: 'KnowledgeImporterHostError' });
      expect((outcome as { status?: number }).status ?? 500).toBeGreaterThanOrEqual(500);
      expect(ended).toBeLessThan(renewedAt + 1500 + 500);
      await blocker.release();
      expect(await t.storage.importers!.getFlush(started.runId, started.generation, 1)).toBeNull();
    } finally {
      restore();
      await blocker?.release();
      await t.drop();
    }
  }, 15_000);

  it("maps the lease cutoff from before the store's clock read, so a slow clock reply doesn't extend it", async () => {
    const t = await setup(1500);
    let blocker: Awaited<ReturnType<typeof blockPageWrites>> | undefined;
    let restore = () => {};
    try {
      const started = await t.host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const startedAt = Date.now();
      blocker = await blockPageWrites(t.schemaName);
      // The pre-lock clock reply arrives 800 ms after the store read its clock.
      restore = patchStoreClock(1, { after: () => sleep(800) });
      const outcome = await flushOutcome(t, started);
      const ended = Date.now();

      expect(outcome).toMatchObject({ name: 'KnowledgeImporterHostError' });
      expect((outcome as { status?: number }).status ?? 500).toBeGreaterThanOrEqual(500);
      // Mapped after the reply, the cutoff would land ~800 ms past the lease.
      expect(ended).toBeLessThan(startedAt + 1500 + 300);
    } finally {
      restore();
      await blocker?.release();
      await t.drop();
    }
  }, 15_000);

  it('rolls back a flush whose lease ends after its writes but before COMMIT', async () => {
    const t = await setup(1500);
    const proto = PgKnowledgeImporters.prototype;
    const recordFlush = proto.recordFlush;
    try {
      const started = await t.host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const leaseEnds = Date.now() + 1500;
      // The last write of the flush returns only once the lease is over.
      proto.recordFlush = async function (this: PgKnowledgeImporters, input) {
        await recordFlush.call(this, input);
        await sleep(Math.max(0, leaseEnds - Date.now()) + 200);
      };
      const outcome = await flushOutcome(t, started);

      expect(outcome).toMatchObject({ name: 'KnowledgeImporterHostError' });
      expect((outcome as { status?: number }).status ?? 500).toBeGreaterThanOrEqual(500);
      proto.recordFlush = recordFlush;
      expect(await t.storage.importers!.getFlush(started.runId, started.generation, 1)).toBeNull();
      const [scope] = await t.storage.getScopesByAddress(['docs:acme']);
      expect(await t.storage.getPageByPath({ scopeId: scope!.id, path: ['notion', 'p1'], read: 'all' })).toBeNull();
    } finally {
      proto.recordFlush = recordFlush;
      await t.drop();
    }
  }, 15_000);

  it('records no settle timeout, page, node, state or receipt when the lease ends while settling', async () => {
    const t = await setup(1500);
    let rowHolder: PoolClient | undefined;
    try {
      const started = await t.host.startRun('b1');
      if (started.status !== 'started') throw new Error('not started');
      const send = async (seq: number, flushOps: KnowledgeImporterOp[], state?: Record<string, string>) =>
        t.host.flush({
          runId: started.runId,
          generation: started.generation,
          seq,
          digest: await knowledgeImporterFlushDigest({ ops: flushOps, ...(state ? { state } : {}) }),
          ops: flushOps,
          ...(state ? { state } : {}),
        });
      // c1 arrives before its parent: placed under the target, unsettled.
      await send(1, [{ op: 'upsert', item: { sourceId: 'c1', parent: 'p0', title: 'C1', body: 'c' } }]);
      const [scope] = await t.storage.getScopesByAddress(['docs:acme']);
      const pageAt = (...path: string[]) => t.storage.getPageByPath({ scopeId: scope!.id, path, read: 'all' });
      const child = (await pageAt('notion', 'c1'))!;
      expect(child).toBeTruthy();
      const stateBefore = await t.storage.importers!.getState('b1');

      // Hold c1's row so the settle slice that moves it under p0 waits until the lease ends.
      rowHolder = await otherPool.connect();
      await rowHolder.query('BEGIN');
      await rowHolder.query(`SELECT 1 FROM "${t.schemaName}".mastra_knowledge_pages WHERE "id" = $1 FOR UPDATE`, [
        child.id,
      ]);
      const outcome = await send(2, [{ op: 'upsert', item: { sourceId: 'p0', title: 'P0', body: 'p' } }], {
        cursor: 'after-2',
      }).then(
        () => 'applied' as const,
        (error: unknown) => error,
      );
      await rowHolder.query('ROLLBACK');

      expect(outcome).toMatchObject({ name: 'KnowledgeImporterHostError' });
      expect((outcome as { status?: number }).status ?? 500).toBeGreaterThanOrEqual(500);
      const importers = t.storage.importers!;
      expect(await importers.getFlush(started.runId, started.generation, 2)).toBeNull();
      expect(await importers.getNode('b1', 'p0')).toBeNull();
      expect(await pageAt('notion', 'p0')).toBeNull();
      expect((await pageAt('notion', 'c1'))?.version).toBe(child.version);
      // Neither the flush's state nor the host's reserved settle-timeout counter.
      expect(await importers.getState('b1')).toEqual(stateBefore);
      expect(Object.keys(stateBefore).some(key => key.startsWith('mastra:settle:timeouts'))).toBe(false);
    } finally {
      await rowHolder?.query('ROLLBACK').catch(() => {});
      rowHolder?.release();
      await t.drop();
    }
  }, 15_000);
});
