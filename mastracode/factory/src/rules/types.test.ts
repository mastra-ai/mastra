import { describe, expect, it } from 'vitest';

import type { WorkItemSource } from './types.js';
import { factoryRuleSourceForWorkItem, WORK_ITEM_SOURCES, workItemSource } from './types.js';

describe('workItemSource', () => {
  it('maps stored provenance onto the board vocabulary', () => {
    expect(workItemSource(null)).toBe('manual');
    expect(workItemSource({ integrationId: 'github', type: 'issue', externalId: '42' })).toBe('github-issue');
    expect(workItemSource({ integrationId: 'github', type: 'pull-request', externalId: '42' })).toBe('github-pr');
    expect(workItemSource({ integrationId: 'linear', type: 'issue', externalId: 'ENG-42' })).toBe('linear-issue');
    expect(workItemSource({ integrationId: 'gitlab', type: 'issue', externalId: '42!7' })).toBe('gitlab-issue');
    expect(workItemSource({ integrationId: 'gitlab', type: 'merge-request', externalId: '42!12' })).toBe('gitlab-mr');
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
    ['gitlab-issue', 'gitlabIssue'],
    ['gitlab-mr', 'gitlabMergeRequest'],
    ['manual', 'manual'],
  ] as const)('reports %s as the %s rule family', (source, expected) => {
    expect(factoryRuleSourceForWorkItem(source satisfies WorkItemSource)).toBe(expected);
  });

  // A provider that borrows another's family inherits rules written against a
  // different API, so every source must name a family of its own.
  it('gives every work item source a distinct rule family, sharing only with manual', () => {
    const families = WORK_ITEM_SOURCES.filter(source => source !== 'manual').map(factoryRuleSourceForWorkItem);
    expect(new Set(families).size).toBe(families.length);
    expect(families).not.toContain('manual');
  });
});
