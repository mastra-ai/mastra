import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryDSQL } from '../domains/memory';
import { ObservabilityDSQL } from '../domains/observability';
import { ScoresDSQL } from '../domains/scores';

// Mock DbClient
const mockClient = {
  $pool: {},
  none: vi.fn(),
  one: vi.fn(),
  manyOrNone: vi.fn(),
  oneOrNone: vi.fn(),
  many: vi.fn(),
  any: vi.fn(),
  query: vi.fn(),
  tx: vi.fn(),
};

describe('DSQLStore Domain Performance Indexes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MemoryDSQL.getDefaultIndexDefinitions', () => {
    it('should return composite indexes for threads and messages without ASC/DESC', () => {
      const memory = new MemoryDSQL({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = memory.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(2);
      // Note: Aurora DSQL does not support ASC/DESC in index columns
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_messages_thread_id_createdat_idx',
        table: 'mastra_messages',
        columns: ['thread_id', 'createdAt'],
      });
    });

    it('should work with default schema (public)', () => {
      const memory = new MemoryDSQL({
        client: mockClient as any,
        // No schemaName provided, should default to public
      });

      const indexes = memory.getDefaultIndexDefinitions();

      // Verify indexes are created without schema prefix
      expect(indexes).toContainEqual({
        name: 'mastra_threads_resourceid_createdat_idx',
        table: 'mastra_threads',
        columns: ['resourceId', 'createdAt'],
      });
    });
  });

  describe('ScoresDSQL.getDefaultIndexDefinitions', () => {
    it('should return composite index for scores without ASC/DESC', () => {
      const scores = new ScoresDSQL({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = scores.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(1);
      // Note: Aurora DSQL does not support ASC/DESC in index columns
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_scores_trace_id_span_id_created_at_idx',
        table: 'mastra_scorers',
        columns: ['traceId', 'spanId', 'createdAt'],
      });
    });
  });

  describe('ObservabilityDSQL.getDefaultIndexDefinitions', () => {
    it('should return composite indexes for spans without ASC/DESC or partial indexes', () => {
      const observability = new ObservabilityDSQL({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = observability.getDefaultIndexDefinitions();

      // DSQL has 7 indexes (vs PG's 4) because it adds entity/org indexes
      // but omits partial indexes and GIN indexes which DSQL doesn't support
      expect(indexes.length).toBe(7);

      // Core trace/span indexes (without DESC)
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_traceid_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['traceId', 'startedAt'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_parentspanid_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['parentSpanId', 'startedAt'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_name_idx',
        table: 'mastra_ai_spans',
        columns: ['name'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_spantype_startedat_idx',
        table: 'mastra_ai_spans',
        columns: ['spanType', 'startedAt'],
      });

      // Entity identification indexes (DSQL-specific additions)
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_entitytype_entityid_idx',
        table: 'mastra_ai_spans',
        columns: ['entityType', 'entityId'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_entitytype_entityname_idx',
        table: 'mastra_ai_spans',
        columns: ['entityType', 'entityName'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_orgid_userid_idx',
        table: 'mastra_ai_spans',
        columns: ['organizationId', 'userId'],
      });
    });

    it('should not include partial indexes or GIN indexes (unsupported by Aurora DSQL)', () => {
      const observability = new ObservabilityDSQL({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = observability.getDefaultIndexDefinitions();

      // Verify no partial indexes (with 'where' clause)
      for (const index of indexes) {
        expect(index).not.toHaveProperty('where');
      }

      // Verify no GIN indexes
      for (const index of indexes) {
        expect(index).not.toHaveProperty('using');
      }
    });
  });

  describe('Total index count across all domains', () => {
    it('should define 10 indexes total (2 memory + 1 scores + 7 observability)', () => {
      const memory = new MemoryDSQL({ client: mockClient as any });
      const scores = new ScoresDSQL({ client: mockClient as any });
      const observability = new ObservabilityDSQL({ client: mockClient as any });

      const totalIndexes =
        memory.getDefaultIndexDefinitions().length +
        scores.getDefaultIndexDefinitions().length +
        observability.getDefaultIndexDefinitions().length;

      expect(totalIndexes).toBe(10);
    });
  });
});
