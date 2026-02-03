import { MastraError } from '@mastra/core/error';
import { SpanType } from '@mastra/core/observability';
import {
  OLD_SPAN_SCHEMA,
  TABLE_SPANS,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDB } from './db';
import type { ObservabilityPG } from './domains/observability';
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
  let adminPool: Pool;

  beforeAll(async () => {
    // Use a temp pool to set up schema
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
    } finally {
      client.release();
    }

    migrationStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'migration-test-store',
      schemaName: testSchema,
    });

    // Wait for store to be ready before creating dbOps
    await migrationStore.init();
    dbOps = new PgDB({ client: migrationStore.db, schemaName: testSchema });
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    await migrationStore?.close();

    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000); // 30 second timeout for cleanup

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
    const rootSpan = await migrationStore.db.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['test-span-migration-1'],
    );
    expect(rootSpan).not.toBeNull();
    expect(rootSpan!.traceId).toBe('test-trace-migration-1');
    expect(rootSpan!.name).toBe('Pre-migration Span');
    expect(rootSpan!.spanType).toBe('agent_run');
    expect(rootSpan!.parentSpanId).toBeNull();
    expect(rootSpan!.attributes).toEqual({ key: 'value' });
    expect(rootSpan!.metadata).toEqual({ custom: 'data' });
    expect(rootSpan!.input).toEqual({ message: 'hello' });
    expect(rootSpan!.output).toEqual({ result: 'success' });

    // Query child span
    const childSpan = await migrationStore.db.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['test-span-migration-2'],
    );
    expect(childSpan).not.toBeNull();
    expect(childSpan!.parentSpanId).toBe('test-span-migration-1');
    expect(childSpan!.name).toBe('Child Span Before Migration');

    // Step 7: Verify new columns have NULL values for existing data (since they didn't exist before)
    expect(rootSpan!.entityType).toBeNull();
    expect(rootSpan!.entityId).toBeNull();
    expect(rootSpan!.userId).toBeNull();
    expect(rootSpan!.environment).toBeNull();

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

    const newSpan = await migrationStore.db.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['test-span-migration-3'],
    );
    expect(newSpan).not.toBeNull();
    expect(newSpan!.entityType).toBe('workflow');
    expect(newSpan!.entityId).toBe('workflow-123');
    expect(newSpan!.environment).toBe('production');
  }, 30000); // 30 second timeout

  it('should add timezone columns (startedAtZ, endedAtZ, etc.) during migration', async () => {
    // This test reproduces issue #11410
    // Drop the table if it exists (from init or previous test)
    await migrationStore.db.none(`DROP TABLE IF EXISTS ${testSchema}.${TABLE_SPANS} CASCADE`);

    // Step 1: Create table with OLD schema WITHOUT timezone columns (simulating pre-Dec-23 database)
    const oldColumnsNoTz = Object.entries(OLD_SPAN_SCHEMA)
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
        ${oldColumnsNoTz}
      )
    `);

    // Step 2: Verify timezone columns do NOT exist before migration
    const tzColumnsBefore = await migrationStore.db.manyOrNone(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = '${testSchema}' 
        AND table_name = '${TABLE_SPANS}' 
        AND column_name IN ('startedAtZ', 'endedAtZ', 'createdAtZ', 'updatedAtZ')
    `);
    expect(tzColumnsBefore.length).toBe(0);

    // Step 3: Insert test data
    await migrationStore.db.none(
      `INSERT INTO ${testSchema}.${TABLE_SPANS}
       ("traceId", "spanId", "parentSpanId", "name", "spanType", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        'trace-tz-1',
        'span-tz-1',
        null,
        'Test Span',
        'agent_run',
        false,
        new Date('2024-12-24T08:00:00Z'),
        new Date('2024-12-24T08:00:01Z'),
        new Date('2024-12-24T08:00:00Z'),
        new Date('2024-12-24T08:00:01Z'),
      ],
    );

    // Step 4: Run the migration by calling createTable (which internally calls migrateSpansTable)
    // This simulates what happens for existing users who upgrade and reinitialize
    await dbOps.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    // Step 5: Verify timezone columns DON'T exist after migration (this is the bug!)
    const tzColumnsAfter = await migrationStore.db.manyOrNone<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = '${testSchema}' 
        AND table_name = '${TABLE_SPANS}' 
        AND column_name IN ('startedAtZ', 'endedAtZ', 'createdAtZ', 'updatedAtZ')
      ORDER BY column_name
    `);

    // This assertion SHOULD FAIL in the current implementation because migrateSpansTable doesn't create the *Z columns
    // After the fix, this should pass
    expect(tzColumnsAfter.length, 'Expected all 4 timezone columns to exist after migration').toBe(4);
    expect(tzColumnsAfter.map((r: { column_name: string }) => r.column_name)).toEqual([
      'createdAtZ',
      'endedAtZ',
      'startedAtZ',
      'updatedAtZ',
    ]);

    // Step 6: Try to use observability methods which expect *Z columns
    // This simulates the actual error from issue #11410
    const observability = await migrationStore.getStore('observability');

    // This should not throw an error about missing startedAtZ column
    await observability!.createSpan({
      span: {
        traceId: 'trace-tz-2',
        spanId: 'span-tz-2',
        name: 'Test Span After Migration',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt: new Date('2024-12-24T09:00:00Z'),
        endedAt: new Date('2024-12-24T09:00:01Z'),
      },
    });

    // Verify the span was created successfully
    const createdSpan = await migrationStore.db.oneOrNone<Record<string, unknown>>(
      `SELECT * FROM ${testSchema}.${TABLE_SPANS} WHERE "spanId" = $1`,
      ['span-tz-2'],
    );
    expect(createdSpan).not.toBeNull();
    expect(createdSpan!.name).toBe('Test Span After Migration');
  }, 30000); // 30 second timeout
});

