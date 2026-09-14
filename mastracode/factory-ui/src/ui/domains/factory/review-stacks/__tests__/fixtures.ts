import type { WorkItemRow } from '@mastra/factory';
import { pullRequestCandidate } from '../../boardCandidates';
import type { GithubPullRequest } from '../../services/factory';
import type { WorkItem } from '../../services/workItems';

export function pullRequest(number: number, baseBranch = 'main', repository = 'acme/app'): GithubPullRequest {
  return {
    number,
    title: `Pull request ${number}`,
    url: `https://github.com/${repository}/pull/${number}`,
    author: 'alice',
    assignees: [],
    requestedReviewers: [],
    baseBranch,
    headBranch: `feature-${number}`,
    createdAt: '2026-09-14T08:00:00.000Z',
    updatedAt: '2026-09-14T08:00:00.000Z',
  };
}

export function reviewWorkItem(pr: GithubPullRequest, stages = ['review']): WorkItem {
  const candidate = pullRequestCandidate(pr);
  return {
    id: `pr-${pr.number}`,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'fp-1',
    board: 'review',
    source: candidate.source,
    sourceKey: candidate.sourceKey,
    parentWorkItemId: null,
    title: pr.title,
    url: pr.url,
    stages,
    stageHistory: [],
    sessions: {},
    metadata: { ...candidate.metadata, state: 'open' },
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
  };
}

export function wireWorkItem(item: WorkItem): WorkItemRow {
  const { githubProjectId, source: _source, sourceKey, url, ...rest } = item;
  return {
    ...rest,
    board: item.board ?? 'review',
    stageHistory: [],
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    acceptedAt: null,
    feedActivityAt: null,
    autonomyArmedAt: null,
    plansPreapprovedAt: null,
    factoryProjectId: githubProjectId,
    externalSource: {
      integrationId: 'github',
      type: 'pull-request',
      externalId: sourceKey ?? item.id,
      ...(url ? { url } : {}),
    },
  };
}
