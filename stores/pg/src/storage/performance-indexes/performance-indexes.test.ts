import {
  TABLE_HARNESS_CHANNEL_INBOX,
  TABLE_HARNESS_SESSIONS,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_WORKSPACE_ACTIONS,
  TABLE_MESSAGES,
  TABLE_SCORERS,
  TABLE_SPANS,
  TABLE_THREADS,
} from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HarnessPG } from '../domains/harness';
import { MemoryPG } from '../domains/memory';
import { ObservabilityPG } from '../domains/observability';
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
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_messages_thread_id_createdat_idx',
        table: TABLE_MESSAGES,
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
        table: TABLE_THREADS,
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
        table: TABLE_SCORERS,
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
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_parentspanid_startedat_idx',
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_name_idx',
        table: TABLE_SPANS,
        columns: ['name'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_spantype_startedat_idx',
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_root_spans_idx',
        table: TABLE_SPANS,
        columns: ['startedAt DESC'],
        where: '"parentSpanId" IS NULL',
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_ai_spans_metadata_gin_idx',
        table: TABLE_SPANS,
        columns: ['metadata'],
        method: 'gin',
      });
    });
  });

  describe('HarnessPG.getDefaultIndexDefinitions', () => {
    it('should return durable runtime indexes for sessions, replay, and channels', () => {
      const harness = new HarnessPG({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = harness.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(21);
      expect(indexes).toContainEqual({
        name: 'test_schema_idx_harness_sessions_active_key',
        table: TABLE_HARNESS_SESSIONS,
        columns: ['harness_name', 'resource_id', 'thread_id'],
        unique: true,
        where: '"closed_at" IS NULL',
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_idx_harness_session_events_replay',
        table: TABLE_HARNESS_SESSION_EVENTS,
        columns: ['harness_name', 'session_id', 'resource_id', 'thread_id', 'epoch', 'sequence'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_idx_harness_workspace_actions_session',
        table: TABLE_HARNESS_WORKSPACE_ACTIONS,
        columns: ['harness_name', 'session_id', 'resource_id', 'thread_id', 'created_at', 'id'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_idx_harness_workspace_actions_page',
        table: TABLE_HARNESS_WORKSPACE_ACTIONS,
        columns: ['harness_name', 'session_id', 'resource_id', 'created_at', 'id'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_idx_harness_channel_inbox_idempotency',
        table: TABLE_HARNESS_CHANNEL_INBOX,
        columns: ['harness_name', 'channel_id', 'idempotency_key'],
        unique: true,
      });
    });
  });

  describe('Total index count across all domains', () => {
    it('should define expected indexes for covered domains', () => {
      const memory = new MemoryPG({ client: mockClient as any });
      const scores = new ScoresPG({ client: mockClient as any });
      const observability = new ObservabilityPG({ client: mockClient as any });
      const harness = new HarnessPG({ client: mockClient as any });

      const totalIndexes =
        memory.getDefaultIndexDefinitions().length +
        scores.getDefaultIndexDefinitions().length +
        observability.getDefaultIndexDefinitions().length +
        harness.getDefaultIndexDefinitions().length;

      expect(totalIndexes).toBe(34);
    });
  });
});
