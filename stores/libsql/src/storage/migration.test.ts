import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import {
  OLD_SPAN_SCHEMA,
  TABLE_SPANS,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LibSQLDB } from './db';
import { LibSQLStore } from './index';

/**
 * LibSQL-specific migration tests that verify the spans table migration
 * from OLD_SPAN_SCHEMA to the current SPAN_SCHEMA works correctly.
 */
describe('LibSQL Spans Table Migration', () => {
  // Use in-memory database for cleaner test isolation
  const testDbPath = ':memory:';
  let client: Client;
  let dbOps: LibSQLDB;

  beforeAll(async () => {
    // Create a fresh client for migration testing
    client = createClient({ url: testDbPath });

    // Access the internal DB layer for raw SQL operations
    dbOps = new LibSQLDB({
      client,
      maxRetries: 5,
      initialBackoffMs: 100,
    });
  });

  beforeEach(async () => {
    // Drop the table before each test to ensure fresh state
    await client.execute(`DROP TABLE IF EXISTS "${TABLE_SPANS}"`);
  });

  afterAll(async () => {
    // Clean up
    try {
      await client.execute(`DROP TABLE IF EXISTS "${TABLE_SPANS}"`);
    } catch {}
  });

  it('should migrate old spans table schema to new schema with additional columns and preserve data', async () => {
    // Step 1: Create table with OLD schema (simulating existing database)
    const oldColumns = Object.entries(OLD_SPAN_SCHEMA)
      .map(([colName, colDef]) => {
        const sqlType =
          colDef.type === 'text'
            ? 'TEXT'
            : colDef.type === 'jsonb'
              ? 'TEXT' // SQLite stores JSON as TEXT
              : colDef.type === 'timestamp'
                ? 'TEXT' // SQLite stores timestamps as TEXT
                : colDef.type === 'boolean'
                  ? 'INTEGER' // SQLite stores boolean as INTEGER
                  : 'TEXT';
        const nullable = colDef.nullable === false ? 'NOT NULL' : '';
        return `"${colName}" ${sqlType} ${nullable}`.trim();
      })
      .join(', ');

    await client.execute(`CREATE TABLE IF NOT EXISTS "${TABLE_SPANS}" (${oldColumns})`);

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
      isEvent: 0, // SQLite uses 0/1 for boolean
      startedAt: '2024-01-01T00:00:00.000Z',
      endedAt: '2024-01-01T00:00:01.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:01.000Z',
    };

    await client.execute({
      sql: `INSERT INTO "${TABLE_SPANS}"
            ("traceId", "spanId", "parentSpanId", "name", "spanType", "scope", "attributes", "metadata", "links", "input", "output", "error", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
    });

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
      isEvent: 0,
      startedAt: '2024-01-01T00:00:00.500Z',
      endedAt: '2024-01-01T00:00:00.800Z',
      createdAt: '2024-01-01T00:00:00.500Z',
      updatedAt: '2024-01-01T00:00:00.800Z',
    };

    await client.execute({
      sql: `INSERT INTO "${TABLE_SPANS}"
            ("traceId", "spanId", "parentSpanId", "name", "spanType", "scope", "attributes", "metadata", "links", "input", "output", "error", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
    });

    // Verify data exists before migration
    const countBefore = await client.execute(`SELECT COUNT(*) as count FROM "${TABLE_SPANS}"`);
    expect(Number(countBefore.rows[0]?.count)).toBe(2);

    // Verify old table structure - should NOT have new columns
    const tableInfoBefore = await client.execute(`PRAGMA table_info("${TABLE_SPANS}")`);
    const columnNamesBefore = tableInfoBefore.rows.map((row: any) => row.name);
    expect(columnNamesBefore).not.toContain('entityType');
    expect(columnNamesBefore).not.toContain('entityId');
    expect(columnNamesBefore).not.toContain('userId');

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

    const tableInfoAfter = await client.execute(`PRAGMA table_info("${TABLE_SPANS}")`);
    const columnNamesAfter = tableInfoAfter.rows.map((row: any) => row.name);

    for (const columnName of newColumns) {
      expect(columnNamesAfter, `Expected column '${columnName}' to exist after migration`).toContain(columnName);
    }

    // Step 5: Verify original columns still exist
    const originalColumns = ['traceId', 'spanId', 'parentSpanId', 'name', 'spanType', 'attributes', 'metadata'];
    for (const columnName of originalColumns) {
      expect(columnNamesAfter, `Expected original column '${columnName}' to still exist`).toContain(columnName);
    }

    // Step 6: Verify data is still queryable after migration
    const countAfter = await client.execute(`SELECT COUNT(*) as count FROM "${TABLE_SPANS}"`);
    expect(Number(countAfter.rows[0]?.count)).toBe(2);

    // Query the root span and verify all original data is preserved
    const rootSpanResult = await client.execute({
      sql: `SELECT * FROM "${TABLE_SPANS}" WHERE "spanId" = ?`,
      args: ['test-span-migration-1'],
    });
    const rootSpan = rootSpanResult.rows[0] as any;

    expect(rootSpan).not.toBeNull();
    expect(rootSpan.traceId).toBe('test-trace-migration-1');
    expect(rootSpan.name).toBe('Pre-migration Span');
    expect(rootSpan.spanType).toBe('agent_run');
    expect(rootSpan.parentSpanId).toBeNull();
    expect(JSON.parse(rootSpan.attributes)).toEqual({ key: 'value' });
    expect(JSON.parse(rootSpan.metadata)).toEqual({ custom: 'data' });
    expect(JSON.parse(rootSpan.input)).toEqual({ message: 'hello' });
    expect(JSON.parse(rootSpan.output)).toEqual({ result: 'success' });

    // Query child span
    const childSpanResult = await client.execute({
      sql: `SELECT * FROM "${TABLE_SPANS}" WHERE "spanId" = ?`,
      args: ['test-span-migration-2'],
    });
    const childSpan = childSpanResult.rows[0] as any;

    expect(childSpan).not.toBeNull();
    expect(childSpan.parentSpanId).toBe('test-span-migration-1');
    expect(childSpan.name).toBe('Child Span Before Migration');

    // Step 7: Verify new columns have NULL values for existing data (since they didn't exist before)
    expect(rootSpan.entityType).toBeNull();
    expect(rootSpan.entityId).toBeNull();
    expect(rootSpan.userId).toBeNull();
    expect(rootSpan.environment).toBeNull();

    // Step 8: Verify we can insert new data with the new columns
    await client.execute({
      sql: `INSERT INTO "${TABLE_SPANS}"
            ("traceId", "spanId", "parentSpanId", "name", "spanType", "isEvent", "startedAt", "createdAt", "entityType", "entityId", "environment")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'test-trace-migration-2',
        'test-span-migration-3',
        null,
        'Post-migration Span',
        'workflow_run',
        0,
        new Date().toISOString(),
        new Date().toISOString(),
        'workflow',
        'workflow-123',
        'production',
      ],
    });

    const newSpanResult = await client.execute({
      sql: `SELECT * FROM "${TABLE_SPANS}" WHERE "spanId" = ?`,
      args: ['test-span-migration-3'],
    });
    const newSpan = newSpanResult.rows[0] as any;

    expect(newSpan).not.toBeNull();
    expect(newSpan.entityType).toBe('workflow');
    expect(newSpan.entityId).toBe('workflow-123');
    expect(newSpan.environment).toBe('production');
  });

  it('should allow querying old data via storage API after migration', async () => {
    // Create old schema table using shared client
    const oldColumns = Object.entries(OLD_SPAN_SCHEMA)
      .map(([colName, colDef]) => {
        const sqlType =
          colDef.type === 'text'
            ? 'TEXT'
            : colDef.type === 'jsonb'
              ? 'TEXT'
              : colDef.type === 'timestamp'
                ? 'TEXT'
                : colDef.type === 'boolean'
                  ? 'INTEGER'
                  : 'TEXT';
        const nullable = colDef.nullable === false ? 'NOT NULL' : '';
        return `"${colName}" ${sqlType} ${nullable}`.trim();
      })
      .join(', ');

    await client.execute(`CREATE TABLE IF NOT EXISTS "${TABLE_SPANS}" (${oldColumns})`);

    // Insert old-format data
    await client.execute({
      sql: `INSERT INTO "${TABLE_SPANS}"
            ("traceId", "spanId", "parentSpanId", "name", "spanType", "scope", "attributes", "metadata", "links", "input", "output", "error", "isEvent", "startedAt", "endedAt", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'api-test-trace',
        'api-test-span',
        null,
        'API Test Span',
        'agent_run',
        null,
        JSON.stringify({ test: 'data' }),
        null,
        null,
        JSON.stringify({ input: 'value' }),
        JSON.stringify({ output: 'result' }),
        null,
        0,
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:01.000Z',
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:01.000Z',
      ],
    });

    // Create store and init, which should trigger migration
    const store = new LibSQLStore({
      id: 'libsql-api-test-store',
      client,
      disableInit: true,
    });
    await store.init();

    // Query via storage API - should work after migration
    const observabilityStore = await store.getStore('observability');
    expect(observabilityStore).toBeDefined();
    const trace = await observabilityStore?.getTrace({ traceId: 'api-test-trace' });
    expect(trace).not.toBeNull();
    expect(trace!.spans.length).toBe(1);
    expect(trace!.spans[0]!.spanId).toBe('api-test-span');
    expect(trace!.spans[0]!.name).toBe('API Test Span');
    expect(trace!.spans[0]!.input).toEqual({ input: 'value' });
    expect(trace!.spans[0]!.output).toEqual({ output: 'result' });

    // New columns should be null
    expect(trace!.spans[0]!.entityType).toBeNull();
    expect(trace!.spans[0]!.entityId).toBeNull();
  });
});

