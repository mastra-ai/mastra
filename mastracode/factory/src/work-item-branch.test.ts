import { describe, expect, it } from 'vitest';

import { workItemBranch, workItemBranchSource } from './work-item-branch.js';

describe('workItemBranchSource', () => {
  it('maps stored provenance onto the branch vocabulary', () => {
    expect(workItemBranchSource(null)).toBe('manual');
    expect(workItemBranchSource({ integrationId: 'github', type: 'issue', externalId: '1' })).toBe('github-issue');
    expect(workItemBranchSource({ integrationId: 'github', type: 'pull-request', externalId: '2' })).toBe('github-pr');
    expect(workItemBranchSource({ integrationId: 'linear', type: 'issue', externalId: '3' })).toBe('linear-issue');
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

  it('falls back to an id-derived branch when no provider identity applies', () => {
    expect(workItemBranch({ id, source: 'manual', metadata: null })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'slack-thread' })).toBe(`factory/item-${id}`);
    expect(workItemBranch({ id, source: 'github-issue', metadata: {} })).toBe(`factory/item-${id}`);
  });
});
