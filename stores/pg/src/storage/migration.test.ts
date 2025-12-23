import { OLD_SPAN_SCHEMA, TABLE_SPANS, TABLE_SCHEMAS } from '@mastra/core/storage';
import pgPromise from 'pg-promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDB } from './db';
import { TEST_CONFIG, connectionString } from './test-utils';
import { PostgresStore } from '.';

/**
 * PostgreSQL-specific migration tests that verify the spans table migration
 * from OLD_SPAN_SCHEMA to the current SPAN_SCHEMA works correctly.
 */
describe('PostgreSQL Spans Table Migration', () => {
  const testSchema = `migration_test_schema_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let migrationStore: PostgresStore;
  let dbOps: PgDB;

  beforeAll(async () => {
    // Use a temp connection to set up schema
    const tempPgp = pgPromise();
    const tempDb = tempPgp(connectionString);

    try {
      await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await tempDb.none(`CREATE SCHEMA ${testSchema}`);
    } finally {
      tempPgp.end();
    }

    migrationStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'migration-test-store',
      schemaName: testSchema,
    });

    // Wait for store to be ready before creating dbOps
    await migrationStore.init();
    dbOps = new PgDB({ client: migrationStore.db, schemaName: testSchema });
  });

  afterAll(async () => {
    await migrationStore?.close();

    // Use a temp connection to clean up
    const tempPgp = pgPromise();
    const tempDb = tempPgp(connectionString);

    try {
      await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      tempPgp.end();
    }
  });

  it('should migrate old spans table schema to new schema with additional columns and preserve data', async () => {
    // First drop the table if it exists (from init)
    await migrationStore.db.none(`DROP TABLE IF EXISTS ${testSchema}.${TABLE_SPANS}`);

    // Step 1: Create table with OLD schema (simulating existing database)
    const oldColumns = Object.entries(OLD_SPAN_SCHEMA)
      .map(([colName, colDef]) => {
        const sqlType =
          colDef.type === 'text'
            ? 'TEXT'
            : colDef.type === 'jsonb'
              ? 'JSONB'
              : colDef.type === 'timestamp'
                ? 'TIMESTAMP'
                : colDef.type === 'boolean'
                  ? 'BOOLEAN'
                  : 'TEXT';
        const nullable = colDef.nullable === false ? 'NOT NULL' : '';
        return `"${colName}" ${sqlType} ${nullable}`.trim();
      })
      .join(', ');

    await migrationStore.db.none(`
      CREATE TABLE IF NOT EXISTS ${testSchema}.${TABLE_SPANS} (
        ${oldColumns}
      )
    `);

    // Step 2: Insert test data using OLD schema columns
    const testData = {
      traceId: 'test-trace-migration-1',
      spanId: 'test-span-migration-1',
      parentSpanId: null,
      name: 'Pre-migration Span',
      spanType: 'agent_run',
      scope: JSON.stringify({ version: '1.0.0' }),
      attributes: JSON.stringify({ key: 'value' }),
      metadata: JSON.stringify({ custom: 'data' }),
      links: null,
      input: JSON.stringify({ message: 'hello' }),
      output: JSON.stringify({ result: 'success' }),
      error: null,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      endedAt: new Date('2024-01-01T00:00:01Z'),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:01Z'),
    };

    await migrationStore.db.none(
      `INSERT INTO ${testSchema}.${TABLE_SPANS}
       ("traceId", "spanId", "parentSpanId", "name", "spanType", "scope", "attributes", "metadata", "links", "input", "output", "error", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        testData.traceId,
        testData.spanId,
        testData.parentSpanId,
        testData.name,
        testData.spanType,
        testData.scope,
        testData.attributes,
        testData.metadata,
        testData.links,
        testData.input,
        testData.output,
        testData.error,
        testData.isEvent,
        testData.startedAt,
        testData.endedAt,
        testData.createdAt,
        testData.updatedAt,
      ],
    );

    // Insert a second row with parent reference
    const childData = {
      traceId: 'test-trace-migration-1',
      spanId: 'test-span-migration-2',
      parentSpanId: 'test-span-migration-1',
      name: 'Child Span Before Migration',
      spanType: 'tool_call',
      scope: null,
      attributes: JSON.stringify({ tool: 'test-tool' }),
      metadata: null,
      links: null,
      input: JSON.stringify({ arg: 'test' }),
      output: JSON.stringify({ result: 'ok' }),
      error: null,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00.500Z'),
      endedAt: new Date('2024-01-01T00:00:00.800Z'),
      createdAt: new Date('2024-01-01T00:00:00.500Z'),
      updatedAt: new Date('2024-01-01T00:00:00.800Z'),
    };

    await migrationStore.db.none(
      `INSERT INTO ${testSchema}.${TABLE_SPANS}
       ("traceId", "spanId", "parentSpanId", "name", "spanType", "scope", "attributes", "metadata", "links", "input", "output", "error", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        childData.traceId,
        childData.spanId,
        childData.parentSpanId,
        childData.name,
        childData.spanType,
        childData.scope,
        childData.attributes,
        childData.metadata,
        childData.links,
        childData.input,
        childData.output,
        childData.error,
        childData.isEvent,
        childData.startedAt,
        childData.endedAt,
        childData.createdAt,
        childData.updatedAt,
      ],
    );

    // Verify data exists before migration
    const countBefore = await migrationStore.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_SPANS}`,
    );
    expect(Number(countBefore.count)).toBe(2);

    // Verify old table structure - should NOT have new columns
    const beforeMigration = await migrationStore.db.oneOrNone(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = '${testSchema}' AND table_name = '${TABLE_SPANS}' AND column_name = 'entityType'
    `);
    expect(beforeMigration).toBeNull();

    // Step 3: Call createTable which should trigger migration
    await dbOps.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    // Step 4: Verify new columns exist
    const newColumns = [
      'entityType',
      'entityId',
      'entityName',
      'userId',
      'organizationId',
      'resourceId',
      'runId',
      'sessionId',
      'threadId',
      'requestId',
      'environment',
      'source',
      'serviceName',
      'tags',
    ];

    for (const columnName of newColumns) {
      const result = await migrationStore.db.oneOrNone(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = '${testSchema}' AND table_name = '${TABLE_SPANS}' AND column_name = '${columnName}'
      `);
      expect(result, `Expected column '${columnName}' to exist after migration`).not.toBeNull();
    }

    // Step 5: Verify original columns still exist
    const originalColumns = ['traceId', 'spanId', 'parentSpanId', 'name', 'spanType', 'attributes', 'metadata'];
    for (const columnName of originalColumns) {
      const result = await migrationStore.db.oneOrNone(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = '${testSchema}' AND table_name = '${TABLE_SPANS}' AND column_name = '${columnName}'
      `);
      expect(result, `Expected original column '${columnName}' to still exist`).not.toBeNull();
    }

    // Step 6: Verify data is still queryable after migration
    const countAfter = await migrationStore.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_SPANS}`,
    );
    expect(Number(countAfter.count)).toBe(2);

    // Query the root span and verify all original data is preserved
    const rootSpan = await migrationStore.db.oneOrNone(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['test-span-migration-1'],
    );
    expect(rootSpan).not.toBeNull();
    expect(rootSpan.traceId).toBe('test-trace-migration-1');
    expect(rootSpan.name).toBe('Pre-migration Span');
    expect(rootSpan.spanType).toBe('agent_run');
    expect(rootSpan.parentSpanId).toBeNull();
    expect(rootSpan.attributes).toEqual({ key: 'value' });
    expect(rootSpan.metadata).toEqual({ custom: 'data' });
    expect(rootSpan.input).toEqual({ message: 'hello' });
    expect(rootSpan.output).toEqual({ result: 'success' });

    // Query child span
    const childSpan = await migrationStore.db.oneOrNone(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['test-span-migration-2'],
    );
    expect(childSpan).not.toBeNull();
    expect(childSpan.parentSpanId).toBe('test-span-migration-1');
    expect(childSpan.name).toBe('Child Span Before Migration');

    // Step 7: Verify new columns have NULL values for existing data (since they didn't exist before)
    expect(rootSpan.entityType).toBeNull();
    expect(rootSpan.entityId).toBeNull();
    expect(rootSpan.userId).toBeNull();
    expect(rootSpan.environment).toBeNull();

    // Step 8: Verify we can insert new data with the new columns
    await migrationStore.db.none(
      `INSERT INTO ${testSchema}.${TABLE_SPANS}
       ("traceId", "spanId", "parentSpanId", "name", "spanType", "isEvent", "startedAt", "createdAt", "entityType", "entityId", "environment")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'test-trace-migration-2',
        'test-span-migration-3',
        null,
        'Post-migration Span',
        'workflow_run',
        false,
        new Date(),
        new Date(),
        'workflow',
        'workflow-123',
        'production',
      ],
    );

    const newSpan = await migrationStore.db.oneOrNone(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['test-span-migration-3'],
    );
    expect(newSpan).not.toBeNull();
    expect(newSpan.entityType).toBe('workflow');
    expect(newSpan.entityId).toBe('workflow-123');
    expect(newSpan.environment).toBe('production');
  });
});