/**
 * JSONB backwards compatibility tests.
 * Verifies that existing TEXT JSON data works correctly after the JSONB changes.
 */
describe('LibSQL JSONB Backwards Compatibility', () => {
  const testDbPath = ':memory:';
  let client: Client;
  let dbOps: LibSQLDB;

  beforeAll(async () => {
    client = createClient({ url: testDbPath });
    dbOps = new LibSQLDB({
      client,
      maxRetries: 5,
      initialBackoffMs: 100,
    });
  });

  beforeEach(async () => {
    await client.execute(`DROP TABLE IF EXISTS "${TABLE_THREADS}"`);
    await client.execute(`DROP TABLE IF EXISTS "${TABLE_WORKFLOW_SNAPSHOT}"`);
  });

  afterAll(async () => {
    try {
      await client.execute(`DROP TABLE IF EXISTS "${TABLE_THREADS}"`);
      await client.execute(`DROP TABLE IF EXISTS "${TABLE_WORKFLOW_SNAPSHOT}"`);
    } catch {}
  });

  describe('threads table - metadata column', () => {
    it('should read existing TEXT JSON data after JSONB changes', async () => {
      // Create table with TEXT column (simulating old schema)
      await client.execute(`
        CREATE TABLE "${TABLE_THREADS}" (
          id TEXT PRIMARY KEY,
          "resourceId" TEXT NOT NULL,
          title TEXT NOT NULL,
          metadata TEXT,
          "createdAt" TEXT NOT NULL,
          "updatedAt" TEXT NOT NULL
        )
      `);

      // Insert data as TEXT (old format)
      const testMetadata = { key: 'value', nested: { a: 1 }, array: [1, 2, 3] };
      await client.execute({
        sql: `INSERT INTO "${TABLE_THREADS}" (id, "resourceId", title, metadata, "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          'thread-text-1',
          'resource-1',
          'Test Thread',
          JSON.stringify(testMetadata),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });

      // Read via the new select method (which uses json() wrapper)
      const result = await dbOps.select<any>({
        tableName: TABLE_THREADS,
        keys: { id: 'thread-text-1' },
      });

      expect(result).not.toBeNull();
      expect(result.id).toBe('thread-text-1');
      expect(result.metadata).toEqual(testMetadata);
    });

    it('should write new data as JSONB and read it back', async () => {
      // Create table via dbOps (uses JSONB declaration)
      await dbOps.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });

      // Insert data via insert (uses jsonb() function)
      const testMetadata = { newKey: 'newValue', special: 'chars "quotes" and \'apostrophes\'' };
      await dbOps.insert({
        tableName: TABLE_THREADS,
        record: {
          id: 'thread-jsonb-1',
          resourceId: 'resource-1',
          title: 'JSONB Thread',
          metadata: testMetadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Read it back
      const result = await dbOps.select<any>({
        tableName: TABLE_THREADS,
        keys: { id: 'thread-jsonb-1' },
      });

      expect(result).not.toBeNull();
      expect(result.metadata).toEqual(testMetadata);
    });

    it('should handle mixed TEXT and JSONB rows in same table', async () => {
      // Create table with TEXT column first
      await client.execute(`
        CREATE TABLE "${TABLE_THREADS}" (
          id TEXT PRIMARY KEY,
          "resourceId" TEXT NOT NULL,
          title TEXT NOT NULL,
          metadata TEXT,
          "createdAt" TEXT NOT NULL,
          "updatedAt" TEXT NOT NULL
        )
      `);

      // Insert old TEXT row
      const oldMetadata = { format: 'text', legacy: true };
      await client.execute({
        sql: `INSERT INTO "${TABLE_THREADS}" (id, "resourceId", title, metadata, "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          'thread-old',
          'resource-1',
          'Old Thread',
          JSON.stringify(oldMetadata),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });

      // Insert new JSONB row using jsonb() function
      const newMetadata = { format: 'jsonb', modern: true };
      await client.execute({
        sql: `INSERT INTO "${TABLE_THREADS}" (id, "resourceId", title, metadata, "createdAt", "updatedAt")
              VALUES (?, ?, ?, jsonb(?), ?, ?)`,
        args: [
          'thread-new',
          'resource-1',
          'New Thread',
          JSON.stringify(newMetadata),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });

      // Read both via selectMany (uses json() wrapper)
      const results = await dbOps.selectMany<any>({
        tableName: TABLE_THREADS,
        orderBy: 'id ASC',
      });

      expect(results.length).toBe(2);

      // Old TEXT row should be readable
      const oldRow = results.find((r: any) => r.id === 'thread-old');
      expect(oldRow).toBeDefined();
      expect(oldRow.metadata).toEqual(oldMetadata);

      // New JSONB row should be readable
      const newRow = results.find((r: any) => r.id === 'thread-new');
      expect(newRow).toBeDefined();
      expect(newRow.metadata).toEqual(newMetadata);
    });

    it('should handle null metadata correctly', async () => {
      await dbOps.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] });

      await dbOps.insert({
        tableName: TABLE_THREADS,
        record: {
          id: 'thread-null-meta',
          resourceId: 'resource-1',
          title: 'Thread with null metadata',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await dbOps.select<any>({
        tableName: TABLE_THREADS,
        keys: { id: 'thread-null-meta' },
      });

      expect(result).not.toBeNull();
      expect(result.metadata).toBeNull();
    });
  });

  describe('workflow_snapshot table - snapshot column', () => {
    it('should read existing TEXT JSON snapshot after JSONB changes', async () => {
      // Create table with TEXT column
      await client.execute(`
        CREATE TABLE "${TABLE_WORKFLOW_SNAPSHOT}" (
          workflow_name TEXT NOT NULL,
          run_id TEXT NOT NULL,
          "resourceId" TEXT,
          snapshot TEXT NOT NULL,
          "createdAt" TEXT NOT NULL,
          "updatedAt" TEXT NOT NULL,
          PRIMARY KEY (workflow_name, run_id)
        )
      `);

      // Insert snapshot as TEXT
      const testSnapshot = {
        runId: 'run-1',
        status: 'completed',
        context: { step1: { result: 'success' } },
      };
      await client.execute({
        sql: `INSERT INTO "${TABLE_WORKFLOW_SNAPSHOT}" (workflow_name, run_id, snapshot, "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          'test-workflow',
          'run-1',
          JSON.stringify(testSnapshot),
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      });

      // Read via select
      const result = await dbOps.select<any>({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        keys: { workflow_name: 'test-workflow', run_id: 'run-1' },
      });

      expect(result).not.toBeNull();
      expect(result.snapshot).toEqual(testSnapshot);
    });

    it('should work with json_extract on both TEXT and JSONB data', async () => {
      await dbOps.createTable({ tableName: TABLE_WORKFLOW_SNAPSHOT, schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT] });

      // Insert via dbOps (uses jsonb())
      await dbOps.insert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        record: {
          workflow_name: 'json-extract-test',
          run_id: 'run-1',
          snapshot: { runId: 'run-1', status: 'running', value: { key: 'test' } },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Query using json_extract - should work on JSONB
      const result = await client.execute({
        sql: `SELECT workflow_name, json_extract(snapshot, '$.status') as status FROM "${TABLE_WORKFLOW_SNAPSHOT}" WHERE workflow_name = ?`,
        args: ['json-extract-test'],
      });

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]?.status).toBe('running');
    });
  });
});
