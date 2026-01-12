import { describe, expect, it } from 'vitest';
import { TABLE_SCORERS } from './constants';
import { safelyParseJSON, createStorageErrorId, createVectorErrorId, transformRow, transformScoreRow } from './utils';
import type { StoreName } from './utils';

describe('safelyParseJSON', () => {
  const sampleObject = {
    foo: 'bar',
    nested: { value: 42 },
  };

  it('should return input object unchanged when provided a non-null object', () => {
    // Arrange: Prepare test object with nested structure
    const inputObject = sampleObject;

    // Act: Pass object through safelyParseJSON
    const result = safelyParseJSON(inputObject);
    // Assert: Verify object reference and structure preservation
    expect(result).toBe(inputObject); // Same reference
    expect(result).toEqual({
      foo: 'bar',
      nested: { value: 42 },
    });
    expect(result.nested).toBe(inputObject.nested); // Nested reference preserved
  });

  it('should return empty object when provided null or undefined', () => {
    // Act & Assert: Test null input
    const nullResult = safelyParseJSON(null);
    expect(nullResult).toEqual({});
    expect(Object.keys(nullResult)).toHaveLength(0);

    // Act & Assert: Test undefined input
    const undefinedResult = safelyParseJSON(undefined);
    expect(undefinedResult).toEqual({});
    expect(Object.keys(undefinedResult)).toHaveLength(0);

    // Assert: Verify different object instances
    expect(nullResult).not.toBe(undefinedResult);
  });

  it('should return empty object when provided non-string primitives', () => {
    // Act & Assert: Test number input
    const numberResult = safelyParseJSON(42);
    expect(numberResult).toEqual({});
    expect(Object.keys(numberResult)).toHaveLength(0);

    // Act & Assert: Test boolean input
    const booleanResult = safelyParseJSON(true);
    expect(booleanResult).toEqual({});
    expect(Object.keys(booleanResult)).toHaveLength(0);

    // Assert: Verify different object instances
    expect(numberResult).not.toBe(booleanResult);
  });
  it('should return raw string when provided a non-JSON string', () => {
    const raw = 'hello world'; // not valid JSON
    expect(safelyParseJSON(raw)).toBe(raw);
  });

  it('should still parse valid JSON strings', () => {
    const json = '{"a":1,"b":"two"}';
    expect(safelyParseJSON(json)).toEqual({ a: 1, b: 'two' });
  });
  it('parses JSON numbers/booleans/arrays', () => {
    expect(safelyParseJSON('123')).toBe(123);
    expect(safelyParseJSON('true')).toBe(true);
    expect(safelyParseJSON('[1,2]')).toEqual([1, 2]);
  });

  it('trims whitespace around JSON strings', () => {
    expect(safelyParseJSON(' { "x": 1 } ')).toEqual({ x: 1 });
  });
});

describe('transformRow', () => {
  it('should parse jsonb fields from JSON strings', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{"name":"test-scorer","version":"1.0"}',
      input: '{"prompt":"hello"}',
      output: '{"response":"world"}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.id).toBe('test-id');
    expect(result.scorer).toEqual({ name: 'test-scorer', version: '1.0' });
    expect(result.input).toEqual({ prompt: 'hello' });
    expect(result.output).toEqual({ response: 'world' });
    expect(result.score).toBe(0.85);
  });

  it('should pass through already-parsed objects', () => {
    const scorerObject = { name: 'test-scorer', version: '1.0' };
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: scorerObject,
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.scorer).toBe(scorerObject); // Same reference
  });

  it('should skip null and undefined values', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      metadata: null,
      reason: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('reason');
  });

  it('should convert timestamps when convertTimestamps is true', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, { convertTimestamps: true });

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect((result.createdAt as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('should not convert timestamps by default', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS);

    expect(result.createdAt).toBe('2024-01-15T10:30:00Z');
    expect(result.updatedAt).toBe('2024-01-15T11:00:00Z');
  });

  it('should use preferred timestamp fields when provided', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      createdAtZ: '2024-01-15T10:30:00.000Z', // More precise version
      updatedAt: '2024-01-15T11:00:00Z',
      updatedAtZ: '2024-01-15T11:00:00.000Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      preferredTimestampFields: {
        createdAt: 'createdAtZ',
        updatedAt: 'updatedAtZ',
      },
    });

    expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
    expect(result.updatedAt).toBe('2024-01-15T11:00:00.000Z');
  });

  it('should fall back to original field when preferred field is missing', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      // createdAtZ is missing
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      preferredTimestampFields: {
        createdAt: 'createdAtZ',
      },
    });

    expect(result.createdAt).toBe('2024-01-15T10:30:00Z');
  });

  it('should skip values matching nullValuePattern', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      reason: '_null_',
      metadata: '_null_',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, { nullValuePattern: '_null_' });

    expect(result).not.toHaveProperty('reason');
    expect(result).not.toHaveProperty('metadata');
  });

  it('should apply field mappings', () => {
    const row = {
      id: 'test-id',
      scorerId: 'scorer-1',
      runId: 'run-1',
      scorer: '{}',
      score: 0.85,
      source: 'TEST',
      entityData: '{"type":"agent","name":"test-agent"}', // DynamoDB stores entity as entityData
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformRow(row, TABLE_SCORERS, {
      fieldMappings: { entity: 'entityData' },
    });

    expect(result.entity).toEqual({ type: 'agent', name: 'test-agent' });
    expect(result).not.toHaveProperty('entityData');
  });
});

