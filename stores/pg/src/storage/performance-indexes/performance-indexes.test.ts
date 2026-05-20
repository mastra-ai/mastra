import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryPG } from '../domains/memory';
import { ObservabilityPG } from '../domains/observability';
import { SchedulesPG } from '../domains/schedules';
import { ScoresPG } from '../domains/scores';

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
        table: 'mastra_scorers',
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

      expect(indexes.length).toBe(10);
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
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_root_spans_idx',
        table: 'mastra_ai_spans',
        columns: ['startedAt DESC'],
        where: '"parentSpanId" IS NULL',
      });
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
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_metadata_gin_idx',
        table: 'mastra_ai_spans',
        columns: ['metadata'],
        method: 'gin',
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_tags_gin_idx',
        table: 'mastra_ai_spans',
        columns: ['tags'],
        method: 'gin',
      });
    });
  });

  describe('SchedulesPG.getDefaultIndexDefinitions', () => {
    // The scheduler tick polls `listDueSchedules` (status + next_fire_at) every
    // 10s. Without this index, every tick degrades to a full table scan + sort,
    // which pegged Postgres CPU in production. listTriggers does an analogous
    // read on (schedule_id, actual_fire_at).
    it('should return composite indexes for the scheduler hot paths', () => {
      const schedules = new SchedulesPG({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = schedules.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(2);
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_schedules_status_next_fire_at_idx',
        table: 'mastra_schedules',
        columns: ['status', 'next_fire_at'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_schedule_triggers_schedule_actual_fire_idx',
        table: 'mastra_schedule_triggers',
        columns: ['schedule_id', 'actual_fire_at'],
      });
    });

    it('should work with default schema (public)', () => {
      const schedules = new SchedulesPG({ client: mockClient as any });
      const indexes = schedules.getDefaultIndexDefinitions();

      expect(indexes).toContainEqual({
        name: 'mastra_schedules_status_next_fire_at_idx',
        table: 'mastra_schedules',
        columns: ['status', 'next_fire_at'],
      });
    });
  });

  describe('Total index count across all domains', () => {
    it('should define 15 indexes total (2 memory + 1 scores + 10 observability + 2 schedules)', () => {
      const memory = new MemoryPG({ client: mockClient as any });
      const scores = new ScoresPG({ client: mockClient as any });
      const observability = new ObservabilityPG({ client: mockClient as any });
      const schedules = new SchedulesPG({ client: mockClient as any });

      const totalIndexes =
        memory.getDefaultIndexDefinitions().length +
        scores.getDefaultIndexDefinitions().length +
        observability.getDefaultIndexDefinitions().length +
        schedules.getDefaultIndexDefinitions().length;

      expect(totalIndexes).toBe(15);
    });
  });
});
