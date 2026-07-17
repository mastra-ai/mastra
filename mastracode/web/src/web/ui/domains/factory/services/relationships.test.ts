import { describe, expect, it } from 'vitest';

import { inferredParentWorkItemId, relatedWorkItems } from './relationships';
import type { WorkItem } from './workItems';

function workItem(overrides: Partial<WorkItem> & Pick<WorkItem, 'id' | 'source'>): WorkItem {
  const { id, source, ...rest } = overrides;
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    source,
    sourceKey: null,
    parentWorkItemId: null,
    title: id,
    url: null,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    ...rest,
  };
}

describe('Factory work item relationships', () => {
  it('given a Factory PR head branch and its issue session, when the explicit relation is missing, then it resolves both sides', () => {
    const issue = workItem({
      id: 'issue-24',
      source: 'github-issue',
      sessions: {
        work: {
          projectPath: '/worktrees/factory-issue-24',
          branch: 'factory/issue-24',
          threadId: 'thread-issue-24',
          startedBy: 'user-1',
        },
      },
    });
    const review = workItem({
      id: 'pr-25',
      source: 'github-pr',
      metadata: { headBranch: 'factory/issue-24', number: 25 },
    });

    expect(relatedWorkItems(review, [review, issue])).toEqual([issue]);
    expect(relatedWorkItems(issue, [review, issue])).toEqual([review]);
    expect(inferredParentWorkItemId(review.metadata, [review, issue])).toBe(issue.id);
  });

  it('given an unrelated PR branch, when relationships resolve, then it remains unrelated', () => {
    const issue = workItem({
      id: 'issue-24',
      source: 'github-issue',
      sessions: {
        work: {
          projectPath: '/worktrees/factory-issue-24',
          branch: 'factory/issue-24',
          threadId: 'thread-issue-24',
          startedBy: 'user-1',
        },
      },
    });
    const review = workItem({
      id: 'pr-25',
      source: 'github-pr',
      metadata: { headBranch: 'feature/unrelated', number: 25 },
    });

    expect(relatedWorkItems(review, [review, issue])).toEqual([]);
    expect(inferredParentWorkItemId(review.metadata, [review, issue])).toBeUndefined();
  });
});
