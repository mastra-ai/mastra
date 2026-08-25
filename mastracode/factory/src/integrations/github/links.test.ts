import { describe, expect, it } from 'vitest';

import type { WorkItemRow } from '../../storage/domains/work-items/base.js';
import { closingIssueNumbers, pullRequestLinkFacts, pullRequestParentWorkItemId } from './links.js';

function card(overrides: Partial<WorkItemRow> & Pick<WorkItemRow, 'id'>): WorkItemRow {
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    externalSource: null,
    parentWorkItemId: null,
    title: 'Card',
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: { githubRepositoryId: 10 },
    autonomyArmedAt: null,
    revision: 1,
    createdBy: 'user-1',
    createdAt: new Date('2030-01-01T00:00:00Z'),
    updatedAt: new Date('2030-01-01T00:00:00Z'),
    ...overrides,
  };
}

function issueCard(id: string, number: number, repository = 'acme/repo', repositoryId = 10): WorkItemRow {
  return card({
    id,
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: `github-issue:${number}`,
      url: `https://github.com/${repository}/issues/${number}`,
    },
    metadata: { githubRepositoryId: repositoryId },
  });
}

describe('closingIssueNumbers', () => {
  it('reads every closing keyword GitHub honours, once each', () => {
    const body = ['Closes #12', 'fixes #13', 'Resolved: #12', 'see #99'].join('\n');
    expect(closingIssueNumbers(body, 'acme/repo')).toEqual([12, 13]);
  });

  it('keeps references to this repository and drops the ones naming another', () => {
    const body = [
      'closes acme/repo#20',
      'closes other/repo#21',
      'fixes https://github.com/acme/repo/issues/22',
      'fixes https://github.com/other/repo/issues/23',
    ].join('\n');
    expect(closingIssueNumbers(body, 'acme/repo')).toEqual([20, 22]);
  });

  it('has nothing to say about an empty body', () => {
    expect(closingIssueNumbers(null, 'acme/repo')).toEqual([]);
  });
});

describe('pullRequestParentWorkItemId', () => {
  it('prefers the issue the author declared closed over the branch the code came from', () => {
    const declared = issueCard('issue-declared', 12);
    const author = card({
      id: 'issue-author',
      sessions: { work: { sessionId: 's1', branch: 'factory/issue-13', threadId: 't1' } },
    });
    const parent = pullRequestParentWorkItemId([declared, author], {
      repositoryId: 10,
      repositoryFullName: 'acme/repo',
      closesIssues: [12],
      headBranch: 'factory/issue-13',
    });
    expect(parent).toBe(declared.id);
  });

  it('ignores a same-numbered issue belonging to another repository', () => {
    const elsewhere = issueCard('issue-elsewhere', 12, 'other/repo', 99);
    const parent = pullRequestParentWorkItemId([elsewhere], {
      repositoryId: 10,
      repositoryFullName: 'acme/repo',
      closesIssues: [12],
    });
    expect(parent).toBeNull();
  });

  it('falls back to the work item whose session branch the pull request was pushed from', () => {
    const author = card({
      id: 'issue-author',
      sessions: { work: { sessionId: 's1', branch: 'factory/issue-13', threadId: 't1' } },
    });
    const otherPullRequest = card({
      id: 'pr-other',
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:5' },
      sessions: { work: { sessionId: 's2', branch: 'factory/issue-13', threadId: 't2' } },
    });
    const parent = pullRequestParentWorkItemId([otherPullRequest, author], {
      repositoryId: 10,
      repositoryFullName: 'acme/repo',
      headBranch: 'factory/issue-13',
    });
    expect(parent).toBe(author.id);
  });
});

describe('pullRequestLinkFacts', () => {
  it('reads the pull request a decision names', () => {
    expect(
      pullRequestLinkFacts({
        githubRepositoryId: 10,
        githubPullRequestNumber: 17,
        closesIssues: [12, 'nope'],
        headBranch: 'feature',
      }),
    ).toEqual({ repositoryId: 10, pullRequestNumber: 17, closesIssues: [12], headBranch: 'feature' });
  });

  it('has no facts for a decision that names no pull request', () => {
    expect(pullRequestLinkFacts({ githubRepositoryId: 10 })).toBeNull();
  });
});
