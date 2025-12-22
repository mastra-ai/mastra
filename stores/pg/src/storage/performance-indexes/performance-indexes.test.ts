import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryPG } from '../domains/memory';
import { ObservabilityPG } from '../domains/observability';
import { ScoresPG } from '../domains/scores';

// Mock pg-promise
const mockClient = {
  none: vi.fn(),
  one: vi.fn(),
  manyOrNone: vi.fn(),
  oneOrNone: vi.fn(),
  query: vi.fn(),
};

vi.mock('pg-promise', () => ({ default: vi.fn(() => vi.fn(() => mockClient)) }));

describe('PostgresStore Domain Performance Indexes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MemoryPG.getDefaultIndexDefinitions', () => {
    it('should return composite indexes for threads and messages', () => {
      const memory = new MemoryPG({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = memory.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(2);
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_messages_thread_id_createdat_idx',
        table: 'mastra_messages',
        columns: ['thread_id', 'createdAt DESC'],
      });
    });

    it('should work with default schema (public)', () => {
      const memory = new MemoryPG({
        client: mockClient as any,
        // No schemaName provided, should default to public
      });

      const indexes = memory.getDefaultIndexDefinitions();

      // Verify indexes are created without schema prefix
      expect(indexes).toContainEqual({
        name: 'mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt DESC'],
      });
    });
  });

  describe('ScoresPG.getDefaultIndexDefinitions', () => {
    it('should return composite index for scores', () => {
      const scores = new ScoresPG({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = scores.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(1);
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_scores_trace_id_span_id_created_at_idx',
        table: 'mastra_scores',
        columns: ['traceId', 'spanId', 'createdAt DESC'],
      });
    });
  });

  describe('ObservabilityPG.getDefaultIndexDefinitions', () => {
    it('should return composite indexes for spans', () => {
      const observability = new ObservabilityPG({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = observability.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(4);
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_traceid_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['traceId', 'startedAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_parentspanid_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['parentSpanId', 'startedAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_name_idx',
        table: 'mastra_ai_spans',
        columns: ['name'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_spantype_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['spanType', 'startedAt DESC'],
      });
    });
  });

  describe('Total index count across all domains', () => {
    it('should define 7 indexes total (2 memory + 1 scores + 4 observability)', () => {
      const memory = new MemoryPG({ client: mockClient as any });
      const scores = new ScoresPG({ client: mockClient as any });
      const observability = new ObservabilityPG({ client: mockClient as any });

      const totalIndexes =
        memory.getDefaultIndexDefinitions().length +
        scores.getDefaultIndexDefinitions().length +
        observability.getDefaultIndexDefinitions().length;

      expect(totalIndexes).toBe(7);
    });
  });
});
