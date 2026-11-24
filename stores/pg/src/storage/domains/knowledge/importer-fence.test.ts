import { Knowledge, KnowledgeImporter, knowledgeImporterFlushDigest } from '@mastra/core/knowledge';
import type { KnowledgeImporterContext, KnowledgeImporterOp, KnowledgeImportItem } from '@mastra/core/knowledge';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';
import { KnowledgePG, pgKnowledgeTransactionClient } from '.';

/**
 * The importer sink against a concurrent writer that commits while the flush waits for it (r347 O3
 * §A″, §A‴, §C‴). The other writer runs on its own pool and is held open with a gate, and the test
 * waits until Postgres reports the flush blocked on that session before letting it commit, so the
 * interleaving is fixed rather than timed.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const provenance = { author: 'user:human' };

const pool = new Pool({ connectionString });
const otherPool = new Pool({ connectionString });
const observerPool = new Pool({ connectionString, max: 1 });

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

const upsert = (item: Partial<KnowledgeImportItem> & { sourceId: string }): KnowledgeImporterOp => ({
  op: 'upsert',
  item: { title: item.sourceId.toUpperCase(), body: `body of ${item.sourceId}`, ...item },
});

let n = 0;
async function setup(bindings: { id: string; target: string }[]) {
  const schemaName = `knowledge_importer_fence_${process.pid}_${++n}`;
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  let ops: KnowledgeImporterOp[] = [];
  class Notes extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
    async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
      for (const op of ops) {
        if (op.op === 'upsert') await ctx.items.upsert(op.item);
        else if (op.op === 'remove') await ctx.items.remove(op.sourceId);
      }
    }
  }
  const knowledge = new Knowledge({
    scopes: { 'docs:$orgId': {} },
    storage: new PostgresStore({ id: 'importer-fence', pool, schemaName }),
    importers: bindings.map(b => new Notes(b)),
  });
  const other = new KnowledgePG({ pool: otherPool, schemaName });
  const run = (next: KnowledgeImporterOp[], bindingId = 'b1') => {
    ops = next;
    return knowledge.importers!.run(bindingId);
  };
  const page = async (path: string) => {
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['docs:acme']);
    return scope ? storage.getPageByPath({ scopeId: scope.id, path: path.split('/'), read: 'all' }) : null;
  };
  /** Runs `work` in a transaction on the other pool and keeps it open until released. */
  const hold = async (work: (tx: KnowledgePG) => Promise<void>) => {
    const ready = gate();
    const release = gate();
    let pid = 0;
    const done = other.transaction(async tx => {
      pid = Number((await pgKnowledgeTransactionClient(tx).one('SELECT pg_backend_pid() AS pid')).pid);
      await work(tx as KnowledgePG);
      ready.open();
      await release.opened;
    });
    await ready.opened;
    return { pid, release: release.open, done };
  };
  const drop = () => pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  return { knowledge, run, page, hold, schemaName, drop };
}

