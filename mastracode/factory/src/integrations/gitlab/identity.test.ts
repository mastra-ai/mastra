import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../base.js';
import type { GitLabApiClient, GitLabMember, GitLabProject } from './api.js';
import { buildGitlabIdentity } from './identity.js';

const ctx = {} as IntegrationContext;

function makeApi(pages: {
  projects?: GitLabProject[][];
  membersByProjectId?: Record<string, GitLabMember[][]>;
  membersByGroup?: Record<string, GitLabMember[][]>;
}) {
  const listProjects = vi.fn(async ({ page }: { page: number }) => {
    return pages.projects?.[page - 1] ?? [];
  });
  const listProjectMembers = vi.fn(async (projectId: string, { page }: { page?: number } = {}) => {
    const set = pages.membersByProjectId?.[projectId];
    if (!set) return [];
    return set[(page ?? 1) - 1] ?? [];
  });
  const listGroupMembers = vi.fn(async (groupId: string, { page }: { page?: number } = {}) => {
    const set = pages.membersByGroup?.[groupId];
    // No configured group behaves like a personal namespace: GitLab
    // returns 404 for `/groups/:id/members/all`.
    if (!set) throw new Error('404 Group Not Found');
    return set[(page ?? 1) - 1] ?? [];
  });
  return {
    api: { listProjects, listProjectMembers, listGroupMembers } as unknown as GitLabApiClient,
    listProjects,
    listProjectMembers,
    listGroupMembers,
  };
}

describe('buildGitlabIdentity', () => {
  it('reads the group roster once per top-level namespace instead of walking every project', async () => {
    const { api, listGroupMembers, listProjectMembers } = makeApi({
      projects: [
        [
          { id: 1, name: 'Api', path_with_namespace: 'acme/api', web_url: 'https://gitlab.com/acme/api' } as GitLabProject,
          { id: 2, name: 'Web', path_with_namespace: 'acme/web', web_url: 'https://gitlab.com/acme/web' } as GitLabProject,
        ],
      ],
      membersByGroup: {
        acme: [
          [
            { id: 10, username: 'octocat', name: 'The Octocat', state: 'active' },
            { id: 11, username: 'bob', name: 'Bob', state: 'active' },
            { id: 12, username: 'carol', name: 'Carol', state: 'active' },
          ],
        ],
      },
    });
    const identity = buildGitlabIdentity({
      activeContexts: async () => [{ api, host: 'gitlab.com' }],
    });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts.map(a => ({ id: a.externalUserId, host: a.installation }))).toEqual([
      { id: 'octocat', host: 'gitlab.com' },
      { id: 'bob', host: 'gitlab.com' },
      { id: 'carol', host: 'gitlab.com' },
    ]);
    // Two projects under one group: one group roster call, no per-project walk.
    expect(listGroupMembers).toHaveBeenCalledTimes(1);
    expect(listGroupMembers).toHaveBeenCalledWith('acme', expect.objectContaining({ page: 1 }));
    expect(listProjectMembers).not.toHaveBeenCalled();
  });

  it('falls back to a representative project roster for personal namespaces', async () => {
    const { api, listGroupMembers, listProjectMembers } = makeApi({
      projects: [
        [
          { id: 1, name: 'Api', path_with_namespace: 'mona/api', web_url: 'https://gitlab.com/mona/api' } as GitLabProject,
          { id: 2, name: 'Web', path_with_namespace: 'mona/web', web_url: 'https://gitlab.com/mona/web' } as GitLabProject,
        ],
      ],
      membersByProjectId: {
        '1': [[{ id: 10, username: 'mona', name: 'Mona', state: 'active' }]],
      },
    });
    const identity = buildGitlabIdentity({
      activeContexts: async () => [{ api, host: 'gitlab.com' }],
    });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts.map(a => a.externalUserId)).toEqual(['mona']);
    // Group lookup 404s (personal namespace) → one representative project only.
    expect(listGroupMembers).toHaveBeenCalledTimes(1);
    expect(listProjectMembers).toHaveBeenCalledTimes(1);
    expect(listProjectMembers).toHaveBeenCalledWith('1', expect.objectContaining({ page: 1 }));
  });

  it('drops inactive members', async () => {
    const { api } = makeApi({
      projects: [
        [{ id: 1, name: 'Api', path_with_namespace: 'acme/api', web_url: 'https://gitlab.com/acme/api' } as GitLabProject],
      ],
      membersByProjectId: {
        '1': [
          [
            { id: 10, username: 'octocat', name: 'The Octocat', state: 'active' },
            { id: 20, username: 'retired', name: 'Retired', state: 'blocked' },
          ],
        ],
      },
    });
    const identity = buildGitlabIdentity({ activeContexts: async () => [{ api, host: 'gitlab.com' }] });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts.map(a => a.externalUserId)).toEqual(['octocat']);
  });

  it('merges rosters across multiple connections keyed by (host, username)', async () => {
    const { api: apiA } = makeApi({
      projects: [
        [{ id: 1, name: 'a', path_with_namespace: 'a/a', web_url: '' } as GitLabProject],
      ],
      membersByProjectId: {
        '1': [[{ id: 10, username: 'shared', name: 'Shared', state: 'active' }]],
      },
    });
    const { api: apiB } = makeApi({
      projects: [
        [{ id: 2, name: 'b', path_with_namespace: 'b/b', web_url: '' } as GitLabProject],
      ],
      membersByProjectId: {
        '2': [
          [
            // Same username on a different self-hosted instance is a
            // different person — keep both.
            { id: 20, username: 'shared', name: 'Shared Twin', state: 'active' },
          ],
        ],
      },
    });
    const identity = buildGitlabIdentity({
      activeContexts: async () => [
        { api: apiA, host: 'gitlab.com' },
        { api: apiB, host: 'gitlab.self.example' },
      ],
    });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts.map(a => `${a.installation}:${a.externalUserId}`)).toEqual([
      'gitlab.com:shared',
      'gitlab.self.example:shared',
    ]);
  });

  it('returns empty when the host has no active connections', async () => {
    const identity = buildGitlabIdentity({ activeContexts: async () => [] });
    expect(await identity.listCandidateAccounts(ctx, { orgId: 'org-1' })).toEqual([]);
  });

  it('filters by case-insensitive substring match on label and id', async () => {
    const { api } = makeApi({
      projects: [
        [{ id: 1, name: 'a', path_with_namespace: 'a/a', web_url: '' } as GitLabProject],
      ],
      membersByProjectId: {
        '1': [
          [
            { id: 10, username: 'octocat', name: 'The Octocat', state: 'active' },
            { id: 11, username: 'monalisa', name: 'Mona', state: 'active' },
          ],
        ],
      },
    });
    const identity = buildGitlabIdentity({ activeContexts: async () => [{ api, host: 'gitlab.com' }] });
    const filtered = await identity.listCandidateAccounts(ctx, { orgId: 'org-1', query: 'MONA' });
    expect(filtered.map(a => a.externalUserId)).toEqual(['monalisa']);
  });
});
