import { TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowsPG } from './index';

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

describe('WorkflowsPG default indexes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultIndexDefinitions', () => {
    it('returns the indexes serving the listWorkflowRuns access pattern', () => {
      const workflows = new WorkflowsPG({ client: mockClient as any, schemaName: 'test_schema' });

      const indexes = workflows.getDefaultIndexDefinitions();

      expect(indexes.length).toBe(2);
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_workflow_snapshot_name_createdat_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['workflow_name', 'createdAt DESC'],
      });
      expect(indexes).toContainEqual({
        name: 'test_schema_mastra_workflow_snapshot_resourceid_createdat_idx',
        table: TABLE_WORKFLOW_SNAPSHOT,
        columns: ['resourceId', 'createdAt DESC'],
      });
    });

    it('omits the schema prefix on the default public schema', () => {
      const workflows = new WorkflowsPG({ client: mockClient as any });

      const indexes = workflows.getDefaultIndexDefinitions();

      expect(indexes.map(i => i.name)).toEqual([
        'mastra_workflow_snapshot_name_createdat_idx',
        'mastra_workflow_snapshot_resourceid_createdat_idx',
      ]);
    });

    it('leads with the filter column and trails with the sort column', () => {
      // listWorkflowRuns filters on equality, then orders by "createdAt" DESC.
      // A btree can only serve that ordering when the sort column trails the
      // equality column, so this column order is load-bearing, not cosmetic.
      const workflows = new WorkflowsPG({ client: mockClient as any });

      for (const index of workflows.getDefaultIndexDefinitions()) {
        expect(index.columns).toHaveLength(2);
        expect(index.columns[1]).toBe('createdAt DESC');
      }
    });

    it('keeps index names within the 63-byte Postgres identifier limit', () => {
      // Postgres silently truncates identifiers past 63 bytes. The schema
      // prefix eats into that budget, so a sufficiently long custom schema
      // name will truncate for any domain in this package — that is a
      // pre-existing, repo-wide property, not something specific to these
      // indexes. What is asserted here is the case that must always hold:
      // the unprefixed names, used by the default `public` schema.
      const workflows = new WorkflowsPG({ client: mockClient as any });

      for (const index of workflows.getDefaultIndexDefinitions()) {
        expect(Buffer.byteLength(index.name, 'utf8')).toBeLessThanOrEqual(63);
      }
    });
  });

  describe('createDefaultIndexes', () => {
    it('issues a CREATE INDEX for each default index', async () => {
      // oneOrNone backs the "does this index already exist?" probe in
      // PgDB.createIndex; null means it does not, so creation proceeds.
      mockClient.oneOrNone.mockResolvedValue(null);
      mockClient.none.mockResolvedValue(undefined);
      const workflows = new WorkflowsPG({ client: mockClient as any });

      await workflows.createDefaultIndexes();

      const statements = mockClient.none.mock.calls.map(call => String(call[0]));
      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('"mastra_workflow_snapshot_name_createdat_idx"');
      expect(statements[0]).toContain('("workflow_name", "createdAt" DESC)');
      expect(statements[1]).toContain('"mastra_workflow_snapshot_resourceid_createdat_idx"');
      expect(statements[1]).toContain('("resourceId", "createdAt" DESC)');
      // Built without holding a write lock on an existing, possibly large table.
      expect(statements.every(sql => sql.includes('CONCURRENTLY'))).toBe(true);
    });

    it('skips index creation when skipDefaultIndexes is set', async () => {
      const workflows = new WorkflowsPG({
        client: mockClient as any,
        skipDefaultIndexes: true,
      });

      await workflows.createDefaultIndexes();

      expect(mockClient.none).not.toHaveBeenCalled();
    });
  });

  describe('getExportDDL', () => {
    it('emits index DDL so schema exports stay reproducible', () => {
      const statements = WorkflowsPG.getExportDDL('test_schema');
      const indexStatements = statements.filter(s => s.includes('CREATE INDEX'));

      expect(indexStatements).toHaveLength(2);
      expect(indexStatements[0]).toContain('"test_schema_mastra_workflow_snapshot_name_createdat_idx"');
      expect(indexStatements[0]).toContain('("workflow_name", "createdAt" DESC)');
      expect(indexStatements[1]).toContain('"test_schema_mastra_workflow_snapshot_resourceid_createdat_idx"');
      expect(indexStatements[1]).toContain('("resourceId", "createdAt" DESC)');
    });

    it('emits index DDL for the default schema', () => {
      const statements = WorkflowsPG.getExportDDL();
      const indexStatements = statements.filter(s => s.includes('CREATE INDEX'));

      expect(indexStatements).toHaveLength(2);
      expect(indexStatements[0]).toContain('"mastra_workflow_snapshot_name_createdat_idx"');
    });
  });
});
