import { describe, expect, it } from 'vitest';

import type { WorkItemSource } from './types.js';
import { factoryRuleSourceForWorkItem, workItemSource } from './types.js';

describe('workItemSource', () => {
  it('maps stored provenance onto the board vocabulary', () => {
    expect(workItemSource(null)).toBe('manual');
    expect(workItemSource({ integrationId: 'github', type: 'issue', externalId: '42' })).toBe('github-issue');
    expect(workItemSource({ integrationId: 'github', type: 'pull-request', externalId: '42' })).toBe('github-pr');
    expect(workItemSource({ integrationId: 'linear', type: 'issue', externalId: 'ENG-42' })).toBe('linear-issue');
    expect(workItemSource({ integrationId: 'gitlab', type: 'issue', externalId: '42!7' })).toBe('gitlab-issue');
  });

  it('treats a provider without its own identity as a plain work item', () => {
    expect(workItemSource({ integrationId: 'slack', type: 'slack-thread', externalId: 'C1:1.2' })).toBe('manual');
  });
});

describe('factoryRuleSourceForWorkItem', () => {
  it.each([
    ['github-issue', 'issue'],
    ['github-pr', 'pullRequest'],
    ['linear-issue', 'linearIssue'],
    ['manual', 'manual'],
    // GitLab has no rule family of its own: its ingress is a webhook stub, so
    // its cards must read as operator-driven rather than borrowing another
    // provider's rules. Give it its own family only alongside a real event feed.
    ['gitlab-issue', 'manual'],
  ] as const)('reports %s as the %s rule family', (source, expected) => {
    expect(factoryRuleSourceForWorkItem(source satisfies WorkItemSource)).toBe(expected);
  });
});
