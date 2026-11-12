import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { hasEveryLabel, metadataLabels } from '@mastra/factory/work-items/card-labels';
import { matchesPeople, providerPeople } from '@mastra/factory/work-items/card-people';
import type { ProviderPerson } from '@mastra/factory/work-items/card-people';
import { matchesSourceFilters } from '@mastra/factory/work-items/card-source-filters';
import { hasEveryWord } from '@mastra/factory/work-items/search-words';
import { relativeTime } from '../../../lib/date/relativeTime';
import type { BoardFilterState } from './boardFilters';
import { githubSourceKey, hasLabel, workItemKey } from './boardItems';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { GitLabIssue, GitLabMergeRequest } from './services/gitlab';
import type { IncidentioIssue } from './services/incidentio';
import type { JiraIssue } from './services/jira';
import type { LinearIssue } from './services/linear';
import { isPullRequestSource } from './services/workItems';
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
  /** Retries only the failed provider in a combined feed. */
  retryFailed?: () => unknown;
}

/** A live GitHub/Linear issue or PR that has not been materialized as a work item. */
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

export function linearCandidate(issue: LinearIssue): BoardCandidate {
  return {
    sourceKey: `linear:${issue.identifier}`,
    source: 'linear-issue',
    title: issue.title,
    url: issue.url,
    meta: [issue.identifier, issue.state, ...(issue.assignee ? [issue.assignee] : [])],
    column: 'intake',
    metadata: {
      linearIssueId: issue.id,
      ...(issue.projectId ? { linearProjectId: issue.projectId } : {}),
      identifier: issue.identifier,
      state: issue.state,
      assignee: issue.assignee,
      creator: issue.creator ?? null,
      labels: issue.labels,
    },
  };
}

export function jiraCandidate(issue: JiraIssue): BoardCandidate {
  return {
    sourceKey: issue.id,
    source: 'jira-issue',
    title: issue.title,
    url: issue.url,
    meta: [issue.identifier, issue.state, ...(issue.assignee ? [issue.assignee] : [])],
    column: 'intake',
    metadata: {
      identifier: issue.identifier,
      issueRef: issue.id,
      state: issue.state,
      stateType: issue.stateType,
      priority: issue.priorityLabel,
      project: issue.project,
      site: issue.site ?? null,
      assignee: issue.assignee,
      assignees: issue.assignee ? [issue.assignee] : [],
      creator: issue.author ?? null,
      author: issue.author ?? null,
      labels: issue.labels,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    },
  };
}

export function incidentioCandidate(issue: IncidentioIssue): BoardCandidate {
  return {
    sourceKey: issue.id,
    source: 'incidentio-follow-up',
    title: issue.title,
    url: issue.url,
    meta: [issue.identifier, issue.state, ...(issue.assignee ? [issue.assignee] : [])],
    column: 'intake',
    metadata: {
      identifier: issue.identifier,
      issueRef: issue.id,
      state: issue.state,
      stateType: issue.stateType,
      priority: issue.priorityLabel,
      incident: issue.incident,
      assignee: issue.assignee,
      assignees: issue.assignee ? [issue.assignee] : [],
      creator: issue.author ?? null,
      author: issue.author ?? null,
      labels: issue.labels,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    },
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
