/**
 * Index definitions for automatic query optimization.
 *
 * Maps each typed Convex table to its available indexes and their field lists.
 * Indexes with more fields are listed first so the best (most specific) match
 * is preferred during selection.
 *
 * These must stay in sync with the index definitions in schema.ts.
 */
import type { EqualityFilter } from '../storage/types';

export const TABLE_INDEX_MAP: Record<string, Array<{ name: string; fields: string[] }>> = {
  mastra_messages: [
    { name: 'by_thread_created', fields: ['thread_id', 'createdAt'] },
    { name: 'by_thread', fields: ['thread_id'] },
    { name: 'by_resource', fields: ['resourceId'] },
    { name: 'by_record_id', fields: ['id'] },
  ],
  mastra_threads: [
    { name: 'by_resource', fields: ['resourceId'] },
    { name: 'by_created', fields: ['createdAt'] },
    { name: 'by_updated', fields: ['updatedAt'] },
    { name: 'by_record_id', fields: ['id'] },
  ],
  mastra_resources: [
    { name: 'by_updated', fields: ['updatedAt'] },
    { name: 'by_record_id', fields: ['id'] },
  ],
  mastra_workflow_snapshots: [
    { name: 'by_workflow_run', fields: ['workflow_name', 'run_id'] },
    { name: 'by_workflow', fields: ['workflow_name'] },
    { name: 'by_resource', fields: ['resourceId'] },
    { name: 'by_created', fields: ['createdAt'] },
    { name: 'by_record_id', fields: ['id'] },
  ],
  mastra_scorers: [
    { name: 'by_entity', fields: ['entityId', 'entityType'] },
    { name: 'by_scorer', fields: ['scorerId'] },
    { name: 'by_run', fields: ['runId'] },
    { name: 'by_created', fields: ['createdAt'] },
    { name: 'by_record_id', fields: ['id'] },
  ],
  mastra_vector_indexes: [
    { name: 'by_name', fields: ['indexName'] },
    { name: 'by_record_id', fields: ['id'] },
  ],
};

/**
 * Finds the best matching index for the given equality filters on a Convex table.
 *
 * Returns the index name and the subset of filters that form the index prefix,
 * or null when no index matches.
 *
 * The "best" index is the one whose prefix has the most consecutive fields
 * covered by the provided filters. For example, given filters for `thread_id`
 * and `createdAt` on mastra_messages, the composite `by_thread_created` index
 * (fields: [thread_id, createdAt]) is preferred over `by_thread` (fields: [thread_id]).
 */
export function findBestIndex(
  convexTable: string,
  filters: EqualityFilter[],
): { indexName: string; indexedFilters: EqualityFilter[] } | null {
  const indexes = TABLE_INDEX_MAP[convexTable];
  if (!indexes || filters.length === 0) return null;

  const filtersByField = new Map<string, EqualityFilter>();
  for (const f of filters) {
    filtersByField.set(f.field, f);
  }

  let best: { indexName: string; indexedFilters: EqualityFilter[]; prefixLength: number } | null = null;

  for (const index of indexes) {
    let prefixLength = 0;
    const indexedFilters: EqualityFilter[] = [];

    for (const field of index.fields) {
      const filter = filtersByField.get(field);
      if (filter) {
        prefixLength++;
        indexedFilters.push(filter);
      } else {
        break;
      }
    }

    if (prefixLength > 0 && (!best || prefixLength > best.prefixLength)) {
      best = { indexName: index.name, indexedFilters, prefixLength };
    }
  }

  return best ? { indexName: best.indexName, indexedFilters: best.indexedFilters } : null;
}
