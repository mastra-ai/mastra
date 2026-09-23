import { describe, expect, it, vi } from 'vitest';

import type { SourceControlStorageHandle } from '../../../storage/domains/source-control/base.js';
import type { IntegrationContext } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';
import { buildPlatformGithubIdentity, type PlatformGithubIdentityHost } from './identity.js';

const ctx = {} as IntegrationContext;

function makeHost(overrides: {
  installations: Array<{ externalId: string; accountName?: string | null; accountType?: string }>;
  membersByInstallation: Record<string, Array<{ id: number; login: string; avatarUrl?: string }>>;
}): { host: PlatformGithubIdentityHost; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(async (_method: string, path: string) => {
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
    storage: () =>
      ({
        installations: {
          list: async () => overrides.installations,
        },
      }) as unknown as SourceControlStorageHandle,
  };
  return { host, request };
}

describe('buildPlatformGithubIdentity', () => {
  it('forwards avatarUrl for org members and dedupes across installations', async () => {
    const { host } = makeHost({
      installations: [
        { externalId: '111', accountName: 'org-a', accountType: 'Organization' },
        { externalId: '222', accountName: 'org-b', accountType: 'Organization' },
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
      installations: [{ externalId: '999', accountName: 'someuser', accountType: 'User' }],
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
});