describe('transformScoreRow', () => {
  it('should be a convenience wrapper for transformRow with TABLE_SCORERS', () => {
    const row = {
      id: 'score-123',
      scorerId: 'accuracy-scorer',
      runId: 'run-456',
      scorer: '{"id":"accuracy","name":"Accuracy Scorer"}',
      input: '{"question":"What is 2+2?"}',
      output: '{"answer":"4"}',
      score: 1.0,
      reason: 'Correct answer',
      source: 'TEST',
      entityType: 'AGENT',
      entity: '{"name":"math-agent"}',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    };

    const result = transformScoreRow(row);

    expect(result.id).toBe('score-123');
    expect(result.scorerId).toBe('accuracy-scorer');
    expect(result.scorer).toEqual({ id: 'accuracy', name: 'Accuracy Scorer' });
    expect(result.input).toEqual({ question: 'What is 2+2?' });
    expect(result.output).toEqual({ answer: '4' });
    expect(result.score).toBe(1.0);
    expect(result.reason).toBe('Correct answer');
    expect(result.entity).toEqual({ name: 'math-agent' });
  });

  it('should accept the same options as transformRow', () => {
    const row = {
      id: 'score-123',
      scorerId: 'accuracy-scorer',
      runId: 'run-456',
      scorer: '{}',
      score: 1.0,
      source: 'TEST',
      createdAt: '2024-01-15T10:30:00Z',
      createdAtZ: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-15T11:00:00Z',
      updatedAtZ: '2024-01-15T11:00:00.000Z',
    };

    const result = transformScoreRow(row, {
      preferredTimestampFields: {
        createdAt: 'createdAtZ',
        updatedAt: 'updatedAtZ',
      },
      convertTimestamps: true,
    });

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

describe('createStorageErrorId', () => {
  it('should generate error ID with FAILED status', () => {
    const errorId = createStorageErrorId('PG', 'LIST_THREADS_BY_RESOURCE_ID', 'FAILED');
    expect(errorId).toBe('MASTRA_STORAGE_PG_LIST_THREADS_BY_RESOURCE_ID_FAILED');
  });

  it('should generate error ID with custom status', () => {
    const errorId = createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'INVALID_THREAD_ID');
    expect(errorId).toBe('MASTRA_STORAGE_MONGODB_LIST_MESSAGES_INVALID_THREAD_ID');
  });

  it('should normalize operations with proper word boundaries', () => {
    const errorId = createStorageErrorId('PG', 'listMessagesById', 'FAILED');
    expect(errorId).toBe('MASTRA_STORAGE_PG_LIST_MESSAGES_BY_ID_FAILED');
  });

  it('should normalize status values', () => {
    const errorId = createStorageErrorId('MONGODB', 'LIST_MESSAGES', 'invalid-thread-id');
    expect(errorId).toBe('MASTRA_STORAGE_MONGODB_LIST_MESSAGES_INVALID_THREAD_ID');
  });

  it('should handle various casing styles in operations correctly', () => {
    // camelCase
    expect(createStorageErrorId('PG', 'getMessage', 'FAILED')).toBe('MASTRA_STORAGE_PG_GET_MESSAGE_FAILED');

    // PascalCase
    expect(createStorageErrorId('PG', 'GetMessage', 'FAILED')).toBe('MASTRA_STORAGE_PG_GET_MESSAGE_FAILED');

    // SCREAMING_SNAKE_CASE (already normalized)
    expect(createStorageErrorId('PG', 'GET_MESSAGE', 'FAILED')).toBe('MASTRA_STORAGE_PG_GET_MESSAGE_FAILED');

    // Mixed with acronyms
    expect(createStorageErrorId('PG', 'parseJSONData', 'FAILED')).toBe('MASTRA_STORAGE_PG_PARSE_JSON_DATA_FAILED');
  });

  it('should handle special characters in status', () => {
    const errorId = createStorageErrorId('PG', 'SOME_OPERATION', 'custom-status');
    expect(errorId).toBe('MASTRA_STORAGE_PG_SOME_OPERATION_CUSTOM_STATUS');
  });

  it('should generate consistent IDs for all canonical store names', () => {
    const stores: StoreName[] = [
      'PG',
      'MONGODB',
      'CLICKHOUSE',
      'CLOUDFLARE_D1',
      'MSSQL',
      'LIBSQL',
      'DYNAMODB',
      'LANCE',
      'UPSTASH',
      'CLOUDFLARE',
    ];
    const operations = ['LIST_THREADS_BY_RESOURCE_ID', 'LIST_MESSAGES', 'LIST_WORKFLOW_RUNS'];

    stores.forEach(store => {
      operations.forEach(operation => {
        const errorId = createStorageErrorId(store, operation, 'FAILED');
        expect(errorId).toMatch(/^MASTRA_STORAGE_[A-Z0-9_]+_FAILED$/);
        expect(errorId).toContain(store);
        expect(errorId).toContain(operation);
      });
    });
  });

  it('should handle all statuses consistently', () => {
    const statuses = ['FAILED', 'INVALID_THREAD_ID', 'DUPLICATE_KEY', 'NOT_FOUND', 'TIMEOUT'];

    statuses.forEach(status => {
      const errorId = createStorageErrorId('PG', 'LIST_MESSAGES', status);
      expect(errorId).toBe(`MASTRA_STORAGE_PG_LIST_MESSAGES_${status}`);
    });
  });

  it('should normalize complex operation names', () => {
    expect(createStorageErrorId('PG', 'listThreads', 'FAILED')).toBe(
      'MASTRA_STORAGE_PG_LIST_THREADS_BY_RESOURCE_ID_FAILED',
    );

    expect(createStorageErrorId('DYNAMODB', 'getMessagesPaginated', 'FAILED')).toBe(
      'MASTRA_STORAGE_DYNAMODB_GET_MESSAGES_PAGINATED_FAILED',
    );
  });
});

describe('createVectorErrorId', () => {
  it('should generate vector error ID with FAILED status', () => {
    const errorId = createVectorErrorId('CHROMA', 'QUERY', 'FAILED');
    expect(errorId).toBe('MASTRA_VECTOR_CHROMA_QUERY_FAILED');
  });

  it('should generate vector error ID with custom status', () => {
    const errorId = createVectorErrorId('PINECONE', 'UPSERT', 'INVALID_DIMENSION');
    expect(errorId).toBe('MASTRA_VECTOR_PINECONE_UPSERT_INVALID_DIMENSION');
  });

  it('should normalize vector operations with proper word boundaries', () => {
    const errorId = createVectorErrorId('PG', 'createIndex', 'FAILED');
    expect(errorId).toBe('MASTRA_VECTOR_PG_CREATE_INDEX_FAILED');
  });

  it('should normalize vector status values', () => {
    const errorId = createVectorErrorId('ASTRA', 'DELETE', 'db-error');
    expect(errorId).toBe('MASTRA_VECTOR_ASTRA_DELETE_DB_ERROR');
  });

  it('should handle various casing styles in vector operations', () => {
    expect(createVectorErrorId('QDRANT', 'deleteVector', 'FAILED')).toBe('MASTRA_VECTOR_QDRANT_DELETE_VECTOR_FAILED');
    expect(createVectorErrorId('OPENSEARCH', 'CreateIndex', 'FAILED')).toBe(
      'MASTRA_VECTOR_OPENSEARCH_CREATE_INDEX_FAILED',
    );
    expect(createVectorErrorId('TURBOPUFFER', 'list-indexes', 'failed')).toBe(
      'MASTRA_VECTOR_TURBOPUFFER_LIST_INDEXES_FAILED',
    );
  });

  it('should generate consistent IDs for all vector store names', () => {
    const stores: StoreName[] = [
      'PG',
      'CHROMA',
      'PINECONE',
      'QDRANT',
      'ASTRA',
      'COUCHBASE',
      'OPENSEARCH',
      'TURBOPUFFER',
      'VECTORIZE',
    ];
    const operations = ['QUERY', 'UPSERT', 'DELETE', 'CREATE_INDEX'];

    stores.forEach(store => {
      operations.forEach(operation => {
        const errorId = createVectorErrorId(store, operation, 'FAILED');
        expect(errorId).toMatch(/^MASTRA_VECTOR_[A-Z0-9_]+_FAILED$/);
        expect(errorId).toContain(store);
        expect(errorId).toContain(operation);
      });
    });
  });

  it('should normalize complex vector operation names', () => {
    expect(createVectorErrorId('LIBSQL', 'deleteVectorById', 'FAILED')).toBe(
      'MASTRA_VECTOR_LIBSQL_DELETE_VECTOR_BY_ID_FAILED',
    );
    expect(createVectorErrorId('MONGODB', 'createVectorIndex', 'FAILED')).toBe(
      'MASTRA_VECTOR_MONGODB_CREATE_VECTOR_INDEX_FAILED',
    );
  });
});
