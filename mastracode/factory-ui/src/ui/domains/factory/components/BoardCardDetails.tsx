import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useGitHubIssueDetail, useGitHubPullRequestDetail } from '../../../../hooks/useFactoryData';
import type { WorkItemSource } from '../services/workItems';

/**
 * The source's own description for a card's detail view — fetched on demand,
 * rendered as the markdown it was authored in. Sources without a fetchable
 * body (manual, Slack, Linear until it grows a detail route) render nothing
 * rather than a placeholder.
 */
export function CardSourceDescription({
  source,
  projectRepositoryId,
  number,
}: {
  source: WorkItemSource;
  projectRepositoryId: string | undefined;
  number: number | undefined;
}) {
  const isIssue = source === 'github-issue' && number !== undefined;
  const isPull = source === 'github-pr' && number !== undefined;
  const issue = useGitHubIssueDetail(isIssue ? projectRepositoryId : undefined, isIssue ? number : undefined);
  const pull = useGitHubPullRequestDetail(isPull ? projectRepositoryId : undefined, isPull ? number : undefined);

  if (!isIssue && !isPull) return null;
  const query = isIssue ? issue : pull;

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-1.5" aria-hidden>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }
  if (query.isError) {
    return <p className="text-ui-xs text-icon3 m-0">The description could not be loaded.</p>;
  }
  const description = query.data?.description ?? null;
  if (description === null || description.trim() === '') return null;
  return (
    <MarkdownRenderer className="text-ui-sm text-icon5 max-w-none [&>*:first-child]:mt-0">
      {description}
    </MarkdownRenderer>
  );
}
