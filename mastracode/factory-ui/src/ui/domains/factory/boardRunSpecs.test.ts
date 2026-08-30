import assert from 'node:assert';
import { describe, expect, it } from 'vitest';
import { issueRunActions, itemRunSpec } from './boardRunSpecs';
import type { WorkItem } from './services/workItems';

function issueItem(author?: string): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    source: 'github-issue',
    sourceKey: 'github-issue:7',
    parentWorkItemId: null,
    title: 'Fix the settings page',
    url: 'https://github.com/acme/repo/issues/7',
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: { number: 7, ...(author ? { author } : {}) },
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
}

function buildPrompt(actions: ReturnType<typeof issueRunActions>): string {
  const build = actions.find(action => action.label === 'Build');
  assert(build && build.invocation.type === 'prompt');
  return build.invocation.prompt;
}

describe('the Build run credits the reporter like the factory-dispatched build', () => {
  it('carries the Co-Authored-By trailer for the issue author', () => {
    const spec = itemRunSpec(issueItem('octocat'));
    assert(spec);
    expect(buildPrompt(spec.actions)).toContain('Co-Authored-By: octocat <ID+octocat@users.noreply.github.com>');
  });

  it('credits nobody when the author is missing, a bot, or not a GitHub login', () => {
    const spec = itemRunSpec(issueItem());
    assert(spec);
    expect(buildPrompt(spec.actions)).not.toContain('Co-Authored-By');
    expect(buildPrompt(issueRunActions('issue #7', { author: 'mastra-platform[bot]' }))).not.toContain(
      'Co-Authored-By',
    );
    expect(buildPrompt(issueRunActions('issue #7', { author: '__unknown__' }))).not.toContain('Co-Authored-By');
  });
});
