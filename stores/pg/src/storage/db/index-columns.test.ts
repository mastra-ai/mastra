import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '..';
import { generateIndexSQL } from './index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
const schemaName = `opclass_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
let admin: Pool;

beforeAll(async () => {
  admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA "${schemaName}"`);
  await admin.query(`CREATE TABLE "${schemaName}".items (name text)`);
});

afterAll(async () => {
  await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await admin.end();
});

async function indexDefinition(indexName: string) {
  const { rows } = await admin.query<{ indexdef: string }>(
    'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
    [schemaName, indexName],
  );
  return rows[0]?.indexdef;
}

describe('index DDL with an operator class', () => {
  it('builds a descending index with an operator class', async () => {
    await admin.query(
      generateIndexSQL(
        { name: 'items_name_pattern_idx', table: 'items', columns: ['name DESC'], opclass: 'text_pattern_ops' },
        schemaName,
      ),
    );

    expect(await indexDefinition('items_name_pattern_idx')).toContain('(name text_pattern_ops DESC)');
  });

  // Custom indexes that fail at init are only logged, so the index used to go
  // missing silently when it combined an operator class with DESC.
  it('creates a configured descending index with an operator class at init', async () => {
    const store = new PostgresStore({
      id: `opclass-${randomUUID()}`,
      connectionString,
      schemaName,
      indexes: [
        {
          name: 'threads_title_pattern_idx',
          table: 'mastra_threads',
          columns: ['title DESC'],
          opclass: 'text_pattern_ops',
        },
      ],
    });

    try {
      await store.init();
      expect(await indexDefinition('threads_title_pattern_idx')).toContain('(title text_pattern_ops DESC)');
    } finally {
      await store.close();
    }
  });
});
