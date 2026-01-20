import { OLD_SPAN_SCHEMA, TABLE_SPANS, TABLE_SCHEMAS } from '@mastra/core/storage';
import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MssqlDB } from './db';

const TEST_CONFIG = {
  id: process.env.MSSQL_STORE_ID || 'test-mssql-store',
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
};

/**
 * MSSQL-specific migration tests that verify the spans table migration
 * from OLD_SPAN_SCHEMA to the current SPAN_SCHEMA works correctly.
 */
describe('MSSQL Spans Table Migration', () => {
  const testSchema = `migration_test_schema_${Date.now()}`;
  let pool: sql.ConnectionPool;
  let dbOps: MssqlDB;

  beforeAll(async () => {
    // Create connection pool
    pool = new sql.ConnectionPool({
      server: (TEST_CONFIG as any).server,
      port: (TEST_CONFIG as any).port,
      database: (TEST_CONFIG as any).database,
      user: (TEST_CONFIG as any).user,
      password: (TEST_CONFIG as any).password,
      options: { encrypt: true, trustServerCertificate: true },
    });
    await pool.connect();

    // Create test schema
    try {
      await pool.request().query(`DROP SCHEMA IF EXISTS ${testSchema}`);
    } catch {}
    await pool.request().query(`CREATE SCHEMA ${testSchema}`);

    // Create DB layer for direct operations
    dbOps = new MssqlDB({
      pool,
      schemaName: testSchema,
    });
  });

  afterAll(async () => {
    try {
      // Drop all tables in test schema first
      const tables = await pool
        .request()
        .query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${testSchema}' AND TABLE_TYPE = 'BASE TABLE'`,
        );

      for (const row of tables.recordset) {
        await pool.request().query(`DROP TABLE IF EXISTS [${testSchema}].[${row.TABLE_NAME}]`);
      }

      // Drop schema
      await pool.request().query(`DROP SCHEMA IF EXISTS ${testSchema}`);
      await pool.close();
    } catch (error) {
      console.warn('MSSQL migration test cleanup failed:', error);
    }
  });

  it('should migrate old spans table schema to new schema with additional columns and preserve data', async () => {
    // Step 1: Create table with OLD schema (simulating existing database)
    const oldColumns = Object.entries(OLD_SPAN_SCHEMA)
      .map(([colName, colDef]) => {
        const sqlType =
          colDef.type === 'text'
            ? 'NVARCHAR(MAX)'
            : colDef.type === 'jsonb'
              ? 'NVARCHAR(MAX)'
              : colDef.type === 'timestamp'
                ? 'DATETIME2'
                : colDef.type === 'boolean'
                  ? 'BIT'
                  : 'NVARCHAR(MAX)';
        const nullable = colDef.nullable === false ? 'NOT NULL' : 'NULL';
        return `[${colName}] ${sqlType} ${nullable}`;
      })
      .join(', ');

    await pool.request().query(`
      CREATE TABLE [${testSchema}].[${TABLE_SPANS}] (
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

    const insertRequest = pool.request();
    insertRequest.input('traceId', testData.traceId);
    insertRequest.input('spanId', testData.spanId);
    insertRequest.input('parentSpanId', testData.parentSpanId);
    insertRequest.input('name', testData.name);
    insertRequest.input('spanType', testData.spanType);
    insertRequest.input('scope', testData.scope);
    insertRequest.input('attributes', testData.attributes);
    insertRequest.input('metadata', testData.metadata);
    insertRequest.input('links', testData.links);
    insertRequest.input('input', testData.input);
    insertRequest.input('output', testData.output);
    insertRequest.input('error', testData.error);
    insertRequest.input('isEvent', testData.isEvent);
    insertRequest.input('startedAt', testData.startedAt);
    insertRequest.input('endedAt', testData.endedAt);
    insertRequest.input('createdAt', testData.createdAt);
    insertRequest.input('updatedAt', testData.updatedAt);

    await insertRequest.query(`
      INSERT INTO [${testSchema}].[${TABLE_SPANS}]
      ([traceId], [spanId], [parentSpanId], [name], [spanType], [scope], [attributes], [metadata], [links], [input], [output], [error], [isEvent], [startedAt], [endedAt], [createdAt], [updatedAt])
      VALUES (@traceId, @spanId, @parentSpanId, @name, @spanType, @scope, @attributes, @metadata, @links, @input, @output, @error, @isEvent, @startedAt, @endedAt, @createdAt, @updatedAt)
    `);

    // Insert a second row with parent reference
    const childInsert = pool.request();
    childInsert.input('traceId', 'test-trace-migration-1');
    childInsert.input('spanId', 'test-span-migration-2');
    childInsert.input('parentSpanId', 'test-span-migration-1');
    childInsert.input('name', 'Child Span Before Migration');
    childInsert.input('spanType', 'tool_call');
    childInsert.input('scope', null);
    childInsert.input('attributes', JSON.stringify({ tool: 'test-tool' }));
    childInsert.input('metadata', null);
    childInsert.input('links', null);
    childInsert.input('input', JSON.stringify({ arg: 'test' }));
    childInsert.input('output', JSON.stringify({ result: 'ok' }));
    childInsert.input('error', null);
    childInsert.input('isEvent', false);
    childInsert.input('startedAt', new Date('2024-01-01T00:00:00.500Z'));
    childInsert.input('endedAt', new Date('2024-01-01T00:00:00.800Z'));
    childInsert.input('createdAt', new Date('2024-01-01T00:00:00.500Z'));
    childInsert.input('updatedAt', new Date('2024-01-01T00:00:00.800Z'));

    await childInsert.query(`
      INSERT INTO [${testSchema}].[${TABLE_SPANS}]
      ([traceId], [spanId], [parentSpanId], [name], [spanType], [scope], [attributes], [metadata], [links], [input], [output], [error], [isEvent], [startedAt], [endedAt], [createdAt], [updatedAt])
      VALUES (@traceId, @spanId, @parentSpanId, @name, @spanType, @scope, @attributes, @metadata, @links, @input, @output, @error, @isEvent, @startedAt, @endedAt, @createdAt, @updatedAt)
    `);

    // Verify data exists before migration
    const countBefore = await pool.request().query(`SELECT COUNT(*) as count FROM [${testSchema}].[${TABLE_SPANS}]`);
    expect(countBefore.recordset[0].count).toBe(2);

    // Verify old table structure - should NOT have new columns
    const beforeMigration = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${testSchema}' AND TABLE_NAME = '${TABLE_SPANS}' AND COLUMN_NAME = 'entityType'
    `);
    expect(beforeMigration.recordset.length).toBe(0);

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
      const result = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${testSchema}' AND TABLE_NAME = '${TABLE_SPANS}' AND COLUMN_NAME = '${columnName}'
      `);
      expect(result.recordset.length, `Expected column '${columnName}' to exist after migration`).toBe(1);
    }

    // Step 5: Verify original columns still exist
    const originalColumns = ['traceId', 'spanId', 'parentSpanId', 'name', 'spanType', 'attributes', 'metadata'];
    for (const columnName of originalColumns) {
      const result = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${testSchema}' AND TABLE_NAME = '${TABLE_SPANS}' AND COLUMN_NAME = '${columnName}'
      `);
      expect(result.recordset.length, `Expected original column '${columnName}' to still exist`).toBe(1);
    }

    // Step 6: Verify data is still queryable after migration
    const countAfter = await pool.request().query(`SELECT COUNT(*) as count FROM [${testSchema}].[${TABLE_SPANS}]`);
    expect(countAfter.recordset[0].count).toBe(2);

    // Query the root span and verify all original data is preserved
    const rootSpanResult = await pool
      .request()
      .input('spanId', 'test-span-migration-1')
      .query(`SELECT * FROM [${testSchema}].[${TABLE_SPANS}] WHERE [spanId] = @spanId`);
    const rootSpan = rootSpanResult.recordset[0];

    expect(rootSpan).toBeDefined();
    expect(rootSpan.traceId).toBe('test-trace-migration-1');
    expect(rootSpan.name).toBe('Pre-migration Span');
    expect(rootSpan.spanType).toBe('agent_run');
    expect(rootSpan.parentSpanId).toBeNull();
    expect(JSON.parse(rootSpan.attributes)).toEqual({ key: 'value' });
    expect(JSON.parse(rootSpan.metadata)).toEqual({ custom: 'data' });
    expect(JSON.parse(rootSpan.input)).toEqual({ message: 'hello' });
    expect(JSON.parse(rootSpan.output)).toEqual({ result: 'success' });

    // Query child span
    const childSpanResult = await pool
      .request()
      .input('spanId', 'test-span-migration-2')
      .query(`SELECT * FROM [${testSchema}].[${TABLE_SPANS}] WHERE [spanId] = @spanId`);
    const childSpan = childSpanResult.recordset[0];

    expect(childSpan).toBeDefined();
    expect(childSpan.parentSpanId).toBe('test-span-migration-1');
    expect(childSpan.name).toBe('Child Span Before Migration');

    // Step 7: Verify new columns have NULL values for existing data (since they didn't exist before)
    expect(rootSpan.entityType).toBeNull();
    expect(rootSpan.entityId).toBeNull();
    expect(rootSpan.userId).toBeNull();
    expect(rootSpan.environment).toBeNull();

    // Step 8: Verify we can insert new data with the new columns
    const newSpanInsert = pool.request();
    newSpanInsert.input('traceId', 'test-trace-migration-2');
    newSpanInsert.input('spanId', 'test-span-migration-3');
    newSpanInsert.input('parentSpanId', null);
    newSpanInsert.input('name', 'Post-migration Span');
    newSpanInsert.input('spanType', 'workflow_run');
    newSpanInsert.input('isEvent', false);
    newSpanInsert.input('startedAt', new Date());
    newSpanInsert.input('createdAt', new Date());
    newSpanInsert.input('entityType', 'workflow');
    newSpanInsert.input('entityId', 'workflow-123');
    newSpanInsert.input('environment', 'production');

    await newSpanInsert.query(`
      INSERT INTO [${testSchema}].[${TABLE_SPANS}]
      ([traceId], [spanId], [parentSpanId], [name], [spanType], [isEvent], [startedAt], [createdAt], [entityType], [entityId], [environment])
      VALUES (@traceId, @spanId, @parentSpanId, @name, @spanType, @isEvent, @startedAt, @createdAt, @entityType, @entityId, @environment)
    `);

    const newSpanResult = await pool
      .request()
      .input('spanId', 'test-span-migration-3')
      .query(`SELECT * FROM [${testSchema}].[${TABLE_SPANS}] WHERE [spanId] = @spanId`);
    const newSpan = newSpanResult.recordset[0];

    expect(newSpan).toBeDefined();
    expect(newSpan.entityType).toBe('workflow');
    expect(newSpan.entityId).toBe('workflow-123');
    expect(newSpan.environment).toBe('production');
  });
});
