import { SpanType, EntityType } from '@mastra/core/observability';
import { MongoClient } from 'mongodb';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { MongoDBStore } from './index';

const TEST_CONFIG = {
  id: 'mongodb-migration-test-store',
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'mastra-migration-test-db',
};

const SPANS_COLLECTION = 'mastra_ai_spans';

/**
 * MongoDB-specific migration tests that verify the storage API can handle
 * documents created with the old schema (only OLD_SPAN_SCHEMA fields).
 *
 * Since MongoDB is schema-less, "migration" means ensuring the storage API
 * correctly handles documents that lack the new columns (returning them as null).
 */
describe('MongoDB Spans Schema Compatibility', () => {
  let client: MongoClient;
  let store: MongoDBStore;

  beforeAll(async () => {
    // Connect directly to insert old-format documents
    client = new MongoClient(TEST_CONFIG.url);
    await client.connect();

    // Create store but don't init yet
    store = new MongoDBStore(TEST_CONFIG);
  });

  afterAll(async () => {
    try {
      // Clean up test collection
      const db = client.db(TEST_CONFIG.dbName);
      await db
        .collection(SPANS_COLLECTION)
        .drop()
        .catch(() => {});
      await client.close();
      await store.close();
    } catch (error) {
      console.warn('Migration test cleanup failed:', error);
    }
  });

  it('should handle old-schema documents and return new fields as null', async () => {
    const db = client.db(TEST_CONFIG.dbName);
    const collection = db.collection(SPANS_COLLECTION);

    // Step 1: Insert documents with ONLY old schema fields (simulating pre-migration data)
    const oldSchemaDoc = {
      traceId: 'old-trace-1',
      spanId: 'old-span-1',
      parentSpanId: null,
      name: 'Pre-Migration Span',
      spanType: 'agent_run',
      scope: { version: '1.0.0' },
      attributes: { key: 'value' },
      metadata: { custom: 'data' },
      links: null,
      input: { message: 'hello' },
      output: { result: 'success' },
      error: null,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      endedAt: new Date('2024-01-01T00:00:01Z'),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:01Z'),
      // NOTE: Intentionally missing new fields: entityType, entityId, entityName,
      // userId, organizationId, resourceId, runId, sessionId, threadId,
      // requestId, environment, source, serviceName, tags
    };

    await collection.insertOne(oldSchemaDoc);

    // Insert a child span with old schema
    const childDoc = {
      traceId: 'old-trace-1',
      spanId: 'old-span-2',
      parentSpanId: 'old-span-1',
      name: 'Child Span Before Migration',
      spanType: 'tool_call',
      scope: null,
      attributes: { tool: 'test-tool' },
      metadata: null,
      links: null,
      input: { arg: 'test' },
      output: { result: 'ok' },
      error: null,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00.500Z'),
      endedAt: new Date('2024-01-01T00:00:00.800Z'),
      createdAt: new Date('2024-01-01T00:00:00.500Z'),
      updatedAt: new Date('2024-01-01T00:00:00.800Z'),
    };

    await collection.insertOne(childDoc);

    // Step 2: Verify documents exist
    const count = await collection.countDocuments({ traceId: 'old-trace-1' });
    expect(count).toBe(2);

    // Step 3: Initialize store (which creates indexes but doesn't modify document structure)
    await store.init();

    // Step 4: Query via storage API - should work with old documents
    const observabilityStore = await store.getStore('observability');
    expect(observabilityStore).toBeDefined();
    const trace = await observabilityStore?.getTrace({ traceId: 'old-trace-1' });
    expect(trace).not.toBeNull();
    expect(trace!.spans.length).toBe(2);

    // Find root span
    const rootSpan = trace!.spans.find(s => s.spanId === 'old-span-1');
    expect(rootSpan).toBeDefined();
    expect(rootSpan!.name).toBe('Pre-Migration Span');
    expect(rootSpan!.spanType).toBe('agent_run');
    expect(rootSpan!.parentSpanId).toBeNull();
    expect(rootSpan!.attributes).toEqual({ key: 'value' });
    expect(rootSpan!.metadata).toEqual({ custom: 'data' });
    expect(rootSpan!.input).toEqual({ message: 'hello' });
    expect(rootSpan!.output).toEqual({ result: 'success' });

    // Step 5: Verify new fields are null/undefined for old documents
    expect(rootSpan!.entityType).toBeUndefined();
    expect(rootSpan!.entityId).toBeUndefined();
    expect(rootSpan!.userId).toBeUndefined();
    expect(rootSpan!.environment).toBeUndefined();

    // Find child span
    const childSpan = trace!.spans.find(s => s.spanId === 'old-span-2');
    expect(childSpan).toBeDefined();
    expect(childSpan!.parentSpanId).toBe('old-span-1');
    expect(childSpan!.name).toBe('Child Span Before Migration');
  });

  it('should allow updating old documents with new fields', async () => {
    const db = client.db(TEST_CONFIG.dbName);
    const collection = db.collection(SPANS_COLLECTION);

    // Insert old-format document
    const oldDoc = {
      traceId: 'update-test-trace',
      spanId: 'update-test-span',
      parentSpanId: null,
      name: 'Update Test Span',
      spanType: 'agent_run',
      scope: null,
      attributes: null,
      metadata: null,
      links: null,
      input: null,
      output: null,
      error: null,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      endedAt: null, // Running span
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    await collection.insertOne(oldDoc);

    // Init store
    await store.init();

    const observabilityStore = await store.getStore('observability');
    expect(observabilityStore).toBeDefined();

    // Update via storage API with new fields
    await observabilityStore?.updateSpan({
      traceId: 'update-test-trace',
      spanId: 'update-test-span',
      updates: {
        output: { result: 'completed' },
        endedAt: new Date('2024-01-01T00:00:05Z'),
      },
    });

    // Query and verify update worked
    const trace = await observabilityStore?.getTrace({ traceId: 'update-test-trace' });
    expect(trace).not.toBeNull();
    expect(trace!.spans[0]!.output).toEqual({ result: 'completed' });
    expect(trace!.spans[0]!.endedAt).toEqual(new Date('2024-01-01T00:00:05Z'));

    // Clean up
    await collection.deleteMany({ traceId: 'update-test-trace' });
  });

  it('should handle mixed old and new format documents', async () => {
    const db = client.db(TEST_CONFIG.dbName);
    const collection = db.collection(SPANS_COLLECTION);

    // Insert old-format document
    const oldDoc = {
      traceId: 'mixed-test-trace',
      spanId: 'old-format-span',
      parentSpanId: null,
      name: 'Old Format Span',
      spanType: 'agent_run',
      scope: null,
      attributes: null,
      metadata: null,
      links: null,
      input: null,
      output: null,
      error: null,
      isEvent: false,
      startedAt: new Date('2024-01-01T00:00:00Z'),
      endedAt: new Date('2024-01-01T00:00:01Z'),
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:01Z'),
    };

    await collection.insertOne(oldDoc);

    // Init store
    await store.init();

    // Create new-format span via storage API
    const observabilityStore = await store.getStore('observability');
    expect(observabilityStore).toBeDefined();
    await observabilityStore?.createSpan({
      span: {
        traceId: 'mixed-test-trace',
        spanId: 'new-format-span',
        parentSpanId: 'old-format-span',
        name: 'New Format Span',
        spanType: SpanType.TOOL_CALL,
        isEvent: false,
        startedAt: new Date('2024-01-01T00:00:02Z'),
        endedAt: new Date('2024-01-01T00:00:03Z'),
        // New fields
        entityType: EntityType.TOOL,
        entityId: 'tool-123',
        entityName: 'Test Tool',
        userId: 'user-456',
        environment: 'production',
      },
    });

    // Query trace - should get both old and new format spans
    const trace = await observabilityStore?.getTrace({ traceId: 'mixed-test-trace' });
    expect(trace).not.toBeNull();
    expect(trace!.spans.length).toBe(2);

    // Old span should have undefined new fields
    const oldSpan = trace!.spans.find(s => s.spanId === 'old-format-span');
    expect(oldSpan!.entityType).toBeUndefined();
    expect(oldSpan!.entityId).toBeUndefined();

    // New span should have all fields
    const newSpan = trace!.spans.find(s => s.spanId === 'new-format-span');
    expect(newSpan!.entityType).toBe('tool');
    expect(newSpan!.entityId).toBe('tool-123');
    expect(newSpan!.entityName).toBe('Test Tool');
    expect(newSpan!.userId).toBe('user-456');
    expect(newSpan!.environment).toBe('production');

    // Clean up
    await collection.deleteMany({ traceId: 'mixed-test-trace' });
  });
});
