import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../../factory/services/workItems';
import { createWorkItemSearchResults } from './searchResults';

const baseItem: Omit<WorkItem, 'id' | 'source' | 'sourceKey' | 'metadata' | 'title'> = {
  orgId: 'org-1',
  createdBy: 'factory-rule-dispatcher',
  githubProjectId: 'factory-1',
  parentWorkItemId: null,
  url: 'https://example.com/1',
  stages: ['triage'],
  stageHistory: [],
  sessions: {},
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
};

function githubIssue(overrides: Partial<WorkItem['metadata']> & { title: string; sourceKey: string }): WorkItem {
  return {
    ...baseItem,
    id: overrides.sourceKey,
    source: 'github-issue',
    sourceKey: overrides.sourceKey,
    title: overrides.title,
    metadata: overrides,
  };
}

function resolveMe(entries: Record<string, string[]>): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  for (const [integrationId, ids] of Object.entries(entries)) {
    map.set(integrationId, new Set(ids));
  }
  return map;
}

describe('createWorkItemSearchResults @me tokens', () => {
  it('injects @me into the value of a card whose author is a claimed GitHub login', () => {
    const item = githubIssue({ title: 'Fix a bug', sourceKey: 'github-issue:1', author: 'octocat' });
    const results = createWorkItemSearchResults({
      factoryId: 'factory-1',
      workItems: [item],
      candidates: [],
      resolvedMe: resolveMe({ github: ['octocat'] }),
    });
    expect(results).toHaveLength(1);
    expect(results[0].value.split(' ')).toContain('@me');
  });

  it('omits @me when the claim is for a different integration', () => {
    const item = githubIssue({ title: 'Fix a bug', sourceKey: 'github-issue:2', author: 'octocat' });
    const results = createWorkItemSearchResults({
      factoryId: 'factory-1',
      workItems: [item],
      candidates: [],
      resolvedMe: resolveMe({ linear: ['octocat'] }),
    });
    expect(results[0].value.split(' ')).not.toContain('@me');
  });

  it('omits @me when the user has no claims at all', () => {
    const item = githubIssue({ title: 'Fix a bug', sourceKey: 'github-issue:3', author: 'octocat' });
    const results = createWorkItemSearchResults({
      factoryId: 'factory-1',
      workItems: [item],
      candidates: [],
      resolvedMe: resolveMe({}),
    });
    expect(results[0].value.split(' ')).not.toContain('@me');
  });

  it('injects @me when the acting user is a requested reviewer', () => {
    const item: WorkItem = {
      ...baseItem,
      id: 'pr-1',
      source: 'github-pr',
      sourceKey: 'github-pr:9',
      title: 'Add feature',
      metadata: { author: 'someone-else', requestedReviewers: ['monalisa'] },
    };
    const results = createWorkItemSearchResults({
      factoryId: 'factory-1',
      workItems: [item],
      candidates: [],
      resolvedMe: resolveMe({ github: ['monalisa'] }),
    });
    expect(results[0].value.split(' ')).toContain('@me');
  });

  it('is a no-op when resolvedMe is omitted (backwards-compatible callers)', () => {
    const item = githubIssue({ title: 'Fix a bug', sourceKey: 'github-issue:5', author: 'octocat' });
    const results = createWorkItemSearchResults({
      factoryId: 'factory-1',
      workItems: [item],
      candidates: [],
    });
    expect(results[0].value.split(' ')).not.toContain('@me');
  });
});
