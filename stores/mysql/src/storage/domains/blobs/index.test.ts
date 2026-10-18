import { createPool } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { BlobsMySQL } from '.';

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
const store = new BlobsMySQL({ pool, operations });

describe('BlobsMySQL.putMany', () => {
  beforeAll(async () => {
    await store.init();
  });

  beforeEach(async () => {
    await store.dangerouslyClearAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('skips entries whose hash already exists instead of overwriting them', async () => {
    const firstStoredAt = new Date('2026-01-01T00:00:00.000Z');
    await store.put({ hash: 'h1', content: 'original', size: 8, mimeType: 'text/plain', createdAt: firstStoredAt });
    const beforeRepublish = await store.get('h1');

    await store.putMany([
      { hash: 'h1', content: 'replacement', size: 11, mimeType: 'text/markdown', createdAt: new Date() },
      { hash: 'h2', content: 'new', size: 3, createdAt: new Date() },
    ]);

    const existing = await store.get('h1');
    expect(existing).toMatchObject({ content: 'original', size: 8, mimeType: 'text/plain' });
    expect(existing?.createdAt.getTime()).toBe(beforeRepublish?.createdAt.getTime());
    expect(await store.get('h2')).toMatchObject({ content: 'new', size: 3 });
  });
});
