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
});
