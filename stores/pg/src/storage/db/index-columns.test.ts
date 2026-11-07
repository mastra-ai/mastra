import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('index DDL with an operator class', () => {
  it('builds a descending index with an operator class', async () => {
    await admin.query(
      generateIndexSQL(
        { name: 'items_name_pattern_idx', table: 'items', columns: ['name DESC'], opclass: 'text_pattern_ops' },
        schemaName,
      ),
    );

    const { rows } = await admin.query<{ indexdef: string }>(
      'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
      [schemaName, 'items_name_pattern_idx'],
    );
    expect(rows[0]?.indexdef).toContain('(name text_pattern_ops DESC)');
  });
});