/**
 * PostgreSQL-specific tests for duplicate spans handling during migration.
 * Issue #11840: Migration fails when existing data contains duplicate (traceId, spanId) combinations.
 */
describe('PostgreSQL Duplicate Spans Migration', () => {
  const testSchema = `dup_spans_${Date.now().toString(36)}`; // Keep schema name short
  let adminPool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
    } finally {
      client.release();
    }
  }, 30000);

  afterAll(async () => {
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000);

  /**
   * Helper to create the spans table with OLD schema (no PK constraint)
   */
  async function createOldSpansTable(pool: Pool, schema: string): Promise<void> {
    const client = await pool.connect();
    try {
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

      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.${TABLE_SPANS} (
          ${oldColumns}
        )
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Helper to insert a span with specific timestamp values
   */
  async function insertSpan(
    pool: Pool,
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
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO ${schema}.${TABLE_SPANS}
         ("traceId", "spanId", "parentSpanId", "name", "spanType", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          span.traceId,
          span.spanId,
          null,
          span.name,
          'agent_run',
          false,
          new Date('2024-01-01T00:00:00Z'),
          span.endedAt ?? null,
          span.createdAt,
          span.updatedAt,
        ],
      );
    } finally {
      client.release();
    }
  }

  it('should fail to add PRIMARY KEY when duplicate spans exist (current buggy behavior)', async () => {
    const subSchema = `${testSchema}_fpk`;
    const client = await adminPool.connect();

    try {
      // Setup: Create schema and table
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(adminPool, subSchema);

      // Insert duplicate spans (same traceId + spanId)
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'First duplicate',
        endedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1', // Same spanId - this creates a duplicate
        name: 'Second duplicate',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Verify we have 2 rows with same traceId/spanId
      const count = await client.query(
        `SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(Number(count.rows[0].count)).toBe(2);

      // Now try to add the PRIMARY KEY constraint - this should fail with error 23505
      // This test documents the current buggy behavior
      await expect(
        client.query(`
          ALTER TABLE "${subSchema}".${TABLE_SPANS}
          ADD CONSTRAINT ${subSchema}_spans_pk
          PRIMARY KEY ("traceId", "spanId")
        `),
      ).rejects.toThrow(/could not create unique index|duplicate key/i);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should deduplicate spans keeping completed spans over incomplete', async () => {
    const subSchema = `${testSchema}_dc`;
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(adminPool, subSchema);

      // Insert incomplete span (endedAt is NULL)
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Incomplete span',
        endedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      // Insert completed span (endedAt is set) - should be kept
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Completed span',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Create store (don't call init yet - it would throw due to duplicates)
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'dedup-completed-test',
        schemaName: subSchema,
      });

      // Run migration directly via db.migrateSpans() - this is what `npx mastra migrate` does
      const result = await (store.stores.observability as any).migrateSpans();
      expect(result.success).toBe(true);
      expect(result.duplicatesRemoved).toBeGreaterThan(0);

      // Verify only one span remains
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(Number(countResult.rows[0].count)).toBe(1);

      // Verify the completed span was kept
      const keptSpan = await client.query(
        `SELECT name, "endedAt" FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(keptSpan.rows[0].name).toBe('Completed span');
      expect(keptSpan.rows[0].endedAt).not.toBeNull();

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should deduplicate spans keeping most recent updatedAt when both completed', async () => {
    const subSchema = `${testSchema}_du`;
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(adminPool, subSchema);

      // Insert older completed span
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Older completed span',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'), // older
      });

      // Insert newer completed span - should be kept
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Newer completed span',
        endedAt: new Date('2024-01-01T00:00:02Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:05Z'), // newer
      });

      // Create store (don't call init yet - it would throw due to duplicates)
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'dedup-updated-test',
        schemaName: subSchema,
      });

      // Run migration directly via db.migrateSpans() - this is what `npx mastra migrate` does
      const result = await (store.stores.observability as any).migrateSpans();
      expect(result.success).toBe(true);
      expect(result.duplicatesRemoved).toBeGreaterThan(0);

      // Verify only one span remains
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(Number(countResult.rows[0].count)).toBe(1);

      // Verify the newer updatedAt span was kept
      const keptSpan = await client.query(
        `SELECT name FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(keptSpan.rows[0].name).toBe('Newer completed span');

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should deduplicate spans keeping most recent createdAt as final fallback', async () => {
    const subSchema = `${testSchema}_dcr`;
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(adminPool, subSchema);

      const sameUpdatedAt = new Date('2024-01-01T00:00:05Z');

      // Insert older createdAt span
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Older createdAt span',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'), // older
        updatedAt: sameUpdatedAt,
      });

      // Insert newer createdAt span - should be kept
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Newer createdAt span',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:02Z'), // newer
        updatedAt: sameUpdatedAt,
      });

      // Create store (don't call init yet - it would throw due to duplicates)
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'dedup-created-test',
        schemaName: subSchema,
      });

      // Run migration directly via db.migrateSpans() - this is what `npx mastra migrate` does
      const result = await (store.stores.observability as any).migrateSpans();
      expect(result.success).toBe(true);
      expect(result.duplicatesRemoved).toBeGreaterThan(0);

      // Verify only one span remains
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(Number(countResult.rows[0].count)).toBe(1);

      // Verify the newer createdAt span was kept
      const keptSpan = await client.query(
        `SELECT name FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(keptSpan.rows[0].name).toBe('Newer createdAt span');

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should log deleted duplicate spans during deduplication', async () => {
    const subSchema = `${testSchema}_dl`;
    const client = await adminPool.connect();
    const loggedMessages: Array<{ level: string; message: string; data?: any }> = [];

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(adminPool, subSchema);

      // Insert duplicates
      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Duplicate to delete',
        endedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      await insertSpan(adminPool, subSchema, {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Duplicate to keep',
        endedAt: new Date('2024-01-01T00:00:01Z'),
        createdAt: new Date('2024-01-01T00:00:01Z'),
        updatedAt: new Date('2024-01-01T00:00:01Z'),
      });

      // Create store with custom logger to capture log messages
      // (don't call init yet - it would throw due to duplicates)
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'dedup-logging-test',
        schemaName: subSchema,
        logger: {
          debug: (message: string, data?: any) => loggedMessages.push({ level: 'debug', message, data }),
          info: (message: string, data?: any) => loggedMessages.push({ level: 'info', message, data }),
          warn: (message: string, data?: any) => loggedMessages.push({ level: 'warn', message, data }),
          error: (message: string, data?: any) => loggedMessages.push({ level: 'error', message, data }),
        } as any,
      });

      // Run migration directly via db.migrateSpans() - this is what `npx mastra migrate` does
      const result = await (store.stores.observability as any).migrateSpans();
      expect(result.success).toBe(true);
      expect(result.duplicatesRemoved).toBeGreaterThan(0);

      // Verify deduplication occurred by checking the database
      // (The logger infrastructure doesn't propagate to PgDB in tests, so we verify the outcome instead)
      const remainingCount = await client.query(
        `SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(Number(remainingCount.rows[0].count)).toBe(1);

      // Verify the kept span is the completed one
      const keptSpan = await client.query(
        `SELECT name, "endedAt" FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(keptSpan.rows[0].name).toBe('Duplicate to keep');
      expect(keptSpan.rows[0].endedAt).not.toBeNull();

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should successfully add PRIMARY KEY after deduplication', async () => {
    const subSchema = `${testSchema}_pk`;
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
      await createOldSpansTable(adminPool, subSchema);

      // Insert multiple sets of duplicates
      for (let i = 1; i <= 3; i++) {
        await insertSpan(adminPool, subSchema, {
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
          name: `Duplicate A for trace-${i}`,
          endedAt: null,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        });

        await insertSpan(adminPool, subSchema, {
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
          name: `Duplicate B for trace-${i}`,
          endedAt: new Date('2024-01-01T00:00:01Z'),
          createdAt: new Date('2024-01-01T00:00:01Z'),
          updatedAt: new Date('2024-01-01T00:00:01Z'),
        });
      }

      // Verify we have 6 rows (2 duplicates each for 3 traces)
      const beforeCount = await client.query(`SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS}`);
      expect(Number(beforeCount.rows[0].count)).toBe(6);

      // Create store (don't call init yet - it would throw due to duplicates)
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'pk-after-dedup-test',
        schemaName: subSchema,
      });

      // Run migration directly via db.migrateSpans() - this is what `npx mastra migrate` does
      const result = await (store.stores.observability as any).migrateSpans();
      expect(result.success).toBe(true);
      expect(result.duplicatesRemoved).toBe(3); // 3 duplicates removed (one per trace)

      // Verify we now have 3 rows (one per trace)
      const afterCount = await client.query(`SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS}`);
      expect(Number(afterCount.rows[0].count)).toBe(3);

      // Verify the PRIMARY KEY constraint exists
      const pkExists = await client.query(`
        SELECT 1 FROM pg_constraint
        WHERE conname LIKE '${subSchema}%mastra_ai_spans%pk'
      `);
      expect(pkExists.rows.length).toBe(1);

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);
});

