import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useGitHubIssueDetail, useGitHubPullRequestDetail } from '../../../../hooks/useFactoryData';
import { useGitLabIssueDetail, useGitLabMergeRequestDetail } from '../../../../hooks/useGitLabData';
import { useIncidentioIssueDetail } from '../../../../hooks/useIncidentioData';
import { useJiraIssueDetail } from '../../../../hooks/useJiraData';
import { useLinearIssueDetail } from '../../../../hooks/useLinearData';
import {
  githubNumberForItem,
  incidentioIssueRefForItem,
  jiraIdentifierForItem,
  jiraIssueRefForItem,
  linearIdentifierForItem,
  linearIssueIdForItem,
} from '../boardItems';
import type { WorkItem } from '../services/workItems';

/** The card's source and metadata — a work item or an unfiled candidate. */
type SourceItem = Pick<WorkItem, 'source' | 'sourceKey' | 'metadata'>;

function descriptionSource(
  item: SourceItem,
): 'issue' | 'pull' | 'gitlab' | 'gitlab-pr' | 'linear' | 'jira' | 'incidentio' | undefined {
  if (githubNumberForItem(item) !== undefined) {
    if (item.source === 'github-issue') return 'issue';
    if (item.source === 'github-pr') return 'pull';
  }
  if (item.source === 'gitlab-issue' && item.sourceKey) return 'gitlab';
  if (item.source === 'gitlab-pr' && typeof item.metadata.gitlabMergeRequestIid === 'number') return 'gitlab-pr';
  if (linearIdentifierForItem(item) !== undefined) return 'linear';
  if (jiraIdentifierForItem(item) !== undefined && jiraIssueRefForItem(item) !== undefined) return 'jira';
  if (incidentioIssueRefForItem(item) !== undefined) return 'incidentio';
  return undefined;
}

/** The body behind the card; undefined for sources with none to fetch (manual, Slack). */
export function useSourceDescription(
  item: SourceItem,
  projectRepositoryId: string | undefined,
  factoryProjectId: string | undefined,
) {
  const number = githubNumberForItem(item);
  const identifier = linearIdentifierForItem(item);
  const linearIssueId = linearIssueIdForItem(item);
  const jiraIdentifier = jiraIdentifierForItem(item);
  const jiraIssueRef = jiraIssueRefForItem(item);
  const incidentioIssueRef = incidentioIssueRefForItem(item);
  const gitlabIssueId = item.source === 'gitlab-issue' ? (item.sourceKey ?? undefined) : undefined;
  const source = descriptionSource(item);
  const issue = useGitHubIssueDetail(
    source === 'issue' ? projectRepositoryId : undefined,
    source === 'issue' ? number : undefined,
  );
  const pull = useGitHubPullRequestDetail(
    source === 'pull' ? projectRepositoryId : undefined,
    source === 'pull' ? number : undefined,
  );
  const gitlab = useGitLabIssueDetail(
    source === 'gitlab' ? factoryProjectId : undefined,
    source === 'gitlab' ? gitlabIssueId : undefined,
  );
  const gitlabPull = useGitLabMergeRequestDetail(
    source === 'gitlab-pr' ? factoryProjectId : undefined,
    source === 'gitlab-pr' ? projectRepositoryId : undefined,
    source === 'gitlab-pr' ? (item.metadata.gitlabMergeRequestIid as number) : undefined,
  );
  const linear = useLinearIssueDetail(
    source === 'linear' ? factoryProjectId : undefined,
    source === 'linear' ? identifier : undefined,
    source === 'linear' ? linearIssueId : undefined,
  );
  const jira = useJiraIssueDetail(
    source === 'jira' ? factoryProjectId : undefined,
    source === 'jira' ? jiraIdentifier : undefined,
    source === 'jira' ? jiraIssueRef : undefined,
  );
  const incidentio = useIncidentioIssueDetail(
    source === 'incidentio' ? factoryProjectId : undefined,
    source === 'incidentio' ? incidentioIssueRef : undefined,
  );
  return source === undefined
    ? undefined
    : { issue, pull, gitlab, 'gitlab-pr': gitlabPull, linear, jira, incidentio }[source];
}

export function CardSourceDescription({
  item,
  projectRepositoryId,
  factoryProjectId,
}: {
  item: SourceItem;
  projectRepositoryId: string | undefined;
  factoryProjectId: string | undefined;
}) {
  const query = useSourceDescription(item, projectRepositoryId, factoryProjectId);
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
    return <p className="text-meta text-icon3 m-0">The description could not be loaded.</p>;
  }
  const description = query.data?.description ?? null;
  if (description === null || description.trim() === '') return null;
  return (
    <MarkdownRenderer className="text-caption text-icon5 max-w-none [&>*:first-child]:mt-0">
      {description}
    </MarkdownRenderer>
  );
}
