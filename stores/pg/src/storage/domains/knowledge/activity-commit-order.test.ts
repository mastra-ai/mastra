import type { KnowledgeReadScope } from '@mastra/core/storage';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { DbClient, TxClient } from '../../client';
import { PoolAdapter } from '../../client';
import { connectionString as defaultConnectionString } from '../../test-utils';
import { PG_KNOWLEDGE_PAGES_TABLES, PgKnowledgePages } from './pages';
import { initPgKnowledgePagesSchema } from './pages-schema';

const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const schemaName = 'knowledge_activity_commit_order_test';
const activity = `"${schemaName}"."${PG_KNOWLEDGE_PAGES_TABLES.activity}"`;
const provenance = { author: 'agent:test' };
const bounds = async () => ({
  assertKnowledgePageDescriptionWithinBound: () => {},
  assertKnowledgeNoteTextWithinBound: () => {},
});
const read: KnowledgeReadScope = { addresses: ['team:late'], prefixes: [], children: [] };

const pool = new Pool({ connectionString, max: 10 });
const client = new PoolAdapter(pool);
const store = new PgKnowledgePages({ client, schemaName, bounds });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** A client whose transactions do their work, then wait for `release` before they COMMIT. */
function heldClient(release: Promise<void>): DbClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'tx') {
        return <T>(op: (t: TxClient) => Promise<T>) =>
          target.tx(async t => {
            const result = await op(t);
            await release;
            return result;
          });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function held() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => (release = resolve));
  return { store: new PgKnowledgePages({ client: heldClient(gate), schemaName, bounds }), release };
}

async function setup() {
  const { scope } = await store.materializeScope({
    address: 'team:late',
    declaration: 'team:late',
    name: 'late',
    provenance,
  });
  // createPage locks its parent, so concurrent writes go under different parents to overlap.
  const left = await store.createPage({ parentId: scope.id, name: 'left', provenance });
  const right = await store.createPage({ parentId: scope.id, name: 'right', provenance });
  // Past the setup writes' millisecond, so since leaves them out.
  await sleep(5);
  return { left, right, since: new Date() };
}

/** Reads oldest first from `after` to the end, the way a polling reader would. */
async function drain(since: Date, after?: string) {
  const events = [];
  for (let guard = 0; guard < 50; guard++) {
    const page = await store.listPageActivity({ read, since, order: 'asc', limit: 2, after });
    events.push(...page.events);
    if (page.events.length > 0) after = page.events.at(-1)!.position;
    if (!page.nextCursor) break;
  }
  return { events, after };
}

