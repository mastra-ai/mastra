import type { Card } from '@mastra/factory';
import type { IntakeCandidateInfo } from '../../../api/types';

import { recordOfGithubIssue } from './intakeCandidates';

/** The id of the card titled `Large task <index>`. */
export function largeCardId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

export function largeBoard(count: number, factoryProjectId = 'fp-1'): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    workItemId: `work-large-${index}`,
    parentBoardItemId: null,
    workItem: {
      sources: [],
      id: `work-large-${index}`,
      orgId: 'org-1',
      factoryProjectId,
      provider: 'factory',
      externalId: `large-${index}`,
      key: `large-${index}`.slice(0, 8),
      url: null,
      title: `Large task ${index}`,
      state: 'open',
      labels: [],
      author: null,
      parentWorkItemId: null,
      metadata: null,
      revision: 1,
      syncedAt: null,
      createdAt: new Date(Date.UTC(2026, 6, 18, 0, index)),
      updatedAt: new Date(Date.UTC(2026, 6, 18, 0, index)),
    },
    id: largeCardId(index),
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title: `Large task ${index}`,
    stages: ['triage'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    autonomyArmedAt: null,
    description: null,
    revision: 1,
    createdAt: new Date(Date.UTC(2026, 6, 18, 0, index)),
    updatedAt: new Date(Date.UTC(2026, 6, 18, 0, index)),
  }));
}

/** Open GitHub issues with no card, as the server lists them. */
export function largeCandidates(count: number, start = 0): IntakeCandidateInfo[] {
  return Array.from({ length: count }, (_, offset) =>
    recordOfGithubIssue({
      number: start + offset + 1,
      title: `Candidate ${start + offset}`,
      url: `https://github.com/acme/app/issues/${start + offset + 1}`,
      author: 'alice',
      createdAt: '2026-08-01T00:00:00.000Z',
    }),
  );
}
