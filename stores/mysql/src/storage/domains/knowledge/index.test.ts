import { KNOWLEDGE_PAGES_TABLE_NAMES } from '@internal/core/knowledge-compat';
import { createKnowledgePageStoreTests, createKnowledgeSchemaResetTests } from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import { afterAll, expect, vi } from 'vitest';

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
const operations = new StoreOperationsMySQL({ pool, database });
const createStore = () => new KnowledgeMySQL({ pool, operations });
afterAll(() => pool.end());

createKnowledgePageStoreTests(async () => {
  const store = createStore();
  await store.dangerouslyReset();
  return store;
});

createKnowledgeSchemaResetTests(async () => {
  const store = createStore();
  await store.dangerouslyReset();
  // A schema version this release doesn't know: init must refuse and only reset may replace it.
  await pool.query("UPDATE `mastra_knowledge_access_state` SET schemaVersion = 5 WHERE id = 'knowledge'");
  await pool.query('CREATE TABLE IF NOT EXISTS `existing_domain` (id VARCHAR(64) PRIMARY KEY)');
  await pool.query("INSERT IGNORE INTO `existing_domain` (id) VALUES ('preserved')");
  return {
    store,
    snapshot: async () => {
      const [tables] = await pool.query("SHOW TABLES LIKE 'mastra\\_knowledge\\_%'");
      const [state] = await pool.query('SELECT * FROM `mastra_knowledge_access_state`');
      return { tables, state };
    },
    assertResetResult: async () => {
      const [preserved] = await pool.query('SELECT id FROM `existing_domain`');
      expect(preserved).toEqual([{ id: 'preserved' }]);
      const [tables] = await pool.query(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%'",
      );
      expect(new Set((tables as Array<{ name: string }>).map(row => row.name))).toEqual(
        new Set([...KNOWLEDGE_PAGES_TABLE_NAMES, 'mastra_knowledge_pin_audiences']),
      );
    },
    cleanup: async () => {
      await pool.query('DROP TABLE IF EXISTS `existing_domain`');
    },
  };
});