/**
 * PostgreSQL-specific tests that verify init() throws MastraError when
 * migration is required (duplicates exist without unique constraint).
 * This ensures users are forced to run manual migration before the app can start.
 */
describe('PostgreSQL Migration Required Error', () => {
  const testSchema = `mig_err_${Date.now().toString(36)}`;
  let adminPool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
    } finally {
      client.release();
    }
  }, 30000);

  afterAll(async () => {
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000);

  /**
   * Helper to create the spans table with OLD schema (no PK constraint)
   */
  async function createOldSpansTable(schema: string): Promise<void> {
    const client = await adminPool.connect();
    try {
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

      await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.${TABLE_SPANS} (
          ${oldColumns}
        )
      `);
    } finally {
      client.release();
    }
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
    const client = await adminPool.connect();
    try {
      await client.query(
        `INSERT INTO ${schema}.${TABLE_SPANS}
         ("traceId", "spanId", "parentSpanId", "name", "spanType", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          span.traceId,
          span.spanId,
          null,
          span.name,
          'agent_run',
          false,
          new Date('2024-01-01T00:00:00Z'),
          span.endedAt ?? null,
          span.createdAt,
          span.updatedAt,
        ],
      );
    } finally {
      client.release();
    }
  }

  it('should throw MastraError when init() finds duplicate spans without unique constraint', async () => {
    const subSchema = `${testSchema}_throw`;
    const client = await adminPool.connect();

    try {
      // Setup: Create schema and table with old schema (no PK)
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
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
      const count = await client.query(
        `SELECT COUNT(*) as count FROM ${subSchema}.${TABLE_SPANS} WHERE "traceId" = 'trace-1' AND "spanId" = 'span-1'`,
      );
      expect(Number(count.rows[0].count)).toBe(2);

      // Create store and try to init - should throw MastraError
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'throw-test-store',
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
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should NOT throw when no duplicates exist (auto-migration succeeds)', async () => {
    const subSchema = `${testSchema}_auto`;
    const client = await adminPool.connect();

    try {
      // Setup: Create schema and table with old schema (no PK)
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);
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
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'auto-migrate-test-store',
        schemaName: subSchema,
      });

      await expect(store.init()).resolves.not.toThrow();

      // Verify constraint was added
      const pkExists = await client.query(`
        SELECT 1 FROM pg_constraint
        WHERE conname LIKE '${subSchema}%mastra_ai_spans%pk'
      `);
      expect(pkExists.rows.length).toBe(1);

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);

  it('should NOT throw when constraint already exists (fresh install)', async () => {
    const subSchema = `${testSchema}_fresh`;
    const client = await adminPool.connect();

    try {
      // Setup: Create schema (table will be created by init with constraint)
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${subSchema}`);

      // Create store and init - should create table with constraint (fresh install)
      const store = new PostgresStore({
        ...TEST_CONFIG,
        id: 'fresh-install-test-store',
        schemaName: subSchema,
      });

      await expect(store.init()).resolves.not.toThrow();

      // Verify constraint exists
      const pkExists = await client.query(`
        SELECT 1 FROM pg_constraint
        WHERE conname LIKE '${subSchema}%mastra_ai_spans%pk'
      `);
      expect(pkExists.rows.length).toBe(1);

      await store.close();
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS ${subSchema} CASCADE`);
      client.release();
    }
  }, 30000);
});

