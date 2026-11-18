import { describe, expect, it } from 'vitest';

import {
  relatedCardName,
  relatedWorkItemIndex,
  relationshipLabel,
  relationshipPath,
  workItemReference,
  workItemShortReference,
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
    description: null,
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
  });

  it('links a GitLab MR back to its issue session and names it as a Review item', () => {
    const issue = workItem({
      id: 'gitlab-issue-1',
      source: 'gitlab-issue',
      sessions: {
        work: { sessionId: 'session-1', branch: 'feature/gitlab', threadId: 'thread-1', startedBy: 'user-1' },
      },
    });
    const review = workItem({
      id: 'gitlab-mr-5',
      source: 'gitlab-pr',
      metadata: { headBranch: 'feature/gitlab', gitlabMergeRequestIid: 5 },
    });
    expect(relatedWorkItemIndex([review, issue])(review)).toEqual([issue]);
    expect(relatedWorkItemIndex([review, issue])(issue)).toEqual([review]);
    expect(relationshipLabel(review)).toBe('Review: MR !5');
    expect(workItemReference(review)).toBe('MR !5');
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
    expect(workItemReference(review)).toBe('PR #202');
    expect(workItemReference(issue)).toBe('Issue #24');
    expect(relationshipLabel(linear)).toBe('Work item: ENG-24');
    expect(workItemReference(linear)).toBe('ENG-24');
  });

  it.each([
    { source: 'jira-issue', identifier: 'ENG-42', label: 'Work item: ENG-42' },
    { source: 'gitlab-issue', identifier: 'acme/app#7', label: 'Work item: Issue acme/app#7' },
    { source: 'incidentio-follow-up', identifier: 'INC-42', label: 'Work item: INC-42' },
  ] as const)('names a $source card by its key', ({ source, identifier, label }) => {
    const item = workItem({ id: `${source}-1`, source, metadata: { identifier } });

    expect(relationshipLabel(item)).toBe(label);
  });

  it.each([
    { source: 'github-issue', key: 'acme/app#42', inside: 'Issue #42', outside: 'Issue acme/app#42', short: 'app#42' },
    { source: 'github-pr', key: 'acme/app#42', inside: 'PR #42', outside: 'PR acme/app#42', short: 'app#42' },
    {
      source: 'gitlab-issue',
      key: 'group/sub/app#7',
      inside: 'Issue #7',
      outside: 'Issue group/sub/app#7',
      short: 'app#7',
    },
    { source: 'gitlab-pr', key: 'group/sub/app!7', inside: 'MR !7', outside: 'MR group/sub/app!7', short: 'app!7' },
  ] as const)(
    'drops the repository from a $source reference only inside that repository, and its owner from the short key',
    ({ source, key, inside, outside, short }) => {
      const item = workItem({
        id: `${source}-keyed`,
        source,
        workItem: {
          provider: 'github',
          key,
          url: null,
          title: key,
          state: 'open',
          labels: [],
          author: null,
          metadata: {},
        },
      });
      const repository = key.split(/[#!]/)[0];

      expect(workItemReference(item, repository.toUpperCase())).toBe(inside);
      expect(workItemReference(item, 'acme/other')).toBe(outside);
      expect(workItemReference(item)).toBe(outside);
      expect(workItemShortReference(item)).toBe(short);
    },
  );

  it('keeps keys that name no repository, and gives a card without an identifier no reference', () => {
    expect(
      workItemReference(
        workItem({ id: 'linear', source: 'linear-issue', metadata: { identifier: 'ENG-1' } }),
        'acme/app',
      ),
    ).toBe('ENG-1');
    expect(workItemReference(workItem({ id: 'card', source: 'manual', metadata: { cardNumber: 5 } }), 'acme/app')).toBe(
      '#5',
    );
    expect(workItemReference(workItem({ id: 'pr', source: 'github-pr' }))).toBeUndefined();
    expect(workItemReference(workItem({ id: 'slack', source: 'slack-thread' }))).toBeUndefined();
  });

  it('names a related card by its reference and title, and by its title alone without an identifier', () => {
    const issue = workItem({ id: 'issue-4', source: 'github-issue', title: 'Fix login', metadata: { number: 4 } });
    const manual = workItem({ id: 'manual', source: 'manual', title: 'Fix login' });

    expect(relatedCardName(issue)).toBe('Work item: Issue #4: Fix login');
    expect(relatedCardName(manual)).toBe('Work item: Fix login');
  });

  it.each([
    { source: 'github-issue', sourceKey: 'github-issue:24', label: 'Work item: Issue #24' },
    { source: 'linear-issue', sourceKey: 'linear:ENG-24', label: 'Work item: ENG-24' },
  ] as const)('reads a $source key off its source key when metadata lost it', ({ source, sourceKey, label }) => {
    const item = workItem({ id: `${source}-legacy`, source, sourceKey });

    expect(relationshipLabel(item)).toBe(label);
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

describe('relationshipPath', () => {
  it('opens Work for a pull request card, whether filed there, stored before boards, or not filed yet', () => {
    const pullRequest = workItem({ id: 'pr', source: 'github-pr' });
    expect(relationshipPath({ ...pullRequest, board: 'work' }, 'f1')).toBe('/factories/f1/work');
    expect(relationshipPath({ ...pullRequest, board: null }, 'f1')).toBe('/factories/f1/work');
    expect(relationshipPath({ source: 'gitlab-pr' }, 'f1')).toBe('/factories/f1/work');
    expect(relationshipPath(workItem({ id: 'issue', source: 'github-issue' }), 'f1')).toBe('/factories/f1/work');
  });
});
