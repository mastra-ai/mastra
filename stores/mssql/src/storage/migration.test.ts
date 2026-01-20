import { MastraError } from '@mastra/core/error';
import { OLD_SPAN_SCHEMA, TABLE_SPANS, TABLE_SCHEMAS } from '@mastra/core/storage';
import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MssqlDB } from './db';
import { MssqlStore } from './index';

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

/**
 * MSSQL-specific tests for handling duplicate (traceId, spanId) combinations
 * during PRIMARY KEY constraint addition.
 *
 * See GitHub Issue #11840: Migration fails when existing spans table has duplicate
 * (traceId, spanId) combinations from before the PRIMARY KEY was introduced.
 */
describe('MSSQL Duplicate Spans Handling', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    pool = new sql.ConnectionPool({
      server: (TEST_CONFIG as any).server,
      port: (TEST_CONFIG as any).port,
      database: (TEST_CONFIG as any).database,
      user: (TEST_CONFIG as any).user,
      password: (TEST_CONFIG as any).password,
      options: { encrypt: true, trustServerCertificate: true },
    });
    await pool.connect();
  });

  afterAll(async () => {
    try {
      await pool.close();
    } catch (error) {
      console.warn('MSSQL duplicate spans test cleanup failed:', error);
    }
  });

  /**
   * Helper to create a test schema and table with OLD schema (no PRIMARY KEY)
   */
  async function createOldSchemaTable(schemaName: string): Promise<void> {
    // Create schema
    try {
      await pool.request().query(`DROP SCHEMA IF EXISTS [${schemaName}]`);
    } catch {}

    // Drop table if it exists (in case schema drop failed)
    try {
      await pool.request().query(`DROP TABLE IF EXISTS [${schemaName}].[${TABLE_SPANS}]`);
    } catch {}

    await pool.request().query(`CREATE SCHEMA [${schemaName}]`);

    // Create table with OLD schema columns (no PRIMARY KEY)
    const oldColumns = Object.entries(OLD_SPAN_SCHEMA)
      .map(([colName, colDef]) => {
        const sqlType =
          colDef.type === 'text'
            ? 'NVARCHAR(100)'
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
      CREATE TABLE [${schemaName}].[${TABLE_SPANS}] (
        ${oldColumns}
      )
    `);
  }

  /**
   * Helper to insert a span record
   */
  async function insertSpan(
    schemaName: string,
    span: {
      traceId: string;
      spanId: string;
      name: string;
      endedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ): Promise<void> {
    const request = pool.request();
    request.input('traceId', span.traceId);
    request.input('spanId', span.spanId);
    request.input('name', span.name);
    request.input('spanType', 'agent_run');
    request.input('isEvent', false);
    request.input('startedAt', new Date('2024-01-01T00:00:00Z'));
    request.input('endedAt', span.endedAt ?? null);
    request.input('createdAt', span.createdAt);
    request.input('updatedAt', span.updatedAt);

    await request.query(`
      INSERT INTO [${schemaName}].[${TABLE_SPANS}]
      ([traceId], [spanId], [name], [spanType], [isEvent], [startedAt], [endedAt], [createdAt], [updatedAt])
      VALUES (@traceId, @spanId, @name, @spanType, @isEvent, @startedAt, @endedAt, @createdAt, @updatedAt)
    `);
  }

  /**
   * Helper to clean up test schema
   */
  async function cleanupSchema(schemaName: string): Promise<void> {
    try {
      await pool.request().query(`DROP TABLE IF EXISTS [${schemaName}].[${TABLE_SPANS}]`);
      await pool.request().query(`DROP SCHEMA IF EXISTS [${schemaName}]`);
    } catch {}
  }

  it('should fail to add PRIMARY KEY when duplicates exist (current behavior)', async () => {
    const testSchema = `dup_test_${Date.now().toString(36)}`;

    try {
      await createOldSchemaTable(testSchema);

      // Insert duplicate spans with same (traceId, spanId)
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'First duplicate',
        endedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Second duplicate',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Verify duplicates exist
      const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${testSchema}].[${TABLE_SPANS}]`);
      expect(countResult.recordset[0].count).toBe(2);

      // Try to add PRIMARY KEY - should fail with unique violation
      const pkConstraintName = `${testSchema}_mastra_ai_spans_traceid_spanid_pk`;
      const addPkSql = `ALTER TABLE [${testSchema}].[${TABLE_SPANS}] ADD CONSTRAINT [${pkConstraintName}] PRIMARY KEY ([traceId], [spanId])`;

      await expect(pool.request().query(addPkSql)).rejects.toThrow();
    } finally {
      await cleanupSchema(testSchema);
    }
  });

  it('should handle PRIMARY KEY addition when no duplicates exist', async () => {
    const testSchema = `nodup_test_${Date.now().toString(36)}`;

    try {
      await createOldSchemaTable(testSchema);

      // Insert unique spans
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Unique span 1',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-2',
        name: 'Unique span 2',
        endedAt: new Date('2024-01-01T00:00:02Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Add PRIMARY KEY - should succeed
      const pkConstraintName = `${testSchema}_mastra_ai_spans_traceid_spanid_pk`;
      const addPkSql = `ALTER TABLE [${testSchema}].[${TABLE_SPANS}] ADD CONSTRAINT [${pkConstraintName}] PRIMARY KEY ([traceId], [spanId])`;

      await expect(pool.request().query(addPkSql)).resolves.not.toThrow();

      // Verify constraint exists
      const constraintResult = await pool
        .request()
        .input('constraintName', pkConstraintName)
        .query(`SELECT 1 AS found FROM sys.key_constraints WHERE name = @constraintName`);
      expect(constraintResult.recordset.length).toBe(1);
    } finally {
      await cleanupSchema(testSchema);
    }
  });

  it('should deduplicate spans and create PRIMARY KEY after createTable()', async () => {
    const testSchema = `dup_dedup_${Date.now().toString(36)}`;

    try {
      await createOldSchemaTable(testSchema);

      // Insert duplicates - one incomplete, one complete (should keep complete)
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Incomplete span',
        endedAt: null, // Not completed
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Complete span',
        endedAt: new Date('2024-01-01T00:00:01Z'), // Completed
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Verify duplicates exist before createTable
      const countBefore = await pool.request().query(`SELECT COUNT(*) as count FROM [${testSchema}].[${TABLE_SPANS}]`);
      expect(countBefore.recordset[0].count).toBe(2);

      const dbOps = new MssqlDB({
        pool,
        schemaName: testSchema,
      });

      await dbOps.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

      // After createTable, duplicates should be removed (only 1 record remains)
      const countAfter = await pool.request().query(`SELECT COUNT(*) as count FROM [${testSchema}].[${TABLE_SPANS}]`);
      expect(countAfter.recordset[0].count).toBe(1);

      // The remaining span should be the completed one
      const remainingSpan = await pool.request().query(`SELECT * FROM [${testSchema}].[${TABLE_SPANS}]`);
      expect(remainingSpan.recordset[0].name).toBe('Complete span');
      expect(remainingSpan.recordset[0].endedAt).not.toBeNull();

      // PRIMARY KEY should now exist
      const pkConstraintName = `${testSchema}_mastra_ai_spans_traceid_spanid_pk`;
      const constraintResult = await pool
        .request()
        .input('constraintName', pkConstraintName)
        .query(`SELECT 1 AS found FROM sys.key_constraints WHERE name = @constraintName`);
      expect(constraintResult.recordset.length).toBe(1);
    } finally {
      await cleanupSchema(testSchema);
    }
  });

  it('should keep span with most recent updatedAt when both are completed', async () => {
    const testSchema = `dup_updated_${Date.now().toString(36)}`;

    try {
      await createOldSchemaTable(testSchema);

      // Insert duplicates - both completed, different updatedAt
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Older span',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'), // Older
      });
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Newer span',
        endedAt: new Date('2024-01-01T00:00:02Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:05Z'), // Newer
      });

      const dbOps = new MssqlDB({
        pool,
        schemaName: testSchema,
      });

      await dbOps.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

      // Should keep the one with most recent updatedAt
      const remainingSpan = await pool.request().query(`SELECT * FROM [${testSchema}].[${TABLE_SPANS}]`);
      expect(remainingSpan.recordset.length).toBe(1);
      expect(remainingSpan.recordset[0].name).toBe('Newer span');
    } finally {
      await cleanupSchema(testSchema);
    }
  });

  it('should keep span with most recent createdAt as final tiebreaker', async () => {
    const testSchema = `dup_created_${Date.now().toString(36)}`;

    try {
      await createOldSchemaTable(testSchema);

      // Insert duplicates - both completed, same updatedAt, different createdAt
      const sameUpdatedAt = new Date('2024-01-01T00:00:05Z');
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Older created',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'), // Older
        updatedAt: sameUpdatedAt,
      });
      await insertSpan(testSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Newer created',
        endedAt: new Date('2024-01-01T00:00:02Z'),
        createdAt: new Date('2024-01-01T00:00:02Z'), // Newer
        updatedAt: sameUpdatedAt,
      });

      const dbOps = new MssqlDB({
        pool,
        schemaName: testSchema,
      });

      await dbOps.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

      // Should keep the one with most recent createdAt
      const remainingSpan = await pool.request().query(`SELECT * FROM [${testSchema}].[${TABLE_SPANS}]`);
      expect(remainingSpan.recordset.length).toBe(1);
      expect(remainingSpan.recordset[0].name).toBe('Newer created');
    } finally {
      await cleanupSchema(testSchema);
    }
  });
});

