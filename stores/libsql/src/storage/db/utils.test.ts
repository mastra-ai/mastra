import { createClient } from '@libsql/client';
import { SKILL_BLOBS_SCHEMA, TABLE_SKILL_BLOBS } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prepareStatement } from './utils';
import { LibSQLDB } from '.';

describe('prepareStatement conflict handling', () => {
  const record = {
    hash: 'hash-1',
    content: 'content',
    size: 7,
    mimeType: 'text/plain',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('generates replacement statements by default', () => {
    const statement = prepareStatement({ tableName: TABLE_SKILL_BLOBS, record });

    expect(statement.sql).toMatch(/^INSERT OR REPLACE INTO /);
    expect(statement.args).toEqual(Object.values(record));
  });

  it('generates ignore statements without changing arguments or placeholders', () => {
    const replacement = prepareStatement({ tableName: TABLE_SKILL_BLOBS, record });
    const ignored = prepareStatement({ tableName: TABLE_SKILL_BLOBS, record, onConflict: 'ignore' });

    expect(ignored.sql).toBe(replacement.sql.replace('INSERT OR REPLACE', 'INSERT OR IGNORE'));
    expect(ignored.args).toEqual(replacement.args);
  });
});

describe('LibSQLDB batch conflict handling', () => {
  let client: ReturnType<typeof createClient>;
  let db: LibSQLDB;

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' });
    db = new LibSQLDB({ client });
    await db.createTable({ tableName: TABLE_SKILL_BLOBS, schema: SKILL_BLOBS_SCHEMA });
  });

  afterEach(async () => {
    await client.close();
  });

  async function storedContent() {
    const result = await client.execute({
      sql: `SELECT "content" FROM "${TABLE_SKILL_BLOBS}" WHERE "hash" = ?`,
      args: ['shared-hash'],
    });
    return result.rows[0]?.content;
  }

  it('replaces existing rows by default', async () => {
    await db.batchInsert({
      tableName: TABLE_SKILL_BLOBS,
      records: [{ hash: 'shared-hash', content: 'first', size: 5, createdAt: new Date().toISOString() }],
    });
    await db.batchInsert({
      tableName: TABLE_SKILL_BLOBS,
      records: [{ hash: 'shared-hash', content: 'second', size: 6, createdAt: new Date().toISOString() }],
    });

    await expect(storedContent()).resolves.toBe('second');
  });

  it('preserves existing rows in ignore mode', async () => {
    await db.batchInsert({
      tableName: TABLE_SKILL_BLOBS,
      records: [{ hash: 'shared-hash', content: 'first', size: 5, createdAt: new Date().toISOString() }],
    });
    await db.batchInsert({
      tableName: TABLE_SKILL_BLOBS,
      records: [{ hash: 'shared-hash', content: 'second', size: 6, createdAt: new Date().toISOString() }],
      onConflict: 'ignore',
    });

    await expect(storedContent()).resolves.toBe('first');
  });
});
