import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useGitHubIssueDetail, useGitHubPullRequestDetail } from '../../../../hooks/useFactoryData';
import { useLinearIssueDetail } from '../../../../hooks/useLinearData';
import { githubNumberForItem, linearIdentifierForItem } from '../boardItems';
import type { WorkItem } from '../services/workItems';

/**
 * The source's own description for a card's detail view — fetched on demand,
 * rendered as the markdown it was authored in. Sources without a fetchable
 * body (manual, Slack) render nothing rather than a placeholder.
 */
export function CardSourceDescription({
  item,
  projectRepositoryId,
  factoryProjectId,
}: {
  /** The card's source and metadata — a work item or an unfiled candidate. */
  item: Pick<WorkItem, 'source' | 'metadata'>;
  projectRepositoryId: string | undefined;
  factoryProjectId: string | undefined;
}) {
  const number = githubNumberForItem(item);
  const identifier = linearIdentifierForItem(item);
  const isIssue = item.source === 'github-issue' && number !== undefined;
  const isPull = item.source === 'github-pr' && number !== undefined;
  const issue = useGitHubIssueDetail(isIssue ? projectRepositoryId : undefined, isIssue ? number : undefined);
  const pull = useGitHubPullRequestDetail(isPull ? projectRepositoryId : undefined, isPull ? number : undefined);
  const linear = useLinearIssueDetail(factoryProjectId, identifier);

  const query = isIssue ? issue : isPull ? pull : identifier === undefined ? undefined : linear;
  if (query === undefined) return null;

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
