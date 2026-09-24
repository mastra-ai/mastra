import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';
import { buildPlatformGithubIdentity, type PlatformGithubIdentityHost } from './identity.js';

const ctx = {} as IntegrationContext;

interface PlatformInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  suspendedAt?: string | null;
  usable?: boolean;
}

function makeHost(overrides: {
  installations: PlatformInstallation[];
  membersByInstallation: Record<string, Array<{ id: number; login: string; avatarUrl?: string }>>;
}): { host: PlatformGithubIdentityHost; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(async (_method: string, path: string) => {
    if (path.endsWith('/github-app/installations')) {
      return {
        installations: overrides.installations.map(entry => ({
          installationId: entry.installationId,
          accountLogin: entry.accountLogin,
          accountType: entry.accountType,
          suspendedAt: entry.suspendedAt ?? null,
          usable: entry.usable ?? true,
        })),
      };
    }
    const match = /installations\/([^/]+)\/members$/.exec(path);
    const key = match ? decodeURIComponent(match[1]) : '';
    return { members: overrides.membersByInstallation[key] ?? [] };
  });
  const host: PlatformGithubIdentityHost = {
    apiPrefix: '/v1/server',
    client: () =>
      ({
        request,
      }) as unknown as PlatformApiClient,
  };
  return { host, request };
}

describe('buildPlatformGithubIdentity', () => {
  it('forwards avatarUrl for org members and dedupes across installations', async () => {
    const { host } = makeHost({
      installations: [
        { installationId: 111, accountLogin: 'org-a', accountType: 'Organization' },
        { installationId: 222, accountLogin: 'org-b', accountType: 'Organization' },
      ],
      membersByInstallation: {
        '111': [{ id: 1, login: 'octocat', avatarUrl: 'https://github.com/octocat.png' }],
        '222': [{ id: 2, login: 'monalisa' }],
      },
    });

    const identity = buildPlatformGithubIdentity(host);
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
  });

  it('surfaces the user-account owner as the sole claim (with avatar) when the platform returns them', async () => {
    // Platform endpoint now returns the account owner as a single-element list
    // for user-account installations, so the identity module just forwards it.
    const { host } = makeHost({
      installations: [{ installationId: 999, accountLogin: 'someuser', accountType: 'User' }],
      membersByInstallation: {
        '999': [{ id: 42, login: 'someuser', avatarUrl: 'https://github.com/someuser.png' }],
      },
    });

    const identity = buildPlatformGithubIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      {
        externalUserId: 'someuser',
        label: 'someuser',
        installation: 'someuser',
        avatarUrl: 'https://github.com/someuser.png',
      },
    ]);
  });

  it('discovers installations from the platform (not Factory storage) so unregistered orgs still surface members', async () => {
    // A user who has connected GitHub on Platform but not yet gone through
    // Factory's repo-picker has no rows in `source_control.installations` —
    // but the platform installations endpoint still lists their org, so
    // we can enumerate members and surface them here.
    const { host, request } = makeHost({
      installations: [{ installationId: 500, accountLogin: 'unregistered-org', accountType: 'Organization' }],
      membersByInstallation: {
        '500': [{ id: 7, login: 'alice' }],
      },
    });

    const identity = buildPlatformGithubIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([{ externalUserId: 'alice', label: 'alice', installation: 'unregistered-org' }]);
    // Confirms the discovery path exists.
    expect(request).toHaveBeenCalledWith('GET', '/v1/server/github-app/installations');
  });

  it('skips suspended and unusable installations from the discovery list', async () => {
    const { host, request } = makeHost({
      installations: [
        { installationId: 1, accountLogin: 'live-org', accountType: 'Organization' },
        { installationId: 2, accountLogin: 'suspended-org', accountType: 'Organization', suspendedAt: '2026-01-01T00:00:00Z' },
        { installationId: 3, accountLogin: 'broken-org', accountType: 'Organization', usable: false },
      ],
      membersByInstallation: {
        '1': [{ id: 1, login: 'alice' }],
        '2': [{ id: 2, login: 'bob' }],
        '3': [{ id: 3, login: 'carol' }],
      },
    });

    const identity = buildPlatformGithubIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([{ externalUserId: 'alice', label: 'alice', installation: 'live-org' }]);
    // We only requested members for the one live installation — never for
    // the suspended or unusable ones.
    const memberCalls = request.mock.calls.filter(([, path]) => (path as string).includes('/members'));
    expect(memberCalls).toEqual([['GET', '/v1/server/github-app/installations/1/members']]);
  });
});
