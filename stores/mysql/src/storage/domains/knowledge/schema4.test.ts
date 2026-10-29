import { createKnowledgePageStoreTests } from '@internal/storage-test-utils';
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
createKnowledgePageStoreTests(async () => {
  const store = createStore();
  await store.dangerouslyReset();
  return store;
});

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
});
