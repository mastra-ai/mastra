import type { ActiveThreadRow, ResourceThreadsRow } from '@mastra/react/hooks/metrics';
import type { DrilldownScope } from '../../drilldown';

export type MemoryTab = 'threads' | 'resources';

export function isMemoryTab(value: string): value is MemoryTab {
  return value === 'threads' || value === 'resources';
}

// IDs are usually 32+ char UUIDs; the table is too narrow to show the full
// value without horizontal scroll, so we elide the middle.
export function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function threadScope(row: ActiveThreadRow): DrilldownScope {
  return row.resourceId ? { threadId: row.threadId, resourceId: row.resourceId } : { threadId: row.threadId };
}

export function resourceScope(row: ResourceThreadsRow): DrilldownScope {
  return { resourceId: row.resourceId };
}
