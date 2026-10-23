import { KnowledgeUnsupportedError } from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import { afterAll, describe, expect, it } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { KnowledgeMySQL } from '.';

const database = process.env.MYSQL_DB || 'mastra';
const pool = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database,
  connectionLimit: 1,
});
const operations = new StoreOperationsMySQL({ pool, database });

function createStore() {
  return new KnowledgeMySQL({ pool, operations });
}

describe('MySQL canonical Knowledge support', () => {
  it('reports unsupported without initializing legacy Knowledge tables', async () => {
    const store = createStore();

    expect(store.getCapabilities()).toEqual({ supported: false, contractVersion: 1, schemaVersion: null });
    await expect(store.createNode({ name: 'Unsupported', scopeIds: [], isScope: false })).rejects.toBeInstanceOf(
      KnowledgeUnsupportedError,
    );
    await expect(store.dangerouslyClearAll()).rejects.toThrow('MySQL does not support Knowledge.');
    expect(KnowledgeMySQL.getExportDDL()).toEqual([]);
  });
});

afterAll(async () => {
  await pool.end();
});
