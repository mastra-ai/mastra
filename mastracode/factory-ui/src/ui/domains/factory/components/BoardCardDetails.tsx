import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useGitHubIssueDetail, useGitHubPullRequestDetail } from '../../../../hooks/useFactoryData';
import { useLinearIssueDetail } from '../../../../hooks/useLinearData';
import { githubNumberForItem, linearIdentifierForItem } from '../boardItems';
import type { WorkItem } from '../services/workItems';

/** Which of the card's sources carries a description we can fetch, if any. */
function descriptionSource(item: Pick<WorkItem, 'source' | 'metadata'>): 'issue' | 'pull' | 'linear' | undefined {
  if (githubNumberForItem(item) !== undefined) {
    if (item.source === 'github-issue') return 'issue';
    if (item.source === 'github-pr') return 'pull';
  }
  if (linearIdentifierForItem(item) !== undefined) return 'linear';
  return undefined;
}

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
  const source = descriptionSource(item);
  const issue = useGitHubIssueDetail(
    source === 'issue' ? projectRepositoryId : undefined,
    source === 'issue' ? number : undefined,
  );
  const pull = useGitHubPullRequestDetail(
    source === 'pull' ? projectRepositoryId : undefined,
    source === 'pull' ? number : undefined,
  );
  const linear = useLinearIssueDetail(
    source === 'linear' ? factoryProjectId : undefined,
    source === 'linear' ? identifier : undefined,
  );

  const query = source === undefined ? undefined : { issue, pull, linear }[source];
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
