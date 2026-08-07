import type { WorkItem } from './workItems';

export function genericExternalWorkItemUrl(item: Pick<WorkItem, 'source' | 'url'>): string | undefined {
  return item.source === 'github-pr' ? undefined : (item.url ?? undefined);
}
