import { describe, expect, it } from 'vitest';

import {
  pullRequestNumberFromBranch,
  workItemBranch,
  workItemBranchSource,
  workItemThreadTitle,
} from './work-item-branch.js';

describe('workItemBranchSource', () => {
  it('maps stored provenance onto the branch vocabulary', () => {
    expect(workItemBranchSource(null)).toBe('manual');
    expect(workItemBranchSource({ integrationId: 'github', type: 'issue', externalId: '1' })).toBe('github-issue');
    expect(workItemBranchSource({ integrationId: 'github', type: 'pull-request', externalId: '2' })).toBe('github-pr');
    expect(workItemBranchSource({ integrationId: 'linear', type: 'issue', externalId: '3' })).toBe('linear-issue');
    expect(workItemBranchSource({ integrationId: 'gitlab', type: 'issue', externalId: '42!7' })).toBe('gitlab-issue');
    expect(workItemBranchSource({ integrationId: 'gitlab', type: 'merge-request', externalId: '42!12' })).toBe(
      'gitlab-mr',
    );
    expect(workItemBranchSource({ integrationId: 'slack', type: 'slack-thread', externalId: '4' })).toBe('manual');
  });
});

describe('workItemBranch', () => {
  const id = '9f1c3b2a-0000-4000-8000-000000000001';

  it('names github issue and pull request branches from their metadata number', () => {
    expect(workItemBranch({ id, source: 'github-issue', metadata: { githubIssueNumber: 49 } })).toBe(
      'factory/issue-49',
    );
    expect(workItemBranch({ id, source: 'github-pr', metadata: { githubPullRequestNumber: 7 } })).toBe('factory/pr-7');
  });

  it('accepts the intake fallback `number` key for github cards', () => {
    expect(workItemBranch({ id, source: 'github-issue', metadata: { number: 12 } })).toBe('factory/issue-12');
  });

  it('rejects numbers that are not positive integers', () => {
    expect(workItemBranch({ id, source: 'github-issue', metadata: { githubIssueNumber: 0 } })).toBe(
      `factory/item-${id}`,
    );
    expect(workItemBranch({ id, source: 'github-issue', metadata: { githubIssueNumber: '49' } })).toBe(
      `factory/item-${id}`,
    );
  });

  it('lowercases the linear identifier', () => {
    expect(workItemBranch({ id, source: 'linear-issue', metadata: { identifier: 'ENG-42' } })).toBe(
      'factory/linear-eng-42',
    );
  });

  it('falls back when the linear identifier is empty or whitespace', () => {
    expect(workItemBranch({ id, source: 'linear-issue', metadata: { identifier: '' } })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'linear-issue', metadata: { identifier: '  ' } })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'linear-issue', metadata: { identifier: ' ENG-42 ' } })).toBe(
      'factory/linear-eng-42',
    );
  });

  it('names a gitlab branch from the per-project iid, not the path identifier', () => {
    expect(workItemBranch({ id, source: 'gitlab-issue', metadata: { iid: 7, identifier: 'group/project#7' } })).toBe(
      'factory/gitlab-7',
    );
  });

  it('keeps a gitlab issue and merge request sharing an iid on separate branches', () => {
    // GitLab numbers issues and merge requests in independent sequences, so
    // `!7` and `#7` are different work that must not share one branch.
    expect(workItemBranch({ id, source: 'gitlab-mr', metadata: { iid: 7 } })).toBe('factory/gitlab-mr-7');
    expect(workItemBranch({ id, source: 'gitlab-issue', metadata: { iid: 7 } })).toBe('factory/gitlab-7');
  });

  it('falls back for a merge request with no usable iid', () => {
    expect(workItemBranch({ id, source: 'gitlab-mr', metadata: { iid: 0 } })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'gitlab-mr', metadata: {} })).toBe(`factory/item-${id}`);
  });

  it('falls back when the gitlab iid is missing or not a positive integer', () => {
    expect(workItemBranch({ id, source: 'gitlab-issue', metadata: { identifier: 'group/project#7' } })).toBe(
      `factory/item-${id}`,
    );
    expect(workItemBranch({ id, source: 'gitlab-issue', metadata: { iid: 0 } })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'gitlab-issue', metadata: { iid: '7' } })).toBe(`factory/item-${id}`);
  });

  it('falls back to an id-derived branch when no provider identity applies', () => {
    expect(workItemBranch({ id, source: 'manual', metadata: null })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'slack-thread' })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'github-issue', metadata: {} })).toBe(`factory/item-${id}`);
  });
});

describe('pullRequestNumberFromBranch', () => {
  it('reads the number back from a pull request branch only', () => {
    expect(pullRequestNumberFromBranch('factory/pr-7')).toBe(7);
    expect(pullRequestNumberFromBranch('factory/issue-7')).toBeUndefined();
    expect(pullRequestNumberFromBranch('factory/pr-0')).toBeUndefined();
    expect(pullRequestNumberFromBranch('factory/pr-7x')).toBeUndefined();
    expect(pullRequestNumberFromBranch('feat/pr-7')).toBeUndefined();
  });

  it('reads a GitLab merge request branch too, so its session starts on the MR head', () => {
    // The caller uses this to decide whether to fetch the change ref; missing
    // it would open a GitLab review on the base tip instead of the MR.
    expect(pullRequestNumberFromBranch('factory/gitlab-mr-12')).toBe(12);
    // A GitLab issue branch is not a proposed change.
    expect(pullRequestNumberFromBranch('factory/gitlab-7')).toBeUndefined();
    expect(pullRequestNumberFromBranch('factory/gitlab-mr-0')).toBeUndefined();
  });
});

describe('workItemThreadTitle', () => {
  it('numbers a GitHub card by its issue or pull request number', () => {
    expect(workItemThreadTitle({ source: 'github-issue', metadata: { githubIssueNumber: 4 }, title: 'Fix it' })).toBe(
      'Issue #4: Fix it',
    );
    expect(
      workItemThreadTitle({ source: 'github-pr', metadata: { githubPullRequestNumber: 9 }, title: 'Ship it' }),
    ).toBe('PR #9: Ship it');
  });

  it('leaves a GitLab title alone, since it already carries its own reference', () => {
    // The rule titles a GitLab card `group/project#7: ...` because an iid is
    // ambiguous across projects; prefixing again would read `MR #7: ...!7: ...`.
    expect(
      workItemThreadTitle({ source: 'gitlab-mr', metadata: { iid: 12 }, title: 'acme/widgets!12: Add the widget' }),
    ).toBe('acme/widgets!12: Add the widget');
    expect(workItemThreadTitle({ source: 'gitlab-issue', metadata: { iid: 7 }, title: 'acme/widgets#7: Broken' })).toBe(
      'acme/widgets#7: Broken',
    );
  });

  it('falls back to the bare title when no provider number is known', () => {
    expect(workItemThreadTitle({ source: 'manual', metadata: null, title: 'Ad hoc' })).toBe('Ad hoc');
  });
});
