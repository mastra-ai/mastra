import { describe, expect, it } from 'vitest';

import {
  inferredParentWorkItemId,
  relatedWorkItemIndex,
  relationshipLabel,
  workItemReferenceLabel,
} from './relationships';
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
    triageType: null,
    acceptedAt: null,
    createdAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
    commentCount: 0,
    feedActivityAt: null,
    ...rest,
    revision: rest.revision ?? 1,
  };
}

describe('Factory work item relationships', () => {
  it('given a Factory PR head branch and its issue session, when the explicit relation is missing, then it resolves both sides', () => {
    const issue = workItem({
      id: 'issue-24',
      source: 'github-issue',
      sessions: {
        work: {
          sessionId: '/worktrees/factory-issue-24',
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

    expect(relatedWorkItemIndex([review, issue])(review)).toEqual([issue]);
    expect(relatedWorkItemIndex([review, issue])(issue)).toEqual([review]);
    expect(inferredParentWorkItemId(review.metadata, [review, issue])).toBe(issue.id);
  });

  it('given a review with an explicit parent, when another work item shares its branch, then branch inference does not add a second parent', () => {
    const explicitParent = workItem({ id: 'issue-24', source: 'github-issue' });
    const sameBranch = workItem({
      id: 'issue-25',
      source: 'github-issue',
      sessions: {
        work: {
          sessionId: '/worktrees/factory-shared',
          branch: 'factory/shared',
          threadId: 'thread-shared',
          startedBy: 'user-1',
        },
      },
    });
    const review = workItem({
      id: 'pr-26',
      source: 'github-pr',
      parentWorkItemId: explicitParent.id,
      metadata: { headBranch: 'factory/shared', number: 26 },
    });

    expect(relatedWorkItemIndex([review, explicitParent, sameBranch])(review)).toEqual([explicitParent]);
    expect(relatedWorkItemIndex([review, explicitParent, sameBranch])(sameBranch)).toEqual([]);
  });

  it('given an unrelated PR branch, when relationships resolve, then it remains unrelated', () => {
    const issue = workItem({
      id: 'issue-24',
      source: 'github-issue',
      sessions: {
        work: {
          sessionId: '/worktrees/factory-issue-24',
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

    expect(relatedWorkItemIndex([review, issue])(review)).toEqual([]);
    expect(inferredParentWorkItemId(review.metadata, [review, issue])).toBeUndefined();
  });

  it('uses source-specific relationship references', () => {
    const review = workItem({
      id: 'pr-202',
      source: 'github-pr',
      metadata: { githubPullRequestNumber: 202, number: 25 },
    });
    const issue = workItem({
      id: 'issue-24',
      source: 'github-issue',
      metadata: { githubIssueNumber: 24, number: 99 },
    });
    const linear = workItem({
      id: 'linear-24',
      source: 'linear-issue',
      metadata: { identifier: 'ENG-24' },
    });

    expect(relationshipLabel(review)).toBe('Review: PR #202');
    expect(relationshipLabel(issue)).toBe('Work item: Issue #24');
    expect(workItemReferenceLabel(review)).toBe('PR #202');
    expect(workItemReferenceLabel(issue)).toBe('Issue #24');
    expect(relationshipLabel(linear)).toBe('Work item: ENG-24');
    expect(workItemReferenceLabel(linear)).toBe('ENG-24');
  });
});

describe('related work item index', () => {
  it('given every way a card links to another, when resolving one board, then each card gets its links in board order', () => {
    const orphanBranch = workItem({
      id: 'issue-90',
      source: 'github-issue',
      sessions: {
        work: { sessionId: '/w/90', branch: 'factory/issue-90', threadId: 't-90', startedBy: 'u' },
      },
    });
    const byBranch = workItem({ id: 'pr-91', source: 'github-pr', metadata: { headBranch: 'factory/issue-90' } });
    const byChild = workItem({ id: 'issue-92', source: 'github-issue' });
    const childPr = workItem({ id: 'pr-93', source: 'github-pr', parentWorkItemId: 'issue-92' });
    const parentPr = workItem({ id: 'pr-94', source: 'github-pr' });
    const byParent = workItem({ id: 'issue-95', source: 'github-issue', parentWorkItemId: 'pr-94' });
    const unrelated = workItem({ id: 'pr-96', source: 'github-pr', metadata: { headBranch: 'other/branch' } });
    // Linked through two different buckets, each sitting on a different side of the card:
    // whatever order the caller sorts on, board order has to survive the narrowing.
    const multiLinked = workItem({
      id: 'issue-97',
      source: 'github-issue',
      sessions: {
        work: { sessionId: '/w/97', branch: 'factory/issue-97', threadId: 't-97', startedBy: 'u' },
      },
    });
    const branchPr = workItem({ id: 'pr-98', source: 'github-pr', metadata: { headBranch: 'factory/issue-97' } });
    const childOfMultiLinked = workItem({ id: 'pr-99', source: 'github-pr', parentWorkItemId: 'issue-97' });
    const board = [
      orphanBranch,
      byBranch,
      byChild,
      childPr,
      parentPr,
      byParent,
      unrelated,
      branchPr,
      multiLinked,
      childOfMultiLinked,
    ];
    const relatedItemsFor = relatedWorkItemIndex(board);

    expect(relatedItemsFor(orphanBranch)).toEqual([byBranch]);
    expect(relatedItemsFor(byChild)).toEqual([childPr]);
    expect(relatedItemsFor(parentPr)).toEqual([byParent]);
    expect(relatedItemsFor(unrelated)).toEqual([]);
    // Board order decides, not the order the buckets are read in.
    expect(relatedItemsFor(multiLinked)).toEqual([branchPr, childOfMultiLinked]);
  });
});
