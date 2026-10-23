import type { WorkItem } from './workItems';
import { isPullRequestSource } from './workItems';

/**
 * The plain external link a session header shows for a card. Pull and merge
 * requests are left to the review-specific link, which also carries status.
 */
export function genericExternalWorkItemUrl(item: Pick<WorkItem, 'source' | 'url'>): string | undefined {
  return isPullRequestSource(item.source) ? undefined : (item.url ?? undefined);
}
