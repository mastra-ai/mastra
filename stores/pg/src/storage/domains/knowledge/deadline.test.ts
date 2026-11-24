import { KnowledgeTransactionDeadlineError } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connectionString as defaultConnectionString } from '../../test-utils';
import { KnowledgePG, pgKnowledgeTransactionClient } from '.';

/**
 * One absolute deadline per transaction on Postgres (r347 O3 §C‴): connection, statements and lock
 * waits share it, each statement under its own limit can't add up past it, and it's checked again
 * before COMMIT. Each case writes a page first and checks the write is gone afterwards.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const schemaName = 'knowledge_deadline_test';
const provenance = { author: 'agent:test' };

const pool = new Pool({ connectionString });
const lockerPool = new Pool({ connectionString, max: 1 });
const store = new KnowledgePG({ pool, schemaName });

let scopeId = '';
let n = 0;

async function pageCount(name: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*) AS n FROM "${schemaName}".mastra_knowledge_pages WHERE "name" = $1`,
    [name],
  );
  return Number(rows[0].n);
}

/** Runs `work` after writing a uniquely named page; returns how it settled, how long it took, and the page name. */
async function timed(deadlineMs: number, work: (tx: KnowledgePG) => Promise<void>, onStore = store) {
  const name = `written-${++n}`;
  const started = Date.now();
  const outcome = await onStore
    .transaction(
      async tx => {
        await tx.createPage({ parentId: scopeId, name, provenance });
        await work(tx as KnowledgePG);
      },
      { deadlineAt: started + deadlineMs },
    )
    .then(
      () => 'committed' as const,
      (error: unknown) => error,
    );
  return { outcome, elapsed: Date.now() - started, name };
}

describe('PG transaction deadline (r347 O3 §C‴)', () => {
  beforeAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await store.init();
    scopeId = (
      await store.materializeScope({ address: 'team:deadline', declaration: 'team:$t', name: 'D', provenance })
    ).scope.id;
  });
  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await Promise.all([pool.end(), lockerPool.end()]);
  });

  it('reports that it enforces the deadline', () => {
    expect(store.getCapabilities().enforcesTransactionDeadline).toBe(true);
  });

  it('stops statements that are each under the limit but together run past the deadline', async () => {
    const { outcome, elapsed, name } = await timed(5000, async tx => {
      for (let i = 0; i < 5; i++) await pgKnowledgeTransactionClient(tx).query('SELECT pg_sleep(2)');
    });
    expect(outcome).toBeInstanceOf(KnowledgeTransactionDeadlineError);
    expect(elapsed).toBeGreaterThanOrEqual(4900);
    expect(elapsed).toBeLessThan(6500);
    expect(await pageCount(name)).toBe(0);
  }, 20_000);

  it('stops a lock wait at the deadline', async () => {
    const victim = await store.createPage({ parentId: scopeId, name: 'locked', provenance });
    const locker = await lockerPool.connect();
    await locker.query('BEGIN');
    await locker.query(`SELECT 1 FROM "${schemaName}".mastra_knowledge_pages WHERE "id" = $1 FOR UPDATE`, [victim.id]);
    try {
      const { outcome, elapsed, name } = await timed(1500, async tx => {
        await tx.updatePage({ id: victim.id, expectedVersion: victim.version, name: 'renamed', provenance });
      });
      expect(outcome).toBeInstanceOf(KnowledgeTransactionDeadlineError);
      expect(elapsed).toBeLessThan(3000);
      expect(await pageCount(name)).toBe(0);
    } finally {
      await locker.query('ROLLBACK');
      locker.release();
    }
  }, 20_000);

  it('bounds statements inside a nested transaction (savepoint) by the outer deadline', async () => {
    const { outcome, elapsed, name } = await timed(1500, async tx => {
      await tx.transaction(async inner => {
        await pgKnowledgeTransactionClient(inner).query('SELECT pg_sleep(5)');
      });
    });
    expect(outcome).toBeInstanceOf(KnowledgeTransactionDeadlineError);
    expect(elapsed).toBeLessThan(3000);
    expect(await pageCount(name)).toBe(0);
  }, 20_000);

  it('rolls back instead of committing when the deadline passed after the last statement', async () => {
    const { outcome, name } = await timed(300, async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
    });
    expect(outcome).toBeInstanceOf(KnowledgeTransactionDeadlineError);
    expect(await pageCount(name)).toBe(0);
  });

  it('stops waiting for a pool connection at the deadline, and the late connection is returned', async () => {
    const tinyPool = new Pool({ connectionString, max: 1 });
    const tiny = new KnowledgePG({ pool: tinyPool, schemaName });
    const held = await tinyPool.connect();
    try {
      const started = Date.now();
      const outcome = await tiny
        .transaction(async () => {}, { deadlineAt: started + 800 })
        .then(
          () => 'committed',
          (error: unknown) => error,
        );
      expect(outcome).toBeInstanceOf(KnowledgeTransactionDeadlineError);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      held.release();
    }
    // The connection handed over after the deadline went back to the pool, so it's usable.
    await expect(tiny.transaction(async () => 'ok')).resolves.toBe('ok');
    await tinyPool.end();
  }, 20_000);

  it('still commits work that finishes in time', async () => {
    const { outcome, name } = await timed(5000, async tx => {
      await pgKnowledgeTransactionClient(tx).query('SELECT pg_sleep(0.2)');
    });
    expect(outcome).toBe('committed');
    expect(await pageCount(name)).toBe(1);
  });
});