/**
 * MSSQL-specific tests that verify init() throws MastraError when
 * migration is required (duplicates exist without unique constraint).
 * This ensures users are forced to run manual migration before the app can start.
 */
describe('MSSQL Migration Required Error', () => {
  const testSchema = `mig_err_${Date.now()}`;
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
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
      console.warn('MSSQL migration error test cleanup failed:', error);
    }
  });

  /**
   * Helper to create the spans table with OLD schema (no PK constraint)
   */
  async function createOldSpansTable(schema: string): Promise<void> {
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
      CREATE TABLE [${schema}].[${TABLE_SPANS}] (
        ${oldColumns}
      )
    `);
  }

  /**
   * Helper to insert a span
   */
  async function insertSpan(
    schema: string,
    span: {
      traceId: string;
      spanId: string;
      name: string;
      endedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ): Promise<void> {
    await pool.request().query(`
      INSERT INTO [${schema}].[${TABLE_SPANS}]
      ([traceId], [spanId], [parentSpanId], [name], [spanType], [isEvent], [startedAt], [endedAt], [createdAt], [updatedAt])
      VALUES (
        '${span.traceId}',
        '${span.spanId}',
        NULL,
        '${span.name}',
        'agent_run',
        0,
        '2024-01-01T00:00:00.000Z',
        ${span.endedAt ? `'${span.endedAt.toISOString()}'` : 'NULL'},
        '${span.createdAt.toISOString()}',
        '${span.updatedAt.toISOString()}'
      )
    `);
  }

  /**
   * Helper to clean up test schema
   */
  async function cleanupSchema(schema: string): Promise<void> {
    try {
      const tables = await pool
        .request()
        .query(
          `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${schema}' AND TABLE_TYPE = 'BASE TABLE'`,
        );

      for (const row of tables.recordset) {
        await pool.request().query(`DROP TABLE IF EXISTS [${schema}].[${row.TABLE_NAME}]`);
      }
    } catch {}
  }

  it('should throw MastraError when init() finds duplicate spans without unique constraint', async () => {
    const subSchema = `${testSchema}_throw`;

    try {
      // Setup: Create schema and table with old schema (no PK)
      try {
        await pool.request().query(`DROP SCHEMA IF EXISTS ${subSchema}`);
      } catch {}
      await pool.request().query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(subSchema);

      // Insert duplicate spans (same traceId + spanId)
      await insertSpan(subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'First duplicate',
        endedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      await insertSpan(subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1', // Same spanId - creates a duplicate
        name: 'Second duplicate',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Verify duplicates exist
      const count = await pool
        .request()
        .query(`SELECT COUNT(*) as count FROM [${subSchema}].[${TABLE_SPANS}] WHERE traceId = 'trace-1' AND spanId = 'span-1'`);
      expect(Number(count.recordset[0].count)).toBe(2);

      // Create store and try to init - should throw MastraError
      const store = new MssqlStore({
        id: 'throw-test-store',
        server: (TEST_CONFIG as any).server,
        port: (TEST_CONFIG as any).port,
        database: (TEST_CONFIG as any).database,
        user: (TEST_CONFIG as any).user,
        password: (TEST_CONFIG as any).password,
        schemaName: subSchema,
      });

      // init() should throw MastraError
      await expect(store.init()).rejects.toThrow(MastraError);

      // Verify error has correct ID
      try {
        await store.init();
      } catch (error: any) {
        expect(error).toBeInstanceOf(MastraError);
        expect(error.id).toContain('MIGRATION_REQUIRED');
        expect(error.id).toContain('DUPLICATE_SPANS');
      }

      await store.close();
    } finally {
      await cleanupSchema(subSchema);
      try {
        await pool.request().query(`DROP SCHEMA IF EXISTS ${subSchema}`);
      } catch {}
    }
  });

  it('should NOT throw when no duplicates exist (auto-migration succeeds)', async () => {
    const subSchema = `${testSchema}_auto`;

    try {
      // Setup: Create schema and table with old schema (no PK)
      try {
        await pool.request().query(`DROP SCHEMA IF EXISTS ${subSchema}`);
      } catch {}
      await pool.request().query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(subSchema);

      // Insert unique spans (no duplicates)
      await insertSpan(subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Unique span 1',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      await insertSpan(subSchema, {
        traceId: 'trace-1',
        spanId: 'span-2', // Different spanId - unique
        name: 'Unique span 2',
        endedAt: new Date('2024-01-01T00:00:02Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Create store and init - should NOT throw (auto-migration succeeds)
      const store = new MssqlStore({
        id: 'auto-migrate-test-store',
        server: (TEST_CONFIG as any).server,
        port: (TEST_CONFIG as any).port,
        database: (TEST_CONFIG as any).database,
        user: (TEST_CONFIG as any).user,
        password: (TEST_CONFIG as any).password,
        schemaName: subSchema,
      });

      await expect(store.init()).resolves.not.toThrow();

      // Verify PK constraint was added
      const pkExists = await pool.request().query(`
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('[${subSchema}].[${TABLE_SPANS}]')
        AND is_primary_key = 1
      `);
      expect(pkExists.recordset.length).toBe(1);

      await store.close();
    } finally {
      await cleanupSchema(subSchema);
      try {
        await pool.request().query(`DROP SCHEMA IF EXISTS ${subSchema}`);
      } catch {}
    }
  });

  it('should NOT throw when constraint already exists (fresh install)', async () => {
    const subSchema = `${testSchema}_fresh`;

    try {
      // Setup: Create schema (table will be created by init with constraint)
      try {
        await pool.request().query(`DROP SCHEMA IF EXISTS ${subSchema}`);
      } catch {}
      await pool.request().query(`CREATE SCHEMA ${subSchema}`);

      // Create store and init - should create table with constraint (fresh install)
      const store = new MssqlStore({
        id: 'fresh-install-test-store',
        server: (TEST_CONFIG as any).server,
        port: (TEST_CONFIG as any).port,
        database: (TEST_CONFIG as any).database,
        user: (TEST_CONFIG as any).user,
        password: (TEST_CONFIG as any).password,
        schemaName: subSchema,
      });

      await expect(store.init()).resolves.not.toThrow();

      // Verify PK constraint exists
      const pkExists = await pool.request().query(`
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('[${subSchema}].[${TABLE_SPANS}]')
        AND is_primary_key = 1
      `);
      expect(pkExists.recordset.length).toBe(1);

      await store.close();
    } finally {
      await cleanupSchema(subSchema);
      try {
        await pool.request().query(`DROP SCHEMA IF EXISTS ${subSchema}`);
      } catch {}
    }
  });
});
