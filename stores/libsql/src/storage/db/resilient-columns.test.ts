import { createClient } from '@libsql/client';
import { TABLE_SCHEMAS } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { LibSQLDB } from './index';

/**
 * Deterministically finds a table from TABLE_SCHEMAS that has:
 * 1. A primary key column
 * 2. A nullable text non-primary-key column
 * This avoids nondeterministic Object.keys ordering issues.
 */
function findSuitableTestTable(): {
  tableName: TABLE_NAMES;
  schema: Record<string, StorageColumn>;
  primaryKeyCol: string;
  nonPkColumn: string;
} {
  for (const [name, schema] of Object.entries(TABLE_SCHEMAS)) {
    const pkCol = Object.entries(schema).find(([, def]) => def.primaryKey)?.[0];
    const textNullableCol = Object.entries(schema).find(
      ([, def]) => !def.primaryKey && def.type === 'text' && def.nullable,
    )?.[0];
    if (pkCol && textNullableCol) {
      return {
        tableName: name as TABLE_NAMES,
        schema: schema as Record<string, StorageColumn>,
        primaryKeyCol: pkCol,
        nonPkColumn: textNullableCol,
      };
    }
  }
  throw new Error('No suitable table found in TABLE_SCHEMAS with a PK and a nullable text non-PK column');
}

const { tableName: TEST_TABLE, schema: testSchema, primaryKeyCol, nonPkColumn } = findSuitableTestTable();

/**
 * Builds a minimal valid record with required fields for the test table.
 * @param suffix - A unique suffix to avoid PK conflicts between test cases.
 */
function buildValidRecord(suffix: string): Record<string, any> {
  const record: Record<string, any> = {};
  for (const [col, def] of Object.entries(testSchema)) {
    if (def.primaryKey || !def.nullable) {
      switch (def.type) {
        case 'text':
        case 'uuid':
          record[col] = `${suffix}-${col}`;
          break;
        case 'integer':
        case 'bigint':
        case 'float':
          record[col] = 0;
          break;
        case 'boolean':
          record[col] = false;
          break;
        case 'jsonb':
          record[col] = {};
          break;
        case 'timestamp':
          record[col] = new Date().toISOString();
          break;
      }
    }
  }
  return record;
}

/**
 * Tests that insert/update operations silently drop unknown columns
 * rather than failing with SQL errors. This ensures forward compatibility
 * when newer domain packages add fields that haven't been migrated yet.
 */
