import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { hasEveryLabel, metadataLabels } from '@mastra/factory/work-items/card-labels';
import { matchesPeople, providerPeople } from '@mastra/factory/work-items/card-people';
import type { ProviderPerson } from '@mastra/factory/work-items/card-people';
import { matchesSourceFilters } from '@mastra/factory/work-items/card-source-filters';
import { hasEveryWord } from '@mastra/factory/work-items/search-words';
import type { IntakeCandidateInfo } from '../../../api/types';
import { relativeTime } from '../../../lib/date/relativeTime';
import type { BoardFilterState } from './boardFilters';
import { githubSourceKey, hasLabel, workItemKey } from './boardItems';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { GitLabIssue, GitLabMergeRequest } from './services/gitlab';
import { isPullRequestSource, sourceFromExternalSource } from './services/workItems';
import type { WorkItemSource } from './services/workItems';
import type { BoardStageId } from './stages';

const NOBODY: ReadonlySet<string> = new Set();

function participantIds(people: readonly ProviderPerson[]): ReadonlySet<string> {
  return new Set(people.map(person => person.id));
}

export type IntakeSource = 'github' | 'github-prs' | 'gitlab-prs' | 'gitlab' | 'linear' | 'jira' | 'incidentio';

/** What a candidate feed exposes to the column rendering it. */
export interface IntakeFeed {
  error: Error | null;
  /** Set when the failure came from paging, not from the stored pages. */
  isFetchNextPageError?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
  /** The server could not read a source on its last pass, so the list is what it read before. */
  stale?: boolean;
}

/** An open issue or pull request that has no card yet. */
export interface BoardCandidate {
  sourceKey: string;
  source: WorkItemSource;
  title: string;
  url: string;
  /** Meta fields under the title, e.g. `#12`, `alice`, and `opened 3 days ago`. */
  meta: readonly string[];
  /** Column the candidate is offered in: everything starts in Intake (auto-triaged issues in Triage). */
  column: BoardStageId;
  metadata: Record<string, unknown>;
}

export function issueCandidate(issue: GithubIssue): BoardCandidate {
  const labels = issue.labels;
  return {
    sourceKey: githubSourceKey('issue', issue.number, issue.repositoryId),
    source: 'github-issue',
    title: issue.title,
    url: issue.url,
    meta: [`#${issue.number}`, ...(issue.author ? [issue.author] : []), relativeTime(issue.createdAt)],
    column: hasLabel(labels, AUTO_TRIAGED_LABEL) ? 'triage' : 'intake',
    metadata: {
      number: issue.number,
      ...(issue.repositoryId !== undefined ? { githubRepositoryId: issue.repositoryId } : {}),
      author: issue.author,
      assignee: issue.assignee,
      assignees: issue.assignees ?? (issue.assignee ? [issue.assignee] : []),
      labels,
    },
  };
}

export function pullRequestCandidate(pr: GithubPullRequest): BoardCandidate {
  return {
    sourceKey: githubSourceKey('pull-request', pr.number, pr.repositoryId),
    source: 'github-pr',
    title: pr.title,
    url: pr.url,
    meta: [`#${pr.number}`, ...(pr.author ? [pr.author] : []), `${pr.headBranch} → ${pr.baseBranch}`],
    column: 'intake',
    metadata: {
      number: pr.number,
      ...(pr.repositoryId !== undefined ? { githubRepositoryId: pr.repositoryId } : {}),
      author: pr.author,
      assignees: pr.assignees ?? [],
      requestedReviewers: pr.requestedReviewers ?? [],
      labels: pr.labels ?? [],
      headBranch: pr.headBranch,
      baseBranch: pr.baseBranch,
    },
  };
}

export function gitlabCandidate(issue: GitLabIssue): BoardCandidate {
  return {
    sourceKey: issue.externalId,
    source: 'gitlab-issue',
    title: issue.title,
    url: issue.url,
    meta: [issue.identifier, issue.state, ...(issue.assignee ? [issue.assignee] : [])],
    column: 'intake',
    metadata: {
      gitlabIssueId: issue.id,
      identifier: issue.identifier,
      state: issue.state,
      assignee: issue.assignee,
      assignees: issue.assignees ?? [],
      author: issue.author,
      sourceId: issue.sourceId,
      labels: issue.labels,
      labelColors: issue.labelColors ?? {},
      sourceCreatedAt: issue.createdAt,
    },
  };
}

export function gitlabMergeRequestCandidate(pr: GitLabMergeRequest): BoardCandidate {
  return {
    sourceKey: pr.externalId,
    source: 'gitlab-pr',
    title: pr.title,
    url: pr.url,
    meta: [`!${pr.number}`, ...(pr.author ? [pr.author] : []), `${pr.headBranch} → ${pr.baseBranch}`],
    column: 'intake',
    metadata: {
      gitlabMergeRequestIid: pr.number,
      author: pr.author,
      assignees: pr.assignees,
      requestedReviewers: pr.requestedReviewers,
      labels: pr.labels ?? [],
      headBranch: pr.headBranch,
      baseBranch: pr.baseBranch,
    },
  };
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** The fields under a candidate's title, from the facts the server keeps for its record. */
function candidateMeta(source: WorkItemSource, record: IntakeCandidateInfo): string[] {
  const { metadata } = record;
  const author = record.author ? [record.author] : [];
  const branches = `${text(metadata.headBranch) ?? ''} → ${text(metadata.baseBranch) ?? ''}`;
  if (source === 'github-issue') return [`#${String(metadata.number)}`, ...author, relativeTime(record.createdAt)];
  if (source === 'github-pr') return [`#${String(metadata.number)}`, ...author, branches];
  if (source === 'gitlab-pr') return [`!${String(metadata.gitlabMergeRequestIid)}`, ...author, branches];
  const assignee = text(metadata.assignee);
  return [
    ...[text(metadata.identifier) ?? record.key, record.state].flatMap(field => field ?? []),
    ...(assignee ? [assignee] : []),
  ];
}

/**
 * A record the server offers for filing. Its source key is the id the server holds the record
 * under, so the card filed from it takes over that record instead of becoming a second one.
 */
export function intakeCandidate(record: IntakeCandidateInfo): BoardCandidate | undefined {
  const source = sourceFromExternalSource(record.externalSource);
  if (source === 'manual' || source === 'slack-thread') return undefined;
  return {
    sourceKey: record.externalSource.externalId,
    source,
    title: record.title,
    url: record.url ?? '',
    meta: candidateMeta(source, record),
    column: source === 'github-issue' && hasLabel(record.labels, AUTO_TRIAGED_LABEL) ? 'triage' : 'intake',
    metadata: record.metadata,
  };
}

/**
 * Whether a board view keeps an issue not filed yet, by the rules the server lists cards with.
 * `filters` names people by every id they go by, as the server is asked.
 */
export function candidateMatchesView(
  candidate: BoardCandidate,
  filters: BoardFilterState,
  words: readonly string[],
): boolean {
  const people = providerPeople(candidate);
  const relations = {
    worked: NOBODY,
    authored: participantIds(people.authored),
    assigned: participantIds(people.assigned),
    'review-requested': participantIds(people['review-requested']),
  };
  return (
    matchesPeople(relations, filters) &&
    hasEveryLabel(new Set(metadataLabels(candidate.metadata)), filters.label) &&
    matchesSourceFilters({ ...candidate, hasPullRequest: isPullRequestSource(candidate.source) }, filters) &&
    hasEveryWord(`${candidate.title} ${workItemKey(candidate) ?? ''}`.toLowerCase(), words)
  );
}
