import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connectionString as defaultConnectionString } from '../../test-utils';
import { KnowledgePG } from '.';

/**
 * Marking a sequence and moving one of its pages take page locks in one order: the parent page
 * before its children. A holder transaction keeps the parent locked while both writers queue on
 * it, mark first, so the order they get it is fixed rather than timed. If a move locked its own
 * page before the parent, the mark would then wait on that page while the move waits on the
 * parent, and Postgres would abort one of them as a deadlock.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const schemaName = 'knowledge_sequence_lock_order_test';
const provenance = { author: 'agent:test' };

const pool = new Pool({ connectionString });
const holderPool = new Pool({ connectionString });
const observerPool = new Pool({ connectionString, max: 1 });
const store = new KnowledgePG({ pool, schemaName });
const holder = new KnowledgePG({ pool: holderPool, schemaName });

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { opened, open };
}

/** Waits until `sessions` sessions of this database wait on a lock (a later waiter queues behind the first). */
async function waitForLockWaiters(sessions: number): Promise<void> {
  for (let i = 0; i < 500; i++) {
    const { rows } = await observerPool.query(
      `SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (Number(rows[0].n) >= sessions) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`fewer than ${sessions} sessions wait on a lock`);
}

/** Locks `pageId` in its own transaction until released. */
async function holdPage(pageId: string) {
  const locked = gate();
  const release = gate();
  const done = holder.transaction(async tx => {
    await tx.lockPages([pageId]);
    locked.open();
    await release.opened;
  });
  await locked.opened;
  return { release: release.open, done };
}

describe('PG sequence page lock order', () => {
  beforeAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await store.init();
  });
  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await Promise.all([pool.end(), holderPool.end(), observerPool.end()]);
  });

  for (const orderBy of ['timeline', 'position'] as const) {
    it(`marks a ${orderBy} sequence while one of its pages is reordered, without a deadlock`, async () => {
      const scope = (
        await store.materializeScope({ address: `team:${orderBy}`, declaration: 'team:$t', name: 'T', provenance })
      ).scope;
      const list = await store.createPage({ parentId: scope.id, name: 'Plan', provenance });
      const first = await store.createPage({ parentId: list.id, name: 'First', provenance });
      const second = await store.createPage({ parentId: list.id, name: 'Second', provenance });

      const held = await holdPage(list.id);
      const mark = store.sequences!.markSequence({ pageId: list.id, orderBy });
      await waitForLockWaiters(1);
      const move = store.movePage({
        id: second.id,
        parentId: list.id,
        position: `${first.position}0`,
        expectedVersion: second.version,
        provenance,
      });
      await waitForLockWaiters(2);
      held.release();
      await held.done;
      const [marked, moved] = await Promise.allSettled([mark, move]);

      expect(marked).toMatchObject({ status: 'fulfilled', value: { status: 'created' } });
      expect(moved).toMatchObject({ status: 'fulfilled' });
      const items = (await store.sequences!.listItems({ sequenceId: list.id, read: 'all', limit: 10 })).items;
      const children = (await store.listChildPages({ parentId: list.id, read: 'all', limit: 10 })).pages;
      expect(items.map(i => i.pageId).sort()).toEqual(children.map(c => c.id).sort());
      if (orderBy === 'position') {
        for (const child of children) expect(items.find(i => i.pageId === child.id)!.position).toBe(child.position);
      }
    });
  }
});
