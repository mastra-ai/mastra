import { describe, expect, it } from 'vitest';

import { findBestIndex, TABLE_INDEX_MAP } from './index-map';

describe('findBestIndex', () => {
  describe('mastra_messages', () => {
    it('should use an index with thread_id prefix for thread_id filter', () => {
      const result = findBestIndex('mastra_messages', [{ field: 'thread_id', value: 'thread-1' }]);
      expect(result).not.toBeNull();
      // by_thread_created and by_thread both match; either is correct since both
      // use thread_id as a prefix field. by_thread_created also provides createdAt sort.
      expect(['by_thread', 'by_thread_created']).toContain(result!.indexName);
      expect(result!.indexedFilters).toEqual([{ field: 'thread_id', value: 'thread-1' }]);
    });

    it('should prefer by_thread_created over by_thread when both thread_id and createdAt filters present', () => {
      const result = findBestIndex('mastra_messages', [
        { field: 'thread_id', value: 'thread-1' },
        { field: 'createdAt', value: '2024-01-01' },
      ]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_thread_created');
      expect(result!.indexedFilters).toHaveLength(2);
      expect(result!.indexedFilters[0]).toEqual({ field: 'thread_id', value: 'thread-1' });
      expect(result!.indexedFilters[1]).toEqual({ field: 'createdAt', value: '2024-01-01' });
    });

    it('should match by_resource for resourceId filter', () => {
      const result = findBestIndex('mastra_messages', [{ field: 'resourceId', value: 'res-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_resource');
    });

    it('should match by_record_id for id filter', () => {
      const result = findBestIndex('mastra_messages', [{ field: 'id', value: 'msg-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_record_id');
    });

    it('should use thread_id index when combined with non-indexed field', () => {
      const result = findBestIndex('mastra_messages', [
        { field: 'thread_id', value: 'thread-1' },
        { field: 'role', value: 'user' },
      ]);
      expect(result).not.toBeNull();
      expect(['by_thread', 'by_thread_created']).toContain(result!.indexName);
      expect(result!.indexedFilters).toEqual([{ field: 'thread_id', value: 'thread-1' }]);
    });
  });

  describe('mastra_threads', () => {
    it('should match by_resource for resourceId filter', () => {
      const result = findBestIndex('mastra_threads', [{ field: 'resourceId', value: 'res-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_resource');
    });

    it('should match by_record_id for id filter', () => {
      const result = findBestIndex('mastra_threads', [{ field: 'id', value: 'thread-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_record_id');
    });
  });

  describe('mastra_workflow_snapshots', () => {
    it('should prefer by_workflow_run over by_workflow when both fields present', () => {
      const result = findBestIndex('mastra_workflow_snapshots', [
        { field: 'workflow_name', value: 'my-workflow' },
        { field: 'run_id', value: 'run-1' },
      ]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_workflow_run');
      expect(result!.indexedFilters).toHaveLength(2);
    });

    it('should use workflow_name index for workflow_name only', () => {
      const result = findBestIndex('mastra_workflow_snapshots', [{ field: 'workflow_name', value: 'my-workflow' }]);
      expect(result).not.toBeNull();
      // by_workflow_run and by_workflow both match with prefix length 1; either is correct
      expect(['by_workflow', 'by_workflow_run']).toContain(result!.indexName);
      expect(result!.indexedFilters).toEqual([{ field: 'workflow_name', value: 'my-workflow' }]);
    });

    it('should return null for run_id only (not a prefix of any index)', () => {
      const result = findBestIndex('mastra_workflow_snapshots', [{ field: 'run_id', value: 'run-1' }]);
      // run_id is never the first field in any index
      expect(result).toBeNull();
    });
  });

  describe('mastra_scorers', () => {
    it('should match by_scorer for scorerId filter', () => {
      const result = findBestIndex('mastra_scorers', [{ field: 'scorerId', value: 'scorer-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_scorer');
    });

    it('should prefer by_entity for entityId + entityType', () => {
      const result = findBestIndex('mastra_scorers', [
        { field: 'entityId', value: 'entity-1' },
        { field: 'entityType', value: 'agent' },
      ]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_entity');
      expect(result!.indexedFilters).toHaveLength(2);
    });

    it('should match by_entity for entityId only (prefix of composite)', () => {
      const result = findBestIndex('mastra_scorers', [{ field: 'entityId', value: 'entity-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_entity');
      expect(result!.indexedFilters).toHaveLength(1);
    });

    it('should match by_run for runId filter', () => {
      const result = findBestIndex('mastra_scorers', [{ field: 'runId', value: 'run-1' }]);
      expect(result).not.toBeNull();
      expect(result!.indexName).toBe('by_run');
    });
  });

  describe('edge cases', () => {
    it('should return null for empty filters', () => {
      const result = findBestIndex('mastra_messages', []);
      expect(result).toBeNull();
    });

    it('should return null for unknown table', () => {
      const result = findBestIndex('unknown_table', [{ field: 'id', value: '1' }]);
      expect(result).toBeNull();
    });

    it('should return null when no filter matches any index prefix', () => {
      const result = findBestIndex('mastra_messages', [{ field: 'nonexistent_field', value: 'val' }]);
      expect(result).toBeNull();
    });

    it('should not match composite index when only second field is filtered', () => {
      // by_thread_created has fields: [thread_id, createdAt]
      // Filtering only by createdAt should NOT match by_thread_created (not a prefix)
      const result = findBestIndex('mastra_messages', [{ field: 'createdAt', value: '2024-01-01' }]);
      // Should not be by_thread_created
      expect(result).toBeNull();
    });

    it('should handle duplicate filter fields gracefully', () => {
      const result = findBestIndex('mastra_messages', [
        { field: 'thread_id', value: 'thread-1' },
        { field: 'thread_id', value: 'thread-2' },
      ]);
      expect(result).not.toBeNull();
      expect(['by_thread', 'by_thread_created']).toContain(result!.indexName);
    });
  });

  describe('TABLE_INDEX_MAP sync with schema', () => {
    it('should have entries for all typed tables', () => {
      expect(TABLE_INDEX_MAP).toHaveProperty('mastra_messages');
      expect(TABLE_INDEX_MAP).toHaveProperty('mastra_threads');
      expect(TABLE_INDEX_MAP).toHaveProperty('mastra_resources');
      expect(TABLE_INDEX_MAP).toHaveProperty('mastra_workflow_snapshots');
      expect(TABLE_INDEX_MAP).toHaveProperty('mastra_scorers');
      expect(TABLE_INDEX_MAP).toHaveProperty('mastra_vector_indexes');
    });

    it('mastra_messages indexes should include by_thread and by_thread_created', () => {
      const names = TABLE_INDEX_MAP['mastra_messages']!.map(i => i.name);
      expect(names).toContain('by_thread');
      expect(names).toContain('by_thread_created');
      expect(names).toContain('by_resource');
      expect(names).toContain('by_record_id');
    });

    it('composite indexes should list fields in correct order', () => {
      const threadCreated = TABLE_INDEX_MAP['mastra_messages']!.find(i => i.name === 'by_thread_created');
      expect(threadCreated!.fields).toEqual(['thread_id', 'createdAt']);

      const workflowRun = TABLE_INDEX_MAP['mastra_workflow_snapshots']!.find(i => i.name === 'by_workflow_run');
      expect(workflowRun!.fields).toEqual(['workflow_name', 'run_id']);

      const entity = TABLE_INDEX_MAP['mastra_scorers']!.find(i => i.name === 'by_entity');
      expect(entity!.fields).toEqual(['entityId', 'entityType']);
    });
  });
});