describe('PgKnowledgePages oldest-first activity under concurrent writes (real PostgreSQL)', () => {
  beforeAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  });
  beforeEach(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await pool.query(`CREATE SCHEMA ${schemaName}`);
    await initPgKnowledgePagesSchema(client, schemaName);
  });
  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await pool.end();
  });

  for (const first of ['slow', 'fast'] as const) {
    it(`never loses a write that committed after a later-stamped one the reader already passed (${first} write starts first)`, async () => {
      const { left, right, since } = await setup();
      const slow = held();
      let slowWrite: Promise<{ id: string }>;
      let fast: { id: string };
      if (first === 'slow') {
        // The slow write is stamped first and its transaction stays open...
        slowWrite = slow.store.createPage({ parentId: left.id, name: 'slow', provenance });
        await sleep(50);
        // ...while a later-stamped write commits.
        fast = await store.createPage({ parentId: right.id, name: 'fast', provenance });
      } else {
        // The fast write takes its transaction id first and commits; the slow one opens after it.
        fast = await store.createPage({ parentId: right.id, name: 'fast', provenance });
        slowWrite = slow.store.createPage({ parentId: left.id, name: 'slow', provenance });
        await sleep(50);
      }
      const early = await drain(since);

      slow.release();
      const slowPage = await slowWrite;
      const later = await drain(since, early.after);

      const seen = [...early.events, ...later.events].map(event => event.pageId);
      expect([...seen].sort()).toEqual([slowPage.id, fast.id].sort());
      expect(new Set(seen).size).toBe(seen.length);
      // Caught up: nothing more, nothing repeated.
      expect((await drain(since, later.after)).events).toEqual([]);
    });
  }

  it('holds the feed back while any transaction with an id is open, then shows the events it held', async () => {
    const { left, since } = await setup();
    const caughtUp = await drain(since);
    let unrelated: PoolClient | undefined;
    try {
      unrelated = await pool.connect();
      await unrelated.query('BEGIN');
      await unrelated.query('SELECT pg_current_xact_id()');
      const page = await store.createPage({ parentId: left.id, name: 'behind an open transaction', provenance });
      expect((await drain(since, caughtUp.after)).events).toEqual([]);
      await unrelated.query('ROLLBACK');
      expect((await drain(since, caughtUp.after)).events.map(event => event.pageId)).toEqual([page.id]);
    } finally {
      unrelated?.release();
    }
  });

  it('after a logical restore: hides restored events until rebaseActivityFeed, then refuses old positions', async () => {
    const { left, since } = await setup();
    const before = await store.createPage({ parentId: left.id, name: 'before restore', provenance });
    const { events, after: oldPosition } = await drain(since);
    expect(events.map(event => event.pageId)).toContain(before.id);

    // A pg_dump/pg_restore into another cluster keeps each row's transaction id from the old
    // cluster, which can sit far above the new cluster's.
    await pool.query(`UPDATE ${activity} SET "xact" = '900000000000'::xid8`);
    expect((await drain(since)).events).toEqual([]);

    await store.rebaseActivityFeed();
    const fresh = await drain(since);
    expect(fresh.events.map(event => event.pageId)).toEqual(events.map(event => event.pageId));
    await expect(store.listPageActivity({ read, order: 'asc', after: oldPosition })).rejects.toThrow(
      /rebased.*restart from since/,
    );
    // Positions from the new generation keep working.
    const next = await store.createPage({ parentId: left.id, name: 'after rebase', provenance });
    expect((await drain(since, fresh.after)).events.map(event => event.pageId)).toEqual([next.id]);
  });

  it('rebaseActivityFeed keeps the feed order, also where it differs from seq order', async () => {
    const { left, since } = await setup();
    const first = await store.createPage({ parentId: left.id, name: 'first seq', provenance });
    const second = await store.createPage({ parentId: left.id, name: 'second seq', provenance });
    // Restored rows keep their old-cluster transaction ids; there the second page's transaction
    // started first, so the feed order is the reverse of seq order.
    await pool.query(`UPDATE ${activity} SET "xact" = '900000000002'::xid8 WHERE "pageId" = $1`, [first.id]);
    await pool.query(`UPDATE ${activity} SET "xact" = '900000000001'::xid8 WHERE "pageId" <> $1`, [first.id]);
    const restoredOrder = (await pool.query(`SELECT "id" FROM ${activity} ORDER BY "xact", "seq"`)).rows.map(row =>
      String(row.id),
    );

    await store.rebaseActivityFeed();
    const rebased = await drain(since);
    expect(rebased.events.map(event => event.pageId)).toEqual([second.id, first.id]);
    const all = (await pool.query(`SELECT "id" FROM ${activity} ORDER BY "xact", "seq"`)).rows.map(row =>
      String(row.id),
    );
    expect(all).toEqual(restoredOrder);
    // New writes still come after the rebased events.
    const next = await store.createPage({ parentId: left.id, name: 'after rebase', provenance });
    expect((await drain(since, rebased.after)).events.map(event => event.pageId)).toEqual([next.id]);
  });

  it('upgrades an activity table from before feed positions, numbering its events in createdAt order', async () => {
    const { left, since } = await setup();
    const a = await store.createPage({ parentId: left.id, name: 'old row a', provenance });
    const b = await store.createPage({ parentId: left.id, name: 'old row b', provenance });
    // Heap order differs from time order: an update rewrites a's activity row at the heap's end.
    await pool.query(`UPDATE ${activity} SET "provenance" = "provenance" WHERE "pageId" = $1`, [a.id]);
    const byTime = (await pool.query(`SELECT "id" FROM ${activity} ORDER BY "createdAt", "id"`)).rows.map(row =>
      String(row.id),
    );
    await pool.query(`DROP INDEX "${schemaName}"."mastra_knowledge_activity_feed_idx"`);
    await pool.query(`ALTER TABLE ${activity} DROP COLUMN "xact", DROP COLUMN "seq"`);
    await initPgKnowledgePagesSchema(client, schemaName);
    await initPgKnowledgePagesSchema(client, schemaName);
    const all = (await pool.query(`SELECT "id" FROM ${activity} ORDER BY "xact", "seq"`)).rows.map(row =>
      String(row.id),
    );
    expect(all).toEqual(byTime);
    expect((await drain(since)).events.map(event => event.pageId)).toEqual([a.id, b.id]);
    // New writes come after the upgraded history.
    const next = await store.createPage({ parentId: left.id, name: 'after upgrade', provenance });
    expect((await drain(since)).events.map(event => event.pageId)).toEqual([a.id, b.id, next.id]);
  });

  it('refuses a position from before a second restore of the same dump, also after the same number of rebases', async () => {
    const { left, since } = await setup();
    const state = `"${schemaName}"."${PG_KNOWLEDGE_PAGES_TABLES.state}"`;
    await store.createPage({ parentId: left.id, name: 'in the dump', provenance });
    const dumpState = (await pool.query(`SELECT * FROM ${state}`)).rows;
    const dumpActivity = (await pool.query(`SELECT * FROM ${activity}`)).rows;
    const restore = async () => {
      await pool.query(`DELETE FROM ${activity}`);
      await pool.query(`DELETE FROM ${state}`);
      for (const row of dumpState) {
        const cols = Object.keys(row);
        await pool.query(
          `INSERT INTO ${state} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
          cols.map(c => row[c]),
        );
      }
      for (const row of dumpActivity) {
        const cols = Object.keys(row);
        await pool.query(
          `INSERT INTO ${activity} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
          cols.map(c => row[c]),
        );
      }
    };

    await restore();
    await store.rebaseActivityFeed();
    const first = await drain(since);
    expect(first.after).toBeDefined();

    await restore();
    await store.rebaseActivityFeed();
    await expect(store.listPageActivity({ read, order: 'asc', after: first.after })).rejects.toThrow(
      /rebased.*restart from since/,
    );
    const page = await store.createPage({ parentId: left.id, name: 'after second restore', provenance });
    expect((await drain(since)).events.map(event => event.pageId)).toContain(page.id);
  });

  it('refuses a position ahead of the feed, as after a restore to an earlier point without a rebase', async () => {
    const { left, since } = await setup();
    await store.createPage({ parentId: left.id, name: 'a page', provenance });
    const { after } = await drain(since);
    const [incarnation] = after!.split(':');
    // Above any transaction id this cluster has handed out: the cluster went back in time.
    const ahead = `${incarnation}:900000000000:1`;
    await expect(store.listPageActivity({ read, order: 'asc', after: ahead })).rejects.toThrow(
      /ahead of this feed.*restart from since/,
    );
    // Also when there are events past it in seq terms.
    await store.createPage({ parentId: left.id, name: 'another page', provenance });
    await expect(store.listPageActivity({ read, order: 'asc', after: ahead })).rejects.toThrow(/ahead of this feed/);
  });

  /** A reader that runs `before` ahead of every statement after its first. */
  function interleaved(before: () => Promise<unknown>) {
    const statements: string[] = [];
    const client2 = new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'any' || prop === 'manyOrNone' || prop === 'query' || prop === 'oneOrNone' || prop === 'one') {
          const fn = Reflect.get(target, prop, receiver) as (...args: unknown[]) => Promise<unknown>;
          return async (...args: unknown[]) => {
            statements.push(String(args[0]));
            if (statements.length > 1) await before();
            return fn.apply(target, args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    return new PgKnowledgePages({ client: client2 as DbClient, schemaName, bounds });
  }

  it('reads the feed incarnation in the same statement as the events', async () => {
    const { left, since } = await setup();
    await store.createPage({ parentId: left.id, name: 'a page', provenance });
    const { after } = await drain(since);
    const b = await store.createPage({ parentId: left.id, name: 'b page', provenance });
    // A rebase that commits between any two statements of the read must not replay the feed:
    // run one before every statement the read sends. The read returns exactly the new event, or
    // refuses the position; it never returns the event it already handed out.
    const reader = interleaved(() => store.rebaseActivityFeed());
    let events: { pageId: string }[] | undefined;
    try {
      events = (await reader.listPageActivity({ read, since, order: 'asc', after })).events;
    } catch (error) {
      expect(String(error)).toMatch(/rebased/);
    }
    if (events) expect(events.map(event => event.pageId)).toEqual([b.id]);
  });

  it('refuses a position ahead of the feed even when a transaction id is handed out mid-read', async () => {
    const { left, since } = await setup();
    await store.createPage({ parentId: left.id, name: 'a page', provenance });
    const { after } = await drain(since);
    const [incarnation] = after!.split(':');
    // The next transaction id: not handed out yet, so a position at it is ahead of the feed...
    const [{ xmax }] = (await pool.query(`SELECT pg_snapshot_xmax(pg_current_snapshot())::text AS xmax`)).rows;
    const ahead = `${incarnation}:${xmax}:1`;
    // ...until another transaction takes it between two statements of the read.
    const reader = interleaved(() => pool.query('SELECT pg_current_xact_id()'));
    await expect(reader.listPageActivity({ read, order: 'asc', after: ahead })).rejects.toThrow(/ahead of this feed/);
  });
});
