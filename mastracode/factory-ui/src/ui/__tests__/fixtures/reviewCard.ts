import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/base';
import type { FactoryDecisionSummary } from '../../domains/factory/services/decisions';
import type { GithubPullRequest } from '../../domains/factory/services/factory';

export const reviewCandidate: GithubPullRequest = {
  number: 42,
  title: 'Add rate limiting',
  url: 'https://github.com/acme/app/pull/42',
  author: 'octocat',
  baseBranch: 'main',
  headBranch: 'rate-limiting',
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
};

export const reviewItem: WorkItemRow = {
  id: 'review-item',
  orgId: 'org-1',
  factoryProjectId: 'fp-1',
  board: 'review',
  externalSource: {
    integrationId: 'github',
    type: 'pull-request',
    externalId: 'github-pr:42',
    url: reviewCandidate.url,
  },
  claimKey: null,
  parentWorkItemId: null,
  title: reviewCandidate.title,
  stages: ['intake'],
  stageHistory: [],
  sessions: {},
  metadata: { number: 42, state: 'open' },
  triageType: null,
  autonomyArmedAt: null,
  plansPreapprovedAt: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdBy: 'user-1',
  createdAt: new Date(reviewCandidate.createdAt),
  updatedAt: new Date(reviewCandidate.updatedAt),
};

export const reviewDecision: FactoryDecisionSummary = {
  id: 'review-decision',
  evaluationId: 'review-evaluation',
  workItemId: reviewItem.id,
  type: 'invokeSkill',
  role: 'review',
  source: null,
  status: 'pending',
  attempts: 0,
  failureOccurrence: 0,
  failureCode: null,
  canRetry: false,
  lastError: null,
  createdAt: reviewCandidate.createdAt,
  updatedAt: reviewCandidate.updatedAt,
  completedAt: null,
};
