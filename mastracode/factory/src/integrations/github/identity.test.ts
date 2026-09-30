import type { Octokit } from '@octokit/rest';
import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../base.js';
import { buildGithubIdentity, type GithubIdentityHost } from './identity.js';

function makeInstallation(overrides: Partial<{
  id: string;
  externalId: string;
  accountName: string | null;
  accountType: string | null;
  integrationId: string;
}> = {}) {
  return {
    id: 'inst-1',
    integrationId: 'github',
    externalId: '12345',
    accountName: 'mastra-ai',
    accountType: 'Organization',
    ...overrides,
  };
}

function makeHost(overrides: {
  installations?: ReturnType<typeof makeInstallation>[];
  membersByOrg?: Record<string, Array<{ login: string; id: number; avatar_url?: string }>>;
  membersError?: Record<string, Error>;
  usersByLogin?: Record<string, { login: string; id: number; avatar_url?: string }>;
} = {}): {
  host: GithubIdentityHost;
  paginate: ReturnType<typeof vi.fn>;
  getByUsername: ReturnType<typeof vi.fn>;
} {
  const paginate = vi.fn(async (_endpoint: unknown, params: { org: string }) => {
    if (overrides.membersError?.[params.org]) throw overrides.membersError[params.org];
    return overrides.membersByOrg?.[params.org] ?? [];
  });
  const getByUsername = vi.fn(async ({ username }: { username: string }) => {
    const user = overrides.usersByLogin?.[username];
    if (!user) throw new Error(`no user fixture for ${username}`);
    return { data: user };
  });
  const octokit = {
    paginate,
    orgs: { listMembers: {} as unknown },
    users: { getByUsername },
  } as unknown as Octokit;
  return {
    paginate,
    getByUsername,
    host: {
      sourceControlStorage: {
        installations: {
          list: async () => overrides.installations ?? [],
        },
      },
      getInstallationOctokit: () => octokit,
    },
  };
}

const ctx = {} as IntegrationContext;

describe('buildGithubIdentity', () => {
  it('paginates org members and forwards avatar_url for every Organization-typed installation', async () => {
    const { host, paginate } = makeHost({
      installations: [
        makeInstallation({ id: 'inst-a', externalId: '111', accountName: 'org-a' }),
        makeInstallation({ id: 'inst-b', externalId: '222', accountName: 'org-b' }),
      ],
      membersByOrg: {
        'org-a': [{ login: 'octocat', id: 1, avatar_url: 'https://github.com/octocat.png' }],
        'org-b': [{ login: 'monalisa', id: 2 }],
      },
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      {
        externalUserId: 'octocat',
        label: 'octocat',
        installation: 'org-a',
        avatarUrl: 'https://github.com/octocat.png',
      },
      { externalUserId: 'monalisa', label: 'monalisa', installation: 'org-b' },
    ]);
    expect(paginate).toHaveBeenCalledTimes(2);
    expect(paginate).toHaveBeenCalledWith(expect.anything(), { org: 'org-a', per_page: 100, role: 'all' });
    expect(paginate).toHaveBeenCalledWith(expect.anything(), { org: 'org-b', per_page: 100, role: 'all' });
  });

  it('returns the account owner (with avatar) as the only member for a user-account installation', async () => {
    const { host, paginate, getByUsername } = makeHost({
      installations: [makeInstallation({ accountType: 'User', accountName: 'someuser' })],
      usersByLogin: {
        someuser: { login: 'someuser', id: 42, avatar_url: 'https://github.com/someuser.png' },
      },
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      {
        externalUserId: 'someuser',
        label: 'someuser',
        installation: 'someuser',
        avatarUrl: 'https://github.com/someuser.png',
      },
    ]);
    expect(getByUsername).toHaveBeenCalledWith({ username: 'someuser' });
    expect(paginate).not.toHaveBeenCalled();
  });

  it('skips installations belonging to another integration', async () => {
    const { host, paginate } = makeHost({
      installations: [
        makeInstallation({ integrationId: 'gitlab', accountName: 'other' }),
      ],
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([]);
    expect(paginate).not.toHaveBeenCalled();
  });

  it('deduplicates logins across multiple installations', async () => {
    const { host } = makeHost({
      installations: [
        makeInstallation({ id: 'inst-a', externalId: '111', accountName: 'org-a' }),
        makeInstallation({ id: 'inst-b', externalId: '222', accountName: 'org-b' }),
      ],
      membersByOrg: {
        'org-a': [{ login: 'octocat', id: 1 }],
        'org-b': [{ login: 'octocat', id: 1 }],
      },
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      { externalUserId: 'octocat', label: 'octocat', installation: 'org-a' },
    ]);
  });

  it('drops a failing installation and keeps the rest', async () => {
    const { host } = makeHost({
      installations: [
        makeInstallation({ id: 'inst-a', externalId: '111', accountName: 'org-a' }),
        makeInstallation({ id: 'inst-b', externalId: '222', accountName: 'org-b' }),
      ],
      membersByOrg: { 'org-b': [{ login: 'monalisa', id: 2 }] },
      membersError: { 'org-a': new Error('boom') },
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([{ externalUserId: 'monalisa', label: 'monalisa', installation: 'org-b' }]);
  });

  it('filters by case-insensitive substring match on label', async () => {
    const { host } = makeHost({
      installations: [makeInstallation({ accountName: 'mastra-ai' })],
      membersByOrg: {
        'mastra-ai': [
          { login: 'octocat', id: 1 },
          { login: 'monalisa', id: 2 },
        ],
      },
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1', query: 'OCTO' });

    expect(accounts).toEqual([
      { externalUserId: 'octocat', label: 'octocat', installation: 'mastra-ai' },
    ]);
  });

  it('skips installations with a non-numeric external id', async () => {
    const { host, paginate } = makeHost({
      installations: [makeInstallation({ externalId: 'not-a-number', accountName: 'org-a' })],
    });
    const identity = buildGithubIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([]);
    expect(paginate).not.toHaveBeenCalled();
  });
});
