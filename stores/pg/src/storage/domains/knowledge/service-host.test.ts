import { Knowledge, createKnowledgeImporterHost, knowledgeImporterFlushDigest } from '@mastra/core/knowledge';
import type { KnowledgeImporterOp, KnowledgeImporterRunBinding } from '@mastra/core/knowledge';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';
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
  return { host, storage, other, guardTable, scopeExists, drop };
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

      const ops: KnowledgeImporterOp[] = [{ op: 'upsert', item: { sourceId: 'p1', title: 'P1', body: 'x' } }];
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
});