describe('PG importer sink fences (r347 O3)', () => {
  beforeAll(async () => {
    await observerPool.query('SELECT 1');
  });
  afterAll(async () => {
    await Promise.all([pool.end(), otherPool.end(), observerPool.end()]);
  });

  it("carries another binding's page that joined the subtree while the move waited for its lock", async () => {
    const t = await setup([
      { id: 'b1', target: 'docs:acme#notion' },
      { id: 'b2', target: 'docs:acme#linear' },
    ]);
    try {
      await t.run([upsert({ sourceId: 'l1' })], 'b2');
      await t.run([upsert({ sourceId: 'p1' }), upsert({ sourceId: 'c1', parent: 'p1' }), upsert({ sourceId: 'p2' })]);
      const c1 = (await t.page('notion/p1/c1'))!;

      // Another writer adds a page under c1 and records it as b2's, and stays open.
      const held = await t.hold(async tx => {
        const late = await tx.createPage({ parentId: c1.id, key: 'late', name: 'Late', provenance });
        await tx.importers!.saveNode({
          bindingId: 'b2',
          sourceId: 'late',
          pageId: late.id,
          kind: null,
          parentSourceId: null,
          aliases: [],
          unresolvedLinks: [],
          links: [],
          linkSection: null,
          stub: false,
          adopted: false,
          unsettled: false,
        });
      });
      const move = t.run([upsert({ sourceId: 'p1', parent: 'p2' })]);
      await waitUntilBlockedOn(held.pid);
      held.release();
      await held.done;

      expect(await move).toMatchObject({ counts: { moved: 1, refused: 0 } });
      // The subtree is read under lock, so the late page moves with it rather than being left behind.
      expect(await t.page('notion/p2/p1/c1/late')).toBeTruthy();
      expect(await t.page('notion/p1')).toBeNull();
    } finally {
      await t.drop();
    }
  });

  it('creates the anchor at its configured path when a container on it moved while the flush waited', async () => {
    const t = await setup([{ id: 'b1', target: 'docs:acme#team/notion' }]);
    try {
      await t.knowledge.upsertPage({ scope: 'docs:acme', path: 'team', name: 'Team' });
      await t.knowledge.upsertPage({ scope: 'docs:acme', path: 'archive', name: 'Archive' });
      const team = (await t.page('team'))!;
      const archive = (await t.page('archive'))!;

      const held = await t.hold(async tx => {
        await tx.movePage({ id: team.id, expectedVersion: team.version, parentId: archive.id, provenance });
      });
      const first = t.run([upsert({ sourceId: 'p1' })]);
      await waitUntilBlockedOn(held.pid);
      held.release();
      await held.done;

      expect(await first).toMatchObject({ counts: { created: 1, refused: 0 } });
      expect(await t.page('team/notion/p1')).toBeTruthy();
      expect(await t.page('archive/team/notion')).toBeNull();
    } finally {
      await t.drop();
    }
  });

  it('replays a committed flush exactly after the run is past its deadline and after it finished, and nothing else', async () => {
    const t = await setup([{ id: 'b1', target: 'docs:acme#notion' }]);
    try {
      const host = t.knowledge.importers!.host;
      const started = await host.startRun('b1', { deadline: Date.now() + 1000 });
      if (started.status !== 'started') throw new Error('not started');
      const flush = async (seq: number, ops: KnowledgeImporterOp[]) =>
        host.flush({
          runId: started.runId,
          generation: started.generation,
          seq,
          digest: await knowledgeImporterFlushDigest({ ops }),
          ops,
        });
      const committedOps = [upsert({ sourceId: 'p1' })];
      const receipt = await flush(1, committedOps);
      expect(receipt).toMatchObject({ seq: 1, created: 1 });

      await new Promise(resolve => setTimeout(resolve, 1100));
      // Past the run's deadline: the lost ack can still be recovered, and only that.
      expect(await flush(1, committedOps)).toEqual(receipt);
      await expect(flush(1, [upsert({ sourceId: 'p1', body: 'changed' })])).rejects.toMatchObject({
        status: 409,
        code: 'digest_mismatch',
      });
      await expect(flush(2, [upsert({ sourceId: 'p2' })])).rejects.toMatchObject({
        status: 409,
        code: 'run_not_active',
      });

      await host.finishRun({
        runId: started.runId,
        generation: started.generation,
        outcome: 'failed',
        backlog: false,
        lastSeq: 1,
        error: { code: 'stopped', retryable: true },
      });
      // Finished: the same.
      expect(await flush(1, committedOps)).toEqual(receipt);
      await expect(flush(1, [upsert({ sourceId: 'p1', body: 'changed' })])).rejects.toMatchObject({
        code: 'digest_mismatch',
      });
      await expect(flush(2, [upsert({ sourceId: 'p2' })])).rejects.toMatchObject({ code: 'run_not_active' });

      expect((await t.page('notion/p1'))?.body).toBe('body of p1');
      expect(await t.page('notion/p2')).toBeNull();
    } finally {
      await t.drop();
    }
  }, 15_000);

  it("stops a flush at the run's deadline while it waits on a lock, and applies nothing", async () => {
    const t = await setup([{ id: 'b1', target: 'docs:acme#notion' }]);
    let guardHolder: PoolClient | undefined;
    try {
      const host = t.knowledge.importers!.host;
      const started = await host.startRun('b1', { deadline: Date.now() + 1500 });
      if (started.status !== 'started') throw new Error('not started');

      guardHolder = await otherPool.connect();
      await guardHolder.query('BEGIN');
      await guardHolder.query(`SELECT * FROM "${t.schemaName}".mastra_knowledge_importer_writer_guard FOR UPDATE`);

      const ops = [upsert({ sourceId: 'p1' })];
      const digest = await knowledgeImporterFlushDigest({ ops });
      const sent = Date.now();
      const outcome = await Promise.race([
        host.flush({ runId: started.runId, generation: started.generation, seq: 1, digest, ops }).then(
          () => 'applied' as const,
          (error: unknown) => error,
        ),
        new Promise(resolve => setTimeout(() => resolve('still waiting'), 6000)),
      ]);
      const waited = Date.now() - sent;

      expect(outcome).toMatchObject({ name: 'KnowledgeImporterHostError' });
      expect((outcome as { status?: number }).status ?? 500).toBeGreaterThanOrEqual(500);
      expect(waited).toBeLessThan(4000);
      await guardHolder.query('ROLLBACK');
      expect(await t.page('notion/p1')).toBeNull();
      expect(await t.page('notion')).toBeNull();
    } finally {
      await guardHolder?.query('ROLLBACK').catch(() => {});
      guardHolder?.release();
      await t.drop();
    }
  }, 15_000);
});
