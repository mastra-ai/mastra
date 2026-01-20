import { createClient } from '@clickhouse/client';
import type { ClickHouseClient } from '@clickhouse/client';
import { MastraError } from '@mastra/core/errors';
import { TABLE_SPANS, SPAN_SCHEMA } from '@mastra/core/storage';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';

import { ClickhouseDB } from './db';
import { ObservabilityStorageClickhouse } from './domains/observability';

/**
 * ClickHouse-specific migration tests that verify the spans table migration
 * from old sorting key (createdAt, traceId, spanId) to new sorting key (traceId, spanId)
 * works correctly, including deduplication of existing data.
 */
describe('ClickHouse Spans Table Migration', () => {
  let client: ClickHouseClient;
  let db: ClickhouseDB;

  const TEST_CONFIG = {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'password',
  };

  beforeAll(async () => {
    client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        date_time_output_format: 'iso',
        use_client_time_zone: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });

    db = new ClickhouseDB({ client, ttl: undefined });
  });

  afterAll(async () => {
    await client?.close();
  });

  beforeEach(async () => {
    // Drop the spans table before each test to ensure clean state
    await client.command({
      query: `DROP TABLE IF EXISTS ${TABLE_SPANS}`,
    });
  });

  /**
   * Helper to create a table with the OLD sorting key (createdAt, traceId, spanId)
   * This simulates what existing users would have before the migration.
   */
  async function createOldSpansTable(): Promise<void> {
    await client.command({
      query: `
        CREATE TABLE ${TABLE_SPANS} (
          "traceId" String,
          "spanId" String,
          "parentSpanId" Nullable(String),
          "name" String,
          "spanType" String,
          "isEvent" Bool,
          "startedAt" DateTime64(3),
          "endedAt" Nullable(DateTime64(3)),
          "createdAt" DateTime64(3),
          "updatedAt" DateTime64(3),
          "entityType" Nullable(String),
          "entityId" Nullable(String),
          "entityName" Nullable(String),
          "userId" Nullable(String),
          "organizationId" Nullable(String),
          "resourceId" Nullable(String),
          "runId" Nullable(String),
          "sessionId" Nullable(String),
          "threadId" Nullable(String),
          "requestId" Nullable(String),
          "environment" Nullable(String),
          "source" Nullable(String),
          "serviceName" Nullable(String),
          "scope" Nullable(String),
          "metadata" Nullable(String) DEFAULT '{}',
          "tags" Nullable(String),
          "attributes" Nullable(String),
          "links" Nullable(String),
          "input" Nullable(String),
          "output" Nullable(String),
          "error" Nullable(String)
        )
        ENGINE = ReplacingMergeTree()
        PRIMARY KEY (createdAt, traceId, spanId)
        ORDER BY (createdAt, traceId, spanId)
        SETTINGS index_granularity = 8192
      `,
    });
  }

  /**
   * Helper to insert a span record directly into the database
   */
  async function insertSpan(span: {
    traceId: string;
    spanId: string;
    parentSpanId?: string | null;
    name: string;
    spanType: string;
    isEvent: boolean;
    startedAt: Date;
    endedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    entityType?: string | null;
    output?: string | null;
  }): Promise<void> {
    await client.insert({
      table: TABLE_SPANS,
      values: [
        {
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId ?? null,
          name: span.name,
          spanType: span.spanType,
          isEvent: span.isEvent,
          startedAt: span.startedAt.getTime(),
          endedAt: span.endedAt?.getTime() ?? null,
          createdAt: span.createdAt.getTime(),
          updatedAt: span.updatedAt.getTime(),
          entityType: span.entityType ?? null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          metadata: '{}',
          tags: null,
          attributes: null,
          links: null,
          input: null,
          output: span.output ?? null,
          error: null,
        },
      ],
      format: 'JSONEachRow',
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        use_client_time_zone: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });
  }

  /**
   * Helper to get the current sorting key of a table
   */
  async function getTableSortingKey(tableName: string): Promise<string | null> {
    const result = await client.query({
      query: `SELECT sorting_key FROM system.tables WHERE name = {tableName:String}`,
      query_params: { tableName },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ sorting_key: string }>;
    return rows[0]?.sorting_key ?? null;
  }

  /**
   * Helper to count rows in the spans table
   */
  async function countSpans(): Promise<number> {
    const result = await client.query({
      query: `SELECT COUNT(*) as count FROM ${TABLE_SPANS}`,
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ count: string }>;
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Helper to get a specific span by traceId and spanId
   */
  async function getSpan(traceId: string, spanId: string): Promise<Record<string, unknown> | null> {
    const result = await client.query({
      query: `SELECT * FROM ${TABLE_SPANS} FINAL WHERE traceId = {traceId:String} AND spanId = {spanId:String}`,
      query_params: { traceId, spanId },
      format: 'JSONEachRow',
      clickhouse_settings: {
        date_time_output_format: 'iso',
      },
    });
    const rows = (await result.json()) as Array<Record<string, unknown>>;
    return rows[0] ?? null;
  }

  describe('migrateSpansTableSortingKey', () => {
    it('should skip migration when table does not exist', async () => {
      // Table doesn't exist, migration should return false
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(false);
    });

    it('should skip migration when table already has correct sorting key', async () => {
      // Create table with new sorting key using the normal createTable
      await db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });

      const sortingKeyBefore = await getTableSortingKey(TABLE_SPANS);
      expect(sortingKeyBefore?.toLowerCase()).toContain('traceid');
      expect(sortingKeyBefore?.toLowerCase()).not.toMatch(/^createdat/);

      // Migration should return false (not needed)
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(false);

      // Sorting key should remain the same
      const sortingKeyAfter = await getTableSortingKey(TABLE_SPANS);
      expect(sortingKeyAfter).toBe(sortingKeyBefore);
    });

    it('should migrate table with old sorting key (no duplicates)', async () => {
      // Create old table structure
      await createOldSpansTable();

      const sortingKeyBefore = await getTableSortingKey(TABLE_SPANS);
      expect(sortingKeyBefore?.toLowerCase()).toMatch(/^createdat/);

      // Insert non-duplicate data
      const baseTime = new Date('2024-01-01T00:00:00Z');

      await insertSpan({
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'Span 1',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      await insertSpan({
        traceId: 'trace-1',
        spanId: 'span-2',
        parentSpanId: 'span-1',
        name: 'Span 2',
        spanType: 'tool_call',
        isEvent: false,
        startedAt: new Date(baseTime.getTime() + 100),
        endedAt: new Date(baseTime.getTime() + 500),
        createdAt: new Date(baseTime.getTime() + 100),
        updatedAt: new Date(baseTime.getTime() + 100),
      });

      await insertSpan({
        traceId: 'trace-2',
        spanId: 'span-1',
        name: 'Span in different trace',
        spanType: 'workflow_run',
        isEvent: false,
        startedAt: new Date(baseTime.getTime() + 2000),
        endedAt: new Date(baseTime.getTime() + 3000),
        createdAt: new Date(baseTime.getTime() + 2000),
        updatedAt: new Date(baseTime.getTime() + 2000),
      });

      expect(await countSpans()).toBe(3);

      // Run migration
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(true);

      // Verify new sorting key
      const sortingKeyAfter = await getTableSortingKey(TABLE_SPANS);
      expect(sortingKeyAfter?.toLowerCase()).toBe('traceid, spanid');

      // Verify all data was preserved
      expect(await countSpans()).toBe(3);

      // Verify individual spans
      const span1 = await getSpan('trace-1', 'span-1');
      expect(span1).not.toBeNull();
      expect(span1?.name).toBe('Span 1');

      const span2 = await getSpan('trace-1', 'span-2');
      expect(span2).not.toBeNull();
      expect(span2?.name).toBe('Span 2');
      expect(span2?.parentSpanId).toBe('span-1');

      const span3 = await getSpan('trace-2', 'span-1');
      expect(span3).not.toBeNull();
      expect(span3?.name).toBe('Span in different trace');
    });

    it('should deduplicate spans keeping completed over incomplete', async () => {
      // Create old table structure
      await createOldSpansTable();

      const baseTime = new Date('2024-01-01T00:00:00Z');

      // Insert duplicate spans with same (traceId, spanId) but different createdAt
      // First: incomplete span (no endedAt)
      await insertSpan({
        traceId: 'trace-dup',
        spanId: 'span-dup',
        name: 'Incomplete Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: null, // Not completed
        createdAt: baseTime,
        updatedAt: new Date(baseTime.getTime() + 5000), // Updated later but still incomplete
      });

      // Second: completed span (has endedAt) but older updatedAt
      await insertSpan({
        traceId: 'trace-dup',
        spanId: 'span-dup',
        name: 'Completed Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000), // Completed
        createdAt: new Date(baseTime.getTime() + 100),
        updatedAt: new Date(baseTime.getTime() + 1000), // Older updatedAt than incomplete
      });

      // Before migration, both rows exist (old key allows duplicates with different createdAt)
      expect(await countSpans()).toBe(2);

      // Run migration
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(true);

      // After migration, only 1 row should remain
      expect(await countSpans()).toBe(1);

      // The completed span should be kept (priority: completed > incomplete)
      const span = await getSpan('trace-dup', 'span-dup');
      expect(span).not.toBeNull();
      expect(span?.name).toBe('Completed Span');
      expect(span?.endedAt).not.toBeNull();
    });

    it('should deduplicate spans keeping most recently updated when both completed', async () => {
      // Create old table structure
      await createOldSpansTable();

      const baseTime = new Date('2024-01-01T00:00:00Z');

      // First completed span with older updatedAt
      await insertSpan({
        traceId: 'trace-dup2',
        spanId: 'span-dup2',
        name: 'Old Completed Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: baseTime,
        updatedAt: new Date(baseTime.getTime() + 1000), // Older
        output: '{"result": "old"}',
      });

      // Second completed span with newer updatedAt
      await insertSpan({
        traceId: 'trace-dup2',
        spanId: 'span-dup2',
        name: 'New Completed Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 2000),
        createdAt: new Date(baseTime.getTime() + 100),
        updatedAt: new Date(baseTime.getTime() + 5000), // Newer
        output: '{"result": "new"}',
      });

      expect(await countSpans()).toBe(2);

      // Run migration
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(true);
      expect(await countSpans()).toBe(1);

      // The most recently updated span should be kept
      const span = await getSpan('trace-dup2', 'span-dup2');
      expect(span).not.toBeNull();
      expect(span?.name).toBe('New Completed Span');
      expect(span?.output).toBe('{"result": "new"}');
    });

    it('should deduplicate using createdAt as final tiebreaker', async () => {
      // Create old table structure
      await createOldSpansTable();

      const baseTime = new Date('2024-01-01T00:00:00Z');
      const sameUpdatedAt = new Date(baseTime.getTime() + 1000);

      // Both completed, same updatedAt, different createdAt
      await insertSpan({
        traceId: 'trace-dup3',
        spanId: 'span-dup3',
        name: 'Older Created Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: baseTime, // Older createdAt
        updatedAt: sameUpdatedAt,
        output: '{"created": "old"}',
      });

      await insertSpan({
        traceId: 'trace-dup3',
        spanId: 'span-dup3',
        name: 'Newer Created Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: new Date(baseTime.getTime() + 500), // Newer createdAt
        updatedAt: sameUpdatedAt,
        output: '{"created": "new"}',
      });

      expect(await countSpans()).toBe(2);

      // Run migration
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(true);
      expect(await countSpans()).toBe(1);

      // The most recently created span should be kept (tiebreaker)
      const span = await getSpan('trace-dup3', 'span-dup3');
      expect(span).not.toBeNull();
      expect(span?.name).toBe('Newer Created Span');
      expect(span?.output).toBe('{"created": "new"}');
    });

    it('should handle mixed duplicates and non-duplicates correctly', async () => {
      // Create old table structure
      await createOldSpansTable();

      const baseTime = new Date('2024-01-01T00:00:00Z');

      // Non-duplicate span 1
      await insertSpan({
        traceId: 'trace-unique-1',
        spanId: 'span-unique-1',
        name: 'Unique Span 1',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      // Duplicate span (will have 3 copies)
      await insertSpan({
        traceId: 'trace-dup-multi',
        spanId: 'span-dup-multi',
        name: 'Dup Version 1 - Incomplete',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: null,
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      await insertSpan({
        traceId: 'trace-dup-multi',
        spanId: 'span-dup-multi',
        name: 'Dup Version 2 - Complete Old',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 500),
        createdAt: new Date(baseTime.getTime() + 100),
        updatedAt: new Date(baseTime.getTime() + 500),
      });

      await insertSpan({
        traceId: 'trace-dup-multi',
        spanId: 'span-dup-multi',
        name: 'Dup Version 3 - Complete New', // This should be kept
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: new Date(baseTime.getTime() + 200),
        updatedAt: new Date(baseTime.getTime() + 2000), // Most recent
      });

      // Non-duplicate span 2
      await insertSpan({
        traceId: 'trace-unique-2',
        spanId: 'span-unique-2',
        name: 'Unique Span 2',
        spanType: 'tool_call',
        isEvent: false,
        startedAt: new Date(baseTime.getTime() + 3000),
        endedAt: new Date(baseTime.getTime() + 4000),
        createdAt: new Date(baseTime.getTime() + 3000),
        updatedAt: new Date(baseTime.getTime() + 3000),
      });

      // Child of unique span 1
      await insertSpan({
        traceId: 'trace-unique-1',
        spanId: 'span-unique-1-child',
        parentSpanId: 'span-unique-1',
        name: 'Child of Unique 1',
        spanType: 'tool_call',
        isEvent: false,
        startedAt: new Date(baseTime.getTime() + 100),
        endedAt: new Date(baseTime.getTime() + 200),
        createdAt: new Date(baseTime.getTime() + 100),
        updatedAt: new Date(baseTime.getTime() + 100),
      });

      // Before: 6 rows (1 unique + 3 duplicates + 1 unique + 1 child)
      expect(await countSpans()).toBe(6);

      // Run migration
      const migrated = await db.migrateSpansTableSortingKey({
        tableName: TABLE_SPANS,
        schema: SPAN_SCHEMA,
      });

      expect(migrated).toBe(true);

      // After: 4 rows (3 duplicates collapsed to 1)
      expect(await countSpans()).toBe(4);

      // Verify non-duplicates preserved
      const unique1 = await getSpan('trace-unique-1', 'span-unique-1');
      expect(unique1).not.toBeNull();
      expect(unique1?.name).toBe('Unique Span 1');

      const unique2 = await getSpan('trace-unique-2', 'span-unique-2');
      expect(unique2).not.toBeNull();
      expect(unique2?.name).toBe('Unique Span 2');

      const child = await getSpan('trace-unique-1', 'span-unique-1-child');
      expect(child).not.toBeNull();
      expect(child?.name).toBe('Child of Unique 1');
      expect(child?.parentSpanId).toBe('span-unique-1');

      // Verify correct duplicate was kept
      const dup = await getSpan('trace-dup-multi', 'span-dup-multi');
      expect(dup).not.toBeNull();
      expect(dup?.name).toBe('Dup Version 3 - Complete New');
    });
  });

  describe('ObservabilityStorageClickhouse.init() with migration', () => {
    it('should automatically migrate table on init when old sorting key detected', async () => {
      // Create old table structure
      await createOldSpansTable();

      const baseTime = new Date('2024-01-01T00:00:00Z');

      // Insert test data including a duplicate
      await insertSpan({
        traceId: 'init-trace',
        spanId: 'init-span',
        name: 'Old Version',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: null,
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      await insertSpan({
        traceId: 'init-trace',
        spanId: 'init-span',
        name: 'New Version',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: new Date(baseTime.getTime() + 100),
        updatedAt: new Date(baseTime.getTime() + 1000),
      });

      expect(await countSpans()).toBe(2);

      // Create observability storage and call init
      const observability = new ObservabilityStorageClickhouse({ client });
      await observability.init();

      // Verify migration happened
      const sortingKey = await getTableSortingKey(TABLE_SPANS);
      expect(sortingKey?.toLowerCase()).toBe('traceid, spanid');

      // Verify deduplication
      expect(await countSpans()).toBe(1);

      const span = await getSpan('init-trace', 'init-span');
      expect(span?.name).toBe('New Version'); // Completed version kept
    });

    it('should work correctly when called multiple times (idempotent)', async () => {
      // Create old table structure and data
      await createOldSpansTable();

      const baseTime = new Date('2024-01-01T00:00:00Z');
      await insertSpan({
        traceId: 'idempotent-trace',
        spanId: 'idempotent-span',
        name: 'Test Span',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      const observability = new ObservabilityStorageClickhouse({ client });

      // First init - should migrate
      await observability.init();
      expect(await countSpans()).toBe(1);

      // Second init - should not fail, just skip migration
      await observability.init();
      expect(await countSpans()).toBe(1);

      // Third init - still idempotent
      await observability.init();
      expect(await countSpans()).toBe(1);

      // Data should still be intact
      const span = await getSpan('idempotent-trace', 'idempotent-span');
      expect(span?.name).toBe('Test Span');
    });
  });

  describe('ReplacingMergeTree deduplication after migration', () => {
    it('should deduplicate new inserts with same (traceId, spanId) using FINAL', async () => {
      // Create table with new sorting key
      await db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });

      const baseTime = new Date('2024-01-01T00:00:00Z');

      // Insert initial span
      await insertSpan({
        traceId: 'final-trace',
        spanId: 'final-span',
        name: 'Initial Version',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: null,
        createdAt: baseTime,
        updatedAt: baseTime,
      });

      // Insert update (same traceId, spanId - simulates update via insert)
      await insertSpan({
        traceId: 'final-trace',
        spanId: 'final-span',
        name: 'Updated Version',
        spanType: 'agent_run',
        isEvent: false,
        startedAt: baseTime,
        endedAt: new Date(baseTime.getTime() + 1000),
        createdAt: baseTime,
        updatedAt: new Date(baseTime.getTime() + 1000), // Newer updatedAt
      });

      // With FINAL keyword, should see deduplicated result (1 row)
      const result = await client.query({
        query: `SELECT * FROM ${TABLE_SPANS} FINAL WHERE traceId = 'final-trace' AND spanId = 'final-span'`,
        format: 'JSONEachRow',
      });
      const rows = (await result.json()) as Array<Record<string, unknown>>;

      expect(rows.length).toBe(1);
      expect(rows[0]?.name).toBe('Updated Version');
      expect(rows[0]?.endedAt).not.toBeNull();
    });
  });
});

/**
 * ClickHouse-specific tests that verify init() throws MastraError when
 * migration is required (sorting key needs to be updated).
 *
 * IMPORTANT: Unlike other databases, ClickHouse ALWAYS requires manual migration
 * when the sorting key needs to change, regardless of whether duplicates exist.
 * This is because ClickHouse's ReplacingMergeTree requires table recreation to
 * change the sorting key.
 */
describe('ClickHouse Migration Required Error', () => {
  let client: ClickHouseClient;

  const TEST_CONFIG = {
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || 'password',
  };

  beforeAll(async () => {
    client = createClient({
      url: TEST_CONFIG.url,
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        date_time_output_format: 'iso',
        use_client_time_zone: 1,
        output_format_json_quote_64bit_integers: 0,
      },
    });
  });

  afterAll(async () => {
    await client?.close();
  });

  beforeEach(async () => {
    // Drop the spans table before each test to ensure clean state
    await client.command({
      query: `DROP TABLE IF EXISTS ${TABLE_SPANS}`,
    });
  });

  /**
   * Helper to create a table with the OLD sorting key (createdAt, traceId, spanId)
   */
  async function createOldSpansTable(): Promise<void> {
    await client.command({
      query: `
        CREATE TABLE ${TABLE_SPANS} (
          "traceId" String,
          "spanId" String,
          "parentSpanId" Nullable(String),
          "name" String,
          "spanType" String,
          "isEvent" Bool,
          "startedAt" DateTime64(3),
          "endedAt" Nullable(DateTime64(3)),
          "createdAt" DateTime64(3),
          "updatedAt" DateTime64(3),
          "entityType" Nullable(String),
          "entityId" Nullable(String),
          "entityName" Nullable(String),
          "userId" Nullable(String),
          "organizationId" Nullable(String),
          "resourceId" Nullable(String),
          "runId" Nullable(String),
          "sessionId" Nullable(String),
          "threadId" Nullable(String),
          "requestId" Nullable(String),
          "environment" Nullable(String),
          "source" Nullable(String),
          "serviceName" Nullable(String),
          "scope" Nullable(String),
          "metadata" Nullable(String) DEFAULT '{}',
          "tags" Nullable(String),
          "attributes" Nullable(String),
          "links" Nullable(String),
          "input" Nullable(String),
          "output" Nullable(String),
          "error" Nullable(String)
        )
        ENGINE = ReplacingMergeTree()
        PRIMARY KEY (createdAt, traceId, spanId)
        ORDER BY (createdAt, traceId, spanId)
        SETTINGS index_granularity = 8192
      `,
    });
  }

  it('should throw MastraError when init() finds old sorting key (even without duplicates)', async () => {
    // Create table with OLD sorting key
    await createOldSpansTable();

    // Insert a UNIQUE span (no duplicates)
    await client.insert({
      table: TABLE_SPANS,
      values: [
        {
          traceId: 'unique-trace',
          spanId: 'unique-span',
          parentSpanId: null,
          name: 'Unique Span',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: new Date('2024-01-01T00:00:00Z').getTime(),
          endedAt: new Date('2024-01-01T00:00:01Z').getTime(),
          createdAt: new Date('2024-01-01T00:00:00Z').getTime(),
          updatedAt: new Date('2024-01-01T00:00:00Z').getTime(),
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          metadata: '{}',
          tags: null,
          attributes: null,
          links: null,
          input: null,
          output: null,
          error: null,
        },
      ],
      format: 'JSONEachRow',
    });

    // Verify table has old sorting key
    const result = await client.query({
      query: `SELECT sorting_key FROM system.tables WHERE name = {tableName:String}`,
      query_params: { tableName: TABLE_SPANS },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ sorting_key: string }>;
    expect(rows[0]?.sorting_key.toLowerCase()).toMatch(/^createdat/);

    // Create observability store and try to init - should throw MastraError
    // even though there are NO duplicates
    const observability = new ObservabilityStorageClickhouse({ client });

    // init() should throw MastraError because sorting key needs update
    await expect(observability.init()).rejects.toThrow(MastraError);

    // Verify error has correct ID
    try {
      await observability.init();
    } catch (error: any) {
      expect(error).toBeInstanceOf(MastraError);
      expect(error.id).toContain('MIGRATION_REQUIRED');
      expect(error.id).toContain('SORTING_KEY_CHANGE');
    }
  });

  it('should throw MastraError when init() finds old sorting key (with duplicates - different error message)', async () => {
    // Create table with OLD sorting key
    await createOldSpansTable();

    const baseTime = new Date('2024-01-01T00:00:00Z');

    // Insert DUPLICATE spans (same traceId + spanId)
    await client.insert({
      table: TABLE_SPANS,
      values: [
        {
          traceId: 'dup-trace',
          spanId: 'dup-span',
          parentSpanId: null,
          name: 'First duplicate',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: baseTime.getTime(),
          endedAt: null,
          createdAt: baseTime.getTime(),
          updatedAt: baseTime.getTime(),
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          metadata: '{}',
          tags: null,
          attributes: null,
          links: null,
          input: null,
          output: null,
          error: null,
        },
        {
          traceId: 'dup-trace',
          spanId: 'dup-span', // Same spanId - duplicate
          parentSpanId: null,
          name: 'Second duplicate',
          spanType: 'agent_run',
          isEvent: false,
          startedAt: baseTime.getTime(),
          endedAt: new Date(baseTime.getTime() + 1000).getTime(),
          createdAt: new Date(baseTime.getTime() + 100).getTime(),
          updatedAt: new Date(baseTime.getTime() + 1000).getTime(),
          entityType: null,
          entityId: null,
          entityName: null,
          userId: null,
          organizationId: null,
          resourceId: null,
          runId: null,
          sessionId: null,
          threadId: null,
          requestId: null,
          environment: null,
          source: null,
          serviceName: null,
          scope: null,
          metadata: '{}',
          tags: null,
          attributes: null,
          links: null,
          input: null,
          output: null,
          error: null,
        },
      ],
      format: 'JSONEachRow',
    });

    // Create observability store and try to init - should throw MastraError
    const observability = new ObservabilityStorageClickhouse({ client });

    // init() should throw MastraError because sorting key needs update
    await expect(observability.init()).rejects.toThrow(MastraError);

    // Verify error has correct ID
    try {
      await observability.init();
    } catch (error: any) {
      expect(error).toBeInstanceOf(MastraError);
      expect(error.id).toContain('MIGRATION_REQUIRED');
      expect(error.id).toContain('SORTING_KEY_CHANGE');
    }
  });

  it('should NOT throw when table has correct sorting key (fresh install)', async () => {
    // Don't create any table - let init create it with correct sorting key

    const observability = new ObservabilityStorageClickhouse({ client });

    // init() should NOT throw - it will create table with correct sorting key
    await expect(observability.init()).resolves.not.toThrow();

    // Verify table has correct sorting key
    const result = await client.query({
      query: `SELECT sorting_key FROM system.tables WHERE name = {tableName:String}`,
      query_params: { tableName: TABLE_SPANS },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ sorting_key: string }>;
    expect(rows[0]?.sorting_key.toLowerCase()).toBe('traceid, spanid');
  });

  it('should NOT throw when table already has correct sorting key (migrated)', async () => {
    // First, create table with correct sorting key via normal init
    const db = new ClickhouseDB({ client, ttl: undefined });
    await db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });

    // Verify table has correct sorting key
    const result = await client.query({
      query: `SELECT sorting_key FROM system.tables WHERE name = {tableName:String}`,
      query_params: { tableName: TABLE_SPANS },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ sorting_key: string }>;
    expect(rows[0]?.sorting_key.toLowerCase()).toBe('traceid, spanid');

    // Now call init() again - should NOT throw
    const observability = new ObservabilityStorageClickhouse({ client });
    await expect(observability.init()).resolves.not.toThrow();
  });
});
