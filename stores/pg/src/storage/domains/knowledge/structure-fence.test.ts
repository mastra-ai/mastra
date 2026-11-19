import { KnowledgeNotFoundError } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { connectionString as defaultConnectionString } from '../../test-utils';
import { KnowledgePG, pgKnowledgeTransactionClient } from '.';

/**
 * Structural writes and a concurrent writer that commits while they wait (r347 O3 §A‴). The
 * creator runs in its own transaction on its own pool and is held open with a gate, so the
 * interleaving is fixed rather than timed: the test waits until Postgres reports the structural
 * write blocked on the creator's session before letting the creator commit.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const schemaName = 'knowledge_structure_fence_test';
const provenance = { author: 'agent:test' };

const pool = new Pool({ connectionString });
const creatorPool = new Pool({ connectionString });
const observerPool = new Pool({ connectionString, max: 1 });
const store = new KnowledgePG({ pool, schemaName });
const creator = new KnowledgePG({ pool: creatorPool, schemaName });

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return { opened, open };
}

async function blockedOn(pid: number): Promise<number> {
  const { rows } = await observerPool.query(
    `SELECT count(*) AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`,
    [pid],
  );
  return Number(rows[0].n);
}

async function waitUntilBlockedOn(pid: number): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if ((await blockedOn(pid)) > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`nothing blocked on session ${pid}`);
}

/** Starts a creator transaction that inserts `name` under `parentId` and stays open until released. */
async function holdCreate(parentId: string, name: string) {
  const inserted = gate();
  const release = gate();
  let pid = 0;
  let id = '';
  const done = creator.transaction(async tx => {
    pid = Number((await pgKnowledgeTransactionClient(tx).one('SELECT pg_backend_pid() AS pid')).pid);
    id = (await tx.createPage({ parentId, name, provenance })).id;
    inserted.open();
    await release.opened;
  });
  await inserted.opened;
  return { pid, id: () => id, release: release.open, done };
}

/** `depth` is a storage column, not part of the page record. */
async function rowOf(id: string): Promise<{ parentId: string; scopeId: string; depth: number }> {
  const { rows } = await pool.query(
    `SELECT "parentId", "scopeId", "depth" FROM "${schemaName}".mastra_knowledge_pages WHERE "id" = $1`,
    [id],
  );
  return rows[0];
}

let n = 0;
async function scopes() {
  n++;
  const from = (
    await store.materializeScope({ address: `team:from${n}`, declaration: 'team:$t', name: 'From', provenance })
  ).scope;
  const to = (await store.materializeScope({ address: `team:to${n}`, declaration: 'team:$t', name: 'To', provenance }))
    .scope;
  return { from, to };
}

describe('PG structure fence (r347 O3 §A‴)', () => {
  beforeAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await store.init();
  });
  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await Promise.all([pool.end(), creatorPool.end(), observerPool.end()]);
  });

  it('moves a child that was committed under a descendant while the move waited for its lock', async () => {
    const { from, to } = await scopes();
    const root = await store.createPage({ parentId: from.id, name: 'Root', provenance });
    const mid = await store.createPage({ parentId: root.id, name: 'Mid', provenance });
    // One level deeper at the destination, so a stale row shows in depth as well as scope.
    const shelf = await store.createPage({ parentId: to.id, name: 'Shelf', provenance });

    const held = await holdCreate(mid.id, 'Late');
    const move = store.movePage({ id: root.id, expectedVersion: root.version, parentId: shelf.id, provenance });
    await waitUntilBlockedOn(held.pid);
    held.release();
    await held.done;
    const moved = await move;

    expect(moved.scopeId).toBe(to.id);
    const rootRow = await rowOf(root.id);
    expect(rootRow).toMatchObject({ scopeId: to.id, depth: 2 });
    expect(await rowOf(mid.id)).toMatchObject({ scopeId: to.id, depth: 3 });
    expect(await rowOf(held.id())).toMatchObject({ parentId: mid.id, scopeId: to.id, depth: 4 });
    expect(await store.getPage({ id: held.id(), read: 'all' })).toMatchObject({ scopeId: to.id });
  });

  it('refuses a child insert under a page that a concurrent delete removed', async () => {
    const { from } = await scopes();
    const page = await store.createPage({ parentId: from.id, name: 'Doomed', provenance });

    const pid = gate();
    const release = gate();
    let deleterPid = 0;
    const deletion = store.transaction(async tx => {
      deleterPid = Number((await pgKnowledgeTransactionClient(tx).one('SELECT pg_backend_pid() AS pid')).pid);
      await tx.deletePage({ id: page.id, expectedVersion: page.version, deletedBy: 'agent:test' });
      pid.open();
      await release.opened;
    });
    await pid.opened;
    const insert = creator.createPage({ parentId: page.id, name: 'Orphan', provenance }).then(
      p => p,
      (e: unknown) => e,
    );
    await waitUntilBlockedOn(deleterPid);
    release.open();
    await deletion;

    expect(await insert).toBeInstanceOf(KnowledgeNotFoundError);
    const children = await pool.query(
      `SELECT count(*) AS n FROM "${schemaName}".mastra_knowledge_pages WHERE "parentId" = $1`,
      [page.id],
    );
    expect(Number(children.rows[0].n)).toBe(0);
  });
});
