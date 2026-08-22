import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildConstraintName } from '../db/constraint-utils';
import { MemoryPG } from '../domains/memory';
import { ObservabilityPG } from '../domains/observability';
import { ScoresPG } from '../domains/scores';
import { WorkflowsPG } from '../domains/workflows';

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

      expect(indexes.length).toBe(3);
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
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_messages_resourceid_thread_id_idx',
        table: 'mastra_messages',
        columns: ['resourceId', 'thread_id'],
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
    });
  });

  describe('WorkflowsPG.getDefaultIndexDefinitions', () => {
    it('should return a composite index for workflow_snapshot on (workflow_name, "createdAt" DESC)', () => {
      const workflows = new WorkflowsPG({
        client: mockClient as any,
        schemaName: 'test_schema',
      });

      const indexes = workflows.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(1);
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_workflow_snapshot_name_createdat_idx',
        table: 'mastra_workflow_snapshot',
        columns: ['workflow_name', 'createdAt DESC'],
      });
    });

    it('should work with default schema (public)', () => {
      const workflows = new WorkflowsPG({
        client: mockClient as any,
      });

      const indexes = workflows.getDefaultIndexDefinitions();

      expect(indexes).toContainEqual({
        name: 'mastra_workflow_snapshot_name_createdat_idx',
        table: 'mastra_workflow_snapshot',
        columns: ['workflow_name', 'createdAt DESC'],
      });
    });

    it('should export the status expression index in the schema DDL', () => {
      const ddl = WorkflowsPG.getExportDDL().join('\n');

      expect(ddl).toContain('mastra_workflow_snapshot_name_status_createdat_idx');
      expect(ddl).toContain(`(workflow_name, (snapshot ->> 'status'), "createdAt" DESC)`);
    });

    it('should prefix the status expression index with a non-public schema', () => {
      const ddl = WorkflowsPG.getExportDDL('test_schema').join('\n');

      expect(ddl).toContain('test_schema_mastra_workflow_snapshot_name_status_createdat_idx');
    });

    // Postgres stores identifiers truncated to 63 bytes. Emitting the untruncated name would
    // make init's snapshot lookup miss and re-issue CREATE INDEX on every warm init.
    it('should truncate the status expression index name to the Postgres identifier limit', () => {
      const longSchema = 'deployment_schema';
      const ddl = WorkflowsPG.getExportDDL(longSchema).join('\n');

      const indexName = ddl.match(/CREATE INDEX IF NOT EXISTS "([^"]+)" ON [^\n]*snapshot ->> 'status'/)?.[1];
      expect(indexName).toBe(
        buildConstraintName({
          baseName: 'mastra_workflow_snapshot_name_status_createdat_idx',
          schemaName: longSchema,
        }),
      );
      expect(Buffer.byteLength(indexName!, 'utf-8')).toBeLessThanOrEqual(63);
    });
  });

  describe('Total index count across tested domains', () => {
    it('should define 14 indexes total (3 memory + 1 scores + 10 observability)', () => {
      const memory = new MemoryPG({ client: mockClient as any });
      const scores = new ScoresPG({ client: mockClient as any });
      const observability = new ObservabilityPG({ client: mockClient as any });

      const totalIndexes =
        memory.getDefaultIndexDefinitions().length +
        scores.getDefaultIndexDefinitions().length +
        observability.getDefaultIndexDefinitions().length;

      expect(totalIndexes).toBe(14);
    });
  });
});