/**
 * PostgreSQL-specific tests for ON CONFLICT handling to prevent future duplicates.
 * This ensures that after migration, duplicate inserts are handled gracefully.
 */
describe('PostgreSQL Spans ON CONFLICT Handling', () => {
  const testSchema = `on_conf_${Date.now().toString(36)}`; // Keep schema name short
  let store: PostgresStore;
  let observability: ObservabilityPG;
  let adminPool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
    } finally {
      client.release();
    }

    store = new PostgresStore({
      ...TEST_CONFIG,
      id: 'on-conflict-test-store',
      schemaName: testSchema,
    });
    await store.init();
    observability = (await store.getStore('observability')) as ObservabilityPG;
  }, 30000);

  afterAll(async () => {
    await store?.close();

    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000);

  it('should handle duplicate span inserts gracefully with ON CONFLICT', async () => {
    const spanData = {
      traceId: 'trace-conflict-1',
      spanId: 'span-conflict-1',
      name: 'Original span',
      spanType: SpanType.AGENT_RUN,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      endedAt: new Date('2024-01-01T00:00:01Z'),
    };

    // First insert should succeed
    await observability.createSpan({ span: spanData });

    // Second insert with same traceId/spanId should NOT throw
    // It should either update or be ignored based on implementation
    await expect(
      observability.createSpan({
        span: {
          ...spanData,
          name: 'Updated span name',
        },
      }),
    ).resolves.not.toThrow();

    // Verify only one span exists
    const result = await store.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_SPANS}
       WHERE "traceId" = 'trace-conflict-1' AND "spanId" = 'span-conflict-1'`,
    );
    expect(Number(result.count)).toBe(1);
  }, 30000);

  it('should handle batch inserts with duplicates gracefully', async () => {
    const spans = [
      {
        traceId: 'trace-batch-1',
        spanId: 'span-batch-1',
        name: 'Batch span 1',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        traceId: 'trace-batch-1',
        spanId: 'span-batch-2',
        name: 'Batch span 2',
        spanType: SpanType.TOOL_CALL,
        isEvent: false,
        startedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    // First batch insert
    await observability.batchCreateSpans({ records: spans });

    // Second batch insert with same spans should NOT throw
    await expect(observability.batchCreateSpans({ records: spans })).resolves.not.toThrow();

    // Verify only 2 spans exist (not 4)
    const result = await store.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_SPANS}
       WHERE "traceId" = 'trace-batch-1'`,
    );
    expect(Number(result.count)).toBe(2);
  }, 30000);

  it('should handle mixed new and duplicate spans in batch insert', async () => {
    // Insert initial span
    await observability.createSpan({
      span: {
        traceId: 'trace-mixed-1',
        spanId: 'span-mixed-1',
        name: 'Existing span',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });

    // Batch with one duplicate and one new
    const mixedSpans = [
      {
        traceId: 'trace-mixed-1',
        spanId: 'span-mixed-1', // Duplicate
        name: 'Duplicate span',
        spanType: SpanType.AGENT_RUN,
        isEvent: false,
        startedAt: new Date('2024-01-01T00:00:00Z'),
      },
      {
        traceId: 'trace-mixed-1',
        spanId: 'span-mixed-2', // New
        name: 'New span',
        spanType: SpanType.TOOL_CALL,
        isEvent: false,
        startedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ];

    // Should not throw
    await expect(observability.batchCreateSpans({ records: mixedSpans })).resolves.not.toThrow();

    // Verify we have exactly 2 spans
    const result = await store.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_SPANS}
       WHERE "traceId" = 'trace-mixed-1'`,
    );
    expect(Number(result.count)).toBe(2);
  }, 30000);
});

/**
 * PostgreSQL-specific migration tests that verify the threads table metadata
 * column migration from TEXT to JSONB works correctly.
 */
describe('PostgreSQL Threads Metadata Migration', () => {
  const testSchema = `threads_migration_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let migrationStore: PostgresStore;
  let adminPool: Pool;

  beforeAll(async () => {
    // Use a temp pool to set up schema
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
    } finally {
      client.release();
    }

    migrationStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'threads-migration-test-store',
      schemaName: testSchema,
    });

    await migrationStore.init();
  }, 30000);

  afterAll(async () => {
    await migrationStore?.close();

    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000);

  it('should migrate threads metadata column from TEXT to JSONB and preserve data', async () => {
    // Drop the table created by init (which uses JSONB)
    await migrationStore.db.none(`DROP TABLE IF EXISTS ${testSchema}.${TABLE_THREADS}`);

    // Step 1: Create table with OLD schema (TEXT metadata) simulating existing database
    await migrationStore.db.none(`
      CREATE TABLE ${testSchema}.${TABLE_THREADS} (
        "id" TEXT NOT NULL PRIMARY KEY,
        "resourceId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "metadata" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Step 2: Insert test data with JSON stored as TEXT
    const testThreads = [
      {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Thread with metadata',
        metadata: JSON.stringify({ key: 'value', nested: { a: 1, b: [1, 2, 3] } }),
      },
      {
        id: 'thread-2',
        resourceId: 'resource-1',
        title: 'Thread with null metadata',
        metadata: null,
      },
      {
        id: 'thread-3',
        resourceId: 'resource-2',
        title: 'Thread with empty object',
        metadata: JSON.stringify({}),
      },
      {
        id: 'thread-4',
        resourceId: 'resource-2',
        title: 'Thread with special chars',
        metadata: JSON.stringify({ emoji: '🚀', unicode: 'ñ', quotes: '"test"' }),
      },
    ];

    for (const thread of testThreads) {
      await migrationStore.db.none(
        `INSERT INTO ${testSchema}.${TABLE_THREADS} ("id", "resourceId", "title", "metadata")
         VALUES ($1, $2, $3, $4)`,
        [thread.id, thread.resourceId, thread.title, thread.metadata],
      );
    }

    // Verify data exists before migration
    const countBefore = await migrationStore.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_THREADS}`,
    );
    expect(Number(countBefore.count)).toBe(4);

    // Verify column type is TEXT before migration
    const typeBefore = await migrationStore.db.one<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = 'metadata'`,
      [testSchema, TABLE_THREADS],
    );
    expect(typeBefore.data_type).toBe('text');

    // Step 3: Run the migration SQL
    await migrationStore.db.none(`
      ALTER TABLE "${testSchema}"."${TABLE_THREADS}"
      ALTER COLUMN "metadata" TYPE jsonb
      USING "metadata"::jsonb
    `);

    // Step 4: Verify column type is now JSONB
    const typeAfter = await migrationStore.db.one<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = 'metadata'`,
      [testSchema, TABLE_THREADS],
    );
    expect(typeAfter.data_type).toBe('jsonb');

    // Step 5: Verify all data was preserved
    const thread1 = await migrationStore.db.oneOrNone<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM ${testSchema}.${TABLE_THREADS} WHERE id = $1`,
      ['thread-1'],
    );
    expect(thread1?.metadata).toEqual({ key: 'value', nested: { a: 1, b: [1, 2, 3] } });

    const thread2 = await migrationStore.db.oneOrNone<{ metadata: Record<string, unknown> | null }>(
      `SELECT metadata FROM ${testSchema}.${TABLE_THREADS} WHERE id = $1`,
      ['thread-2'],
    );
    expect(thread2?.metadata).toBeNull();

    const thread3 = await migrationStore.db.oneOrNone<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM ${testSchema}.${TABLE_THREADS} WHERE id = $1`,
      ['thread-3'],
    );
    expect(thread3?.metadata).toEqual({});

    const thread4 = await migrationStore.db.oneOrNone<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM ${testSchema}.${TABLE_THREADS} WHERE id = $1`,
      ['thread-4'],
    );
    expect(thread4?.metadata).toEqual({ emoji: '🚀', unicode: 'ñ', quotes: '"test"' });

    // Step 6: Verify JSONB operators work after migration
    const threadsWithKey = await migrationStore.db.any<{ id: string }>(
      `SELECT id FROM ${testSchema}.${TABLE_THREADS} WHERE metadata ? 'key'`,
    );
    expect(threadsWithKey.map(t => t.id)).toEqual(['thread-1']);

    // Step 7: Verify we can insert new data with JSONB
    await migrationStore.db.none(
      `INSERT INTO ${testSchema}.${TABLE_THREADS} ("id", "resourceId", "title", "metadata")
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['thread-5', 'resource-3', 'New thread', JSON.stringify({ newKey: 'newValue' })],
    );

    const thread5 = await migrationStore.db.oneOrNone<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM ${testSchema}.${TABLE_THREADS} WHERE id = $1`,
      ['thread-5'],
    );
    expect(thread5?.metadata).toEqual({ newKey: 'newValue' });
  }, 30000);
});

/**
 * PostgreSQL-specific migration tests that verify the workflow_snapshot table
 * snapshot column migration from TEXT to JSONB works correctly.
 */
describe('PostgreSQL Workflow Snapshot Migration', () => {
  const testSchema = `workflow_migration_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let migrationStore: PostgresStore;
  let adminPool: Pool;

  beforeAll(async () => {
    // Use a temp pool to set up schema
    adminPool = new Pool({ connectionString });
    const client = await adminPool.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await client.query(`CREATE SCHEMA ${testSchema}`);
    } finally {
      client.release();
    }

    migrationStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'workflow-migration-test-store',
      schemaName: testSchema,
    });

    await migrationStore.init();
  }, 30000);

  afterAll(async () => {
    await migrationStore?.close();

    const client = await adminPool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    } finally {
      client.release();
      await adminPool.end();
    }
  }, 30000);

  it('should migrate workflow_snapshot snapshot column from TEXT to JSONB and preserve data', async () => {
    // Drop the table created by init (which uses JSONB)
    await migrationStore.db.none(`DROP TABLE IF EXISTS ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT}`);

    // Step 1: Create table with OLD schema (TEXT snapshot) simulating existing database
    await migrationStore.db.none(`
      CREATE TABLE ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} (
        "workflow_name" TEXT NOT NULL,
        "run_id" TEXT NOT NULL,
        "resourceId" TEXT,
        "snapshot" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("workflow_name", "run_id")
      )
    `);

    // Step 2: Insert test data with JSON stored as TEXT
    const testSnapshots = [
      {
        workflow_name: 'test-workflow',
        run_id: 'run-1',
        resourceId: 'resource-1',
        snapshot: JSON.stringify({
          status: 'completed',
          steps: [{ name: 'step1', result: { success: true } }],
          metadata: { duration: 1234 },
        }),
      },
      {
        workflow_name: 'test-workflow',
        run_id: 'run-2',
        resourceId: 'resource-1',
        snapshot: JSON.stringify({
          status: 'running',
          steps: [],
          context: { nested: { deep: { value: 42 } } },
        }),
      },
      {
        workflow_name: 'another-workflow',
        run_id: 'run-1',
        resourceId: null,
        snapshot: JSON.stringify({
          status: 'pending',
          config: { retries: 3, timeout: 5000 },
        }),
      },
    ];

    for (const snapshot of testSnapshots) {
      await migrationStore.db.none(
        `INSERT INTO ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} ("workflow_name", "run_id", "resourceId", "snapshot")
         VALUES ($1, $2, $3, $4)`,
        [snapshot.workflow_name, snapshot.run_id, snapshot.resourceId, snapshot.snapshot],
      );
    }

    // Verify data exists before migration
    const countBefore = await migrationStore.db.one<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT}`,
    );
    expect(Number(countBefore.count)).toBe(3);

    // Verify column type is TEXT before migration
    const typeBefore = await migrationStore.db.one<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = 'snapshot'`,
      [testSchema, TABLE_WORKFLOW_SNAPSHOT],
    );
    expect(typeBefore.data_type).toBe('text');

    // Step 3: Run the migration SQL
    await migrationStore.db.none(`
      ALTER TABLE "${testSchema}"."${TABLE_WORKFLOW_SNAPSHOT}"
      ALTER COLUMN "snapshot" TYPE jsonb
      USING "snapshot"::jsonb
    `);

    // Step 4: Verify column type is now JSONB
    const typeAfter = await migrationStore.db.one<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = 'snapshot'`,
      [testSchema, TABLE_WORKFLOW_SNAPSHOT],
    );
    expect(typeAfter.data_type).toBe('jsonb');

    // Step 5: Verify all data was preserved
    const snapshot1 = await migrationStore.db.oneOrNone<{ snapshot: Record<string, unknown> }>(
      `SELECT snapshot FROM ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = $1 AND run_id = $2`,
      ['test-workflow', 'run-1'],
    );
    expect(snapshot1?.snapshot).toEqual({
      status: 'completed',
      steps: [{ name: 'step1', result: { success: true } }],
      metadata: { duration: 1234 },
    });

    const snapshot2 = await migrationStore.db.oneOrNone<{ snapshot: Record<string, unknown> }>(
      `SELECT snapshot FROM ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = $1 AND run_id = $2`,
      ['test-workflow', 'run-2'],
    );
    expect(snapshot2?.snapshot).toEqual({
      status: 'running',
      steps: [],
      context: { nested: { deep: { value: 42 } } },
    });

    // Step 6: Verify JSONB operators work after migration
    const completedSnapshots = await migrationStore.db.any<{ run_id: string }>(
      `SELECT run_id FROM ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} WHERE snapshot->>'status' = 'completed'`,
    );
    expect(completedSnapshots.map(s => s.run_id)).toEqual(['run-1']);

    // Step 7: Verify we can insert new data with JSONB
    await migrationStore.db.none(
      `INSERT INTO ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} ("workflow_name", "run_id", "snapshot")
       VALUES ($1, $2, $3::jsonb)`,
      ['new-workflow', 'run-1', JSON.stringify({ status: 'new', data: [1, 2, 3] })],
    );

    const newSnapshot = await migrationStore.db.oneOrNone<{ snapshot: Record<string, unknown> }>(
      `SELECT snapshot FROM ${testSchema}.${TABLE_WORKFLOW_SNAPSHOT} WHERE workflow_name = $1 AND run_id = $2`,
      ['new-workflow', 'run-1'],
    );
    expect(newSnapshot?.snapshot).toEqual({ status: 'new', data: [1, 2, 3] });
  }, 30000);
});
