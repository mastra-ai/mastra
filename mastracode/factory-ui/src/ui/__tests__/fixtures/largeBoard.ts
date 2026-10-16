import type { WorkItemRow } from '@mastra/factory';
import type { GithubIssuePage } from '../../domains/factory/services/factory';

export function largeBoard(count: number, factoryProjectId = 'fp-1'): WorkItemRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `large-${index}`,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
    board: 'work',
    externalSource: null,
    claimKey: null,
    parentWorkItemId: null,
    title: `Large task ${index}`,
    stages: ['triage'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    autonomyArmedAt: null,
    plansPreapprovedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: new Date(Date.UTC(2026, 6, 18, 0, index)),
    updatedAt: new Date(Date.UTC(2026, 6, 18, 0, index)),
  }));
}

export function largeCandidatePage(count: number, start = 0): GithubIssuePage {
  return {
    issues: Array.from({ length: count }, (_, offset) => ({
      number: start + offset + 1,
      title: `Candidate ${start + offset}`,
      url: `https://github.com/acme/app/issues/${start + offset + 1}`,
      author: 'alice',
      labels: [],
      comments: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    })),
    nextPage: null,
  };
}
