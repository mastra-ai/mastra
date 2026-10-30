import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { StoreOperationsMySQL } from '../operations';
import { KnowledgeMySQL } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const database = process.env.MYSQL_DB || 'mastra';
const pool = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database,
  connectionLimit: 10,
});
afterAll(() => pool.end());
const createStore = () => new KnowledgeMySQL({ pool, operations: new StoreOperationsMySQL({ pool, database }) });
const who = { author: 'host' };

async function makeStore() {
  const store = createStore();
  await store.dangerouslyReset();
  return store;
}

describe('KnowledgeMySQL schema 4 wiring', () => {
  it('inits, serves pages, and resets', async () => {
    const store = createStore();
    await store.dangerouslyReset();
    await store.init();
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance: who,
    });
    const page = await store.createPage({ parentId: scope.id, name: 'Policy', provenance: who });
    expect((await store.getPage({ id: page.id, read: 'all' }))?.name).toBe('Policy');
    await store.dangerouslyReset();
    expect(await store.getPage({ id: page.id, read: 'all' })).toBeNull();
  });

  it('refuses a database that holds schema-2 tables until reset', async () => {
    const store = createStore();
    await store.dangerouslyReset();
    await pool.query('DROP TABLE IF EXISTS `mastra_knowledge_pages_state`');
    await pool.query('CREATE TABLE IF NOT EXISTS `mastra_knowledge_nodes` (id VARCHAR(64) PRIMARY KEY)');
    await expect(store.init()).rejects.toThrow(/reset/i);
    await store.dangerouslyReset();
    expect((await store.getScopesByAddress(['org:x'])).length).toBe(0);
  });

  it('rehomes a merged source into the target scope with its history', async () => {
    const store = await makeStore();
    const a = (
      await store.materializeScope({ address: 'org:a', declaration: 'org:$orgId', name: 'A', provenance: who })
    ).scope;
    const b = (
      await store.materializeScope({ address: 'org:b', declaration: 'org:$orgId', name: 'B', provenance: who })
    ).scope;
    const source = await store.createPage({ parentId: b.id, name: 'Source', provenance: who });
    const target = await store.createPage({ parentId: a.id, name: 'Target', provenance: who });
    await store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: target.id, provenance: who });
    expect((await store.getPage({ id: source.id, read: 'all', includeDeleted: true }))?.scopeId).toBe(a.id);
    const readA = { addresses: ['org:a'], prefixes: [], children: [] };
    const readB = { addresses: ['org:b'], prefixes: [], children: [] };
    expect((await store.listPageActivity({ pageId: source.id, read: readA })).events.length).toBeGreaterThan(0);
    expect((await store.listPageActivity({ pageId: source.id, read: readB })).events.length).toBe(0);
  });

  it('links an unlinked scope on its first later run and keeps that parent afterwards', async () => {
    const store = await makeStore();
    const p1 = (
      await store.materializeScope({ address: 'org:p1', declaration: 'org:$orgId', name: 'P1', provenance: who })
    ).scope;
    const p2 = (
      await store.materializeScope({ address: 'org:p2', declaration: 'org:$orgId', name: 'P2', provenance: who })
    ).scope;
    const first = await store.materializeScope({
      address: 'team:x',
      declaration: 'team:$orgId',
      name: 'X',
      provenance: who,
    });
    expect(first.scope.parentId).toBeNull();
    const linked = await store.materializeScope({
      address: 'team:x',
      declaration: 'team:$orgId',
      name: 'X',
      parentId: p1.id,
      provenance: who,
    });
    expect(linked.scope.parentId).toBe(p1.id);
    expect(linked.parentConflict).toBeUndefined();
    const again = await store.materializeScope({
      address: 'team:x',
      declaration: 'team:$orgId',
      name: 'X',
      parentId: p2.id,
      provenance: who,
    });
    expect(again.scope.parentId).toBe(p1.id);
    expect(again.parentConflict).toEqual({ existingParentId: p1.id, requestedParentId: p2.id });
  });

  it('reads a prefix as an exact code-point range, including the highest code points', async () => {
    const store = await makeStore();
    const addresses = ['p:\u{10FFFF}x', 'p:\u{1F600}x', 'p:ax', 'p:Ax', 'q:ax', 'p:a\t', 'p:a\u0001'];
    const pageByAddress: Record<string, string> = {};
    for (const address of addresses) {
      const { scope } = await store.materializeScope({ address, declaration: 'p:$id', name: address, provenance: who });
      const page = await store.createPage({ parentId: scope.id, name: `in ${address}`, provenance: who });
      pageByAddress[address] = page.name;
    }
    const names = async (prefix: string) =>
      (
        await store.listPages({
          read: { addresses: [], prefixes: [{ declaration: 'p:$id', prefix }], children: [] },
          limit: 50,
        })
      ).pages
        .map(page => page.name)
        .sort();
    expect(await names('p:')).toEqual(
      ['in p:\u{10FFFF}x', 'in p:\u{1F600}x', 'in p:Ax', 'in p:ax', 'in p:a\t', 'in p:a\u0001'].sort(),
    );
    expect(await names('p:\u{10FFFF}')).toEqual(['in p:\u{10FFFF}x']);
    expect(await names('p:\u{1F600}')).toEqual(['in p:\u{1F600}x']);
    expect(await names('p:a')).toEqual(['in p:a\t', 'in p:a\u0001', 'in p:ax'].sort());
    expect(await names('')).toHaveLength(7);
    await store.dangerouslyReset();
  });

  it('moves a subtree whose child ids start with control characters (PAD SPACE path ranges)', async () => {
    const store = await makeStore();
    const make = async (address: string) =>
      (await store.materializeScope({ address, declaration: 'p:$id', name: address, provenance: who })).scope;
    const a = await make('p:a');
    const b = await make('p:b');
    const parent = await store.createPage({ parentId: a.id, name: 'Parent', provenance: who });
    const child = await store.createPage({ id: '\tchild', parentId: parent.id, name: 'Child', provenance: who });
    const low = await store.createPage({ id: '\u0001low', parentId: child.id, name: 'Low', provenance: who });
    const moved = await store.movePage({
      id: parent.id,
      parentId: b.id,
      expectedVersion: parent.version,
      provenance: who,
    });
    expect(moved.scopeId).toBe(b.id);
    expect((await store.getPage({ id: child.id, read: 'all' }))?.scopeId).toBe(b.id);
    expect((await store.getPage({ id: low.id, read: 'all' }))?.scopeId).toBe(b.id);
    await store.dangerouslyReset();
  });

  it('keeps the pin audience index in step with add, remove, merge and delete', async () => {
    const store = await makeStore();
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance: who,
    });
    const a = await store.createPage({ parentId: scope.id, name: 'A', body: 'x', provenance: who });
    const b = await store.createPage({ parentId: scope.id, name: 'B', body: 'y', provenance: who });
    const c = await store.createPage({ parentId: scope.id, name: 'C', body: 'z', provenance: who });
    const listed = async (audience: string[]) =>
      (await store.listPins({ audience, read: 'all', limit: 50 })).pins.map(pin => pin.pageName).sort();
    await store.addPinAudience({ pageId: a.id, audience: ['r:1', 'r:2'], createdBy: 'host' });
    await store.addPinAudience({ pageId: b.id, audience: ['r:3'], createdBy: 'host' });
    await store.addPinAudience({ pageId: c.id, audience: ['r:2'], createdBy: 'host' });
    expect(await listed(['r:2'])).toEqual(['A', 'C']);
    await store.removePinAudience({ pageId: a.id, audience: ['r:2'], removedBy: 'host' });
    expect(await listed(['r:2'])).toEqual(['C']);
    expect(await listed(['r:1', 'r:3'])).toEqual(['A', 'B']);
    await store.mergePages({ sourceId: b.id, targetId: a.id, sourceVersion: b.version, provenance: who });
    expect(await listed(['r:3'])).toEqual(['A']);
    await store.deletePage({ id: c.id, expectedVersion: c.version, deletedBy: 'host' });
    expect(await listed(['r:2'])).toEqual([]);
    await store.removePinAudience({ pageId: a.id, audience: ['r:1', 'r:3'], removedBy: 'host' });
    expect(await listed(['r:1', 'r:3'])).toEqual([]);
    await store.dangerouslyReset();
  });

  it('upgrades a database from an earlier alpha: sibling keys under different parents, missing indexes, unindexed pins', async () => {
    const store = await makeStore();
    const { scope } = await store.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'Acme',
      provenance: who,
    });
    const p1 = await store.createPage({ parentId: scope.id, key: 'one', name: 'One', body: 'x', provenance: who });
    await store.addPinAudience({ pageId: p1.id, audience: ['r:1'], createdBy: 'host' });
    // Recreate the earlier layout: per-scope live key, no path index, no audience rows.
    await pool.query('ALTER TABLE `mastra_knowledge_pages` DROP INDEX idx_kpages_live_key, DROP COLUMN liveKey');
    await pool.query(
      "ALTER TABLE `mastra_knowledge_pages` ADD COLUMN liveKey VARCHAR(768) COLLATE utf8mb4_bin AS (IF(deletedAt IS NULL AND `key` IS NOT NULL, CONCAT(scopeId, '#', `key`), NULL)) STORED, ADD UNIQUE KEY idx_kpages_live_key (liveKey)",
    );
    await pool.query('ALTER TABLE `mastra_knowledge_pages` DROP INDEX idx_kpages_path');
    await pool.query('DELETE FROM `mastra_knowledge_pin_audiences`');
    const child = async (parentId: string, key: string) =>
      store.createPage({ parentId, key, name: `${key} under ${parentId}`, provenance: who });
    await expect(child(p1.id, 'one')).rejects.toThrow();
    await store.init();
    await expect(child(p1.id, 'one')).resolves.toBeDefined();
    const [indexes] = (await pool.query(
      "SHOW INDEX FROM `mastra_knowledge_pages` WHERE Key_name = 'idx_kpages_path'",
    )) as any;
    expect(indexes.length).toBeGreaterThan(0);
    expect((await store.listPins({ audience: ['r:1'], read: 'all', limit: 10 })).pins.map(pin => pin.pageName)).toEqual(
      ['One'],
    );
    await store.dangerouslyReset();
  });
});
