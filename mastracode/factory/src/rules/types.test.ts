import { describe, expect, it } from 'vitest';

import type { WorkItemSource } from './types.js';
import {
  externallyAuthored,
  factoryRuleSourceForWorkItem,
  knownExternalAuthor,
  WORK_ITEM_SOURCES,
  workItemSource,
} from './types.js';

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

describe('externallyAuthored', () => {
  // Every source `workItemSource` can return, so a new provider cannot be added
  // without deciding whether its authors sit outside the write-access circle.
  const forgeBacked: WorkItemSource[] = ['github-issue', 'github-pr', 'gitlab-issue', 'gitlab-mr'];
  const insiderOnly: WorkItemSource[] = ['linear-issue', 'manual'];

  it('covers every work-item source', () => {
    expect([...forgeBacked, ...insiderOnly].sort()).toEqual([...WORK_ITEM_SOURCES].sort());
  });

  it.each(forgeBacked)('fails closed for an unstamped %s card', source => {
    expect(externallyAuthored({ source, metadata: null })).toBe(true);
    expect(externallyAuthored({ source, metadata: {} })).toBe(true);
  });

  it.each(forgeBacked)('holds an explicitly untrusted %s author outside the circle', source => {
    expect(externallyAuthored({ source, metadata: { authorTrusted: false } })).toBe(true);
    expect(knownExternalAuthor({ source, metadata: { authorTrusted: false } })).toBe(true);
  });

  it.each(forgeBacked)('lets a trusted %s author through', source => {
    expect(externallyAuthored({ source, metadata: { authorTrusted: true } })).toBe(false);
  });

  it.each(forgeBacked)("does not gate Factory's own %s card", source => {
    expect(externallyAuthored({ source, metadata: { factoryAuthored: true } })).toBe(false);
  });

  it.each(insiderOnly)('carries no outside author for a %s card', source => {
    expect(externallyAuthored({ source, metadata: null })).toBe(false);
  });

  // A missing stamp is silence, not a claim that the author is an outsider.
  it.each(forgeBacked)('does not mark an unstamped %s card as a known outsider', source => {
    expect(knownExternalAuthor({ source, metadata: null })).toBe(false);
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