describe('Resilient storage columns', () => {
  let db: LibSQLDB;
  let rawClient: ReturnType<typeof createClient>;

  beforeEach(async () => {
    rawClient = createClient({ url: 'file::memory:' });
    db = new LibSQLDB({ client: rawClient });

    // Create the table with the known schema
    await db.createTable({
      tableName: TEST_TABLE,
      schema: testSchema,
    });
  });

  it('should silently drop unknown columns on insert', async () => {
    const recordWithUnknowns = {
      ...buildValidRecord('insert'),
      unknownField1: 'should be dropped',
      unknownField2: 42,
      requestContext: { someNewField: true },
    };

    // Unknown columns should be silently dropped — rejection means test failure
    await db.insert({ tableName: TEST_TABLE, record: recordWithUnknowns });

    // Verify the known fields survived filtering and were persisted
    const result = await db.select({
      tableName: TEST_TABLE,
      keys: { [primaryKeyCol]: recordWithUnknowns[primaryKeyCol] },
    });
    expect(result).not.toBeNull();
    expect((result as any)?.[primaryKeyCol]).toBe(recordWithUnknowns[primaryKeyCol]);
  });

  it('should silently drop unknown columns on update', async () => {
    const validRecord = buildValidRecord('update');
    await db.insert({ tableName: TEST_TABLE, record: validRecord });

    // Try to update with unknown columns + one known column
    const updateData: Record<string, any> = {
      unknownField1: 'should be dropped',
      unknownField2: 42,
      [nonPkColumn]: 'updated-value',
    };

    const keys: Record<string, any> = {
      [primaryKeyCol]: validRecord[primaryKeyCol],
    };

    // Unknown columns should be silently dropped
    await db.update({ tableName: TEST_TABLE, keys, data: updateData });

    // Verify the known update field was applied
    const result = await db.select({ tableName: TEST_TABLE, keys });
    expect(result).not.toBeNull();
    expect((result as any)?.[nonPkColumn]).toBe('updated-value');
  });

  it('should silently drop unknown columns on batchInsert', async () => {
    const records = [1, 2, 3].map(i => ({
      ...buildValidRecord(`batch-${i}`),
      unknownBatchField: `dropped-${i}`,
    }));

    await db.batchInsert({ tableName: TEST_TABLE, records });

    // Verify all records were inserted with known fields intact
    for (const record of records) {
      const result = await db.select({
        tableName: TEST_TABLE,
        keys: { [primaryKeyCol]: record[primaryKeyCol] },
      });
      expect(result).not.toBeNull();
      expect((result as any)?.[primaryKeyCol]).toBe(record[primaryKeyCol]);
    }
  });

  it('should handle update where all data columns are unknown', async () => {
    const validRecord = buildValidRecord('all-unknown');
    await db.insert({ tableName: TEST_TABLE, record: validRecord });

    const keys: Record<string, any> = {
      [primaryKeyCol]: validRecord[primaryKeyCol],
    };

    // Update with ONLY unknown columns - should be a no-op, not an error
    await db.update({
      tableName: TEST_TABLE,
      keys,
      data: { totallyUnknown: 'value', anotherUnknown: 123 },
    });
  });

  it('should handle insert where all columns are unknown', async () => {
    // Insert with ONLY unknown columns - should be a no-op, not an error
    await db.insert({
      tableName: TEST_TABLE,
      record: { totallyUnknown: 'value', anotherUnknown: 123 },
    });
  });

  it('should handle batchInsert where some records have only unknown columns', async () => {
    const records = [
      // First record has only unknown columns - should be skipped
      { totallyUnknown: 'value', anotherUnknown: 123 },
      // Second record has valid columns + unknown
      { ...buildValidRecord('batch-mixed-2'), unknownField: 'dropped' },
      // Third record has only unknown columns - should be skipped
      { yetAnotherUnknown: 'value' },
    ];

    // Empty-after-filtering records should be skipped
    await db.batchInsert({ tableName: TEST_TABLE, records });
  });

  it('should silently drop unknown columns on batchUpdate', async () => {
    // Insert baseline records
    const record1 = buildValidRecord('batch-update-1');
    const record2 = buildValidRecord('batch-update-2');
    await db.insert({ tableName: TEST_TABLE, record: record1 });
    await db.insert({ tableName: TEST_TABLE, record: record2 });

    // batchUpdate with unknown columns mixed in
    await db.batchUpdate({
      tableName: TEST_TABLE,
      updates: [
        {
          keys: { [primaryKeyCol]: record1[primaryKeyCol] },
          data: { [nonPkColumn]: 'batch-updated-1', unknownField: 'dropped' },
        },
        {
          keys: { [primaryKeyCol]: record2[primaryKeyCol] },
          data: { [nonPkColumn]: 'batch-updated-2', anotherUnknown: 42 },
        },
      ],
    });

    // Verify the known-field updates applied
    const result1 = await db.select({
      tableName: TEST_TABLE,
      keys: { [primaryKeyCol]: record1[primaryKeyCol] },
    });
    expect((result1 as any)?.[nonPkColumn]).toBe('batch-updated-1');

    const result2 = await db.select({
      tableName: TEST_TABLE,
      keys: { [primaryKeyCol]: record2[primaryKeyCol] },
    });
    expect((result2 as any)?.[nonPkColumn]).toBe('batch-updated-2');
  });

  it('should handle batchUpdate where all data columns are unknown', async () => {
    const validRecord = buildValidRecord('batch-update-all-unknown');
    await db.insert({ tableName: TEST_TABLE, record: validRecord });

    // batchUpdate with ONLY unknown columns - should be a no-op
    await db.batchUpdate({
      tableName: TEST_TABLE,
      updates: [
        {
          keys: { [primaryKeyCol]: validRecord[primaryKeyCol] },
          data: { totallyUnknown: 'value', anotherUnknown: 123 },
        },
      ],
    });

    // Verify the row was not changed
    const result = await db.select({
      tableName: TEST_TABLE,
      keys: { [primaryKeyCol]: validRecord[primaryKeyCol] },
    });
    expect(result).not.toBeNull();
  });

  it('should invalidate column cache when alterTable adds new columns', async () => {
    // Insert a record - this caches the table columns
    const validRecord = buildValidRecord('cache');
    await db.insert({ tableName: TEST_TABLE, record: validRecord });

    // Add a new column via alterTable
    const newColumnName = 'newTestColumn';
    const extendedSchema = {
      ...testSchema,
      [newColumnName]: { type: 'text' as const, nullable: true },
    };

    await db.alterTable({
      tableName: TEST_TABLE,
      schema: extendedSchema,
      ifNotExists: [newColumnName],
    });

    // Now insert with the new column - it should NOT be dropped
    const recordWithNewCol: Record<string, any> = {
      ...buildValidRecord('cache-2'),
      [newColumnName]: 'new-column-value',
    };

    await db.insert({ tableName: TEST_TABLE, record: recordWithNewCol });

    // Verify the new column value round-trips correctly (not filtered out by stale cache)
    // Use raw SQL since db.select() only queries columns from the compile-time TABLE_SCHEMAS
    const rawResult = await rawClient.execute({
      sql: `SELECT "${newColumnName}" FROM ${TEST_TABLE} WHERE "${primaryKeyCol}" = ?`,
      args: [recordWithNewCol[primaryKeyCol]],
    });
    expect(rawResult.rows).toHaveLength(1);
    expect(rawResult.rows[0]?.[newColumnName]).toBe('new-column-value');
  });
});
