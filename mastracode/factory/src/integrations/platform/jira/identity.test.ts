import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import type { JiraApiClient, JiraUserRecord } from '../../jira/api.js';
import { buildPlatformJiraIdentity, type PlatformJiraIdentityHost } from './identity.js';
import { encodeSourceId } from './integration.js';

function makeCtx(bindings: Array<{ sourceId: string }>): IntegrationContext {
  return {
    storage: {
      intake: {
        listBindings: vi.fn(async ({ integrationId }: { orgId: string; integrationId?: string }) => {
          if (integrationId && integrationId !== 'jira') return [];
          return bindings.map(b => ({
            integrationId: 'jira',
            sourceId: b.sourceId,
            factoryProjectId: 'proj-1',
            board: null,
          }));
        }),
      },
    },
  } as unknown as IntegrationContext;
}

interface FakeConnection {
  connectionId: string;
  siteUrl: string;
  users: JiraUserRecord[];
}

function makeHost(connections: FakeConnection[]): {
  host: PlatformJiraIdentityHost;
  callsByConnection: Map<string, number>;
} {
  const callsByConnection = new Map<string, number>();
  const host: PlatformJiraIdentityHost = {
    activeContexts: async () =>
      connections.map(({ connectionId, siteUrl, users }) => ({
        connectionId,
        siteUrl,
        api: {
          listUsers: vi.fn(async () => {
            callsByConnection.set(connectionId, (callsByConnection.get(connectionId) ?? 0) + 1);
            return users;
          }),
        } as unknown as JiraApiClient,
      })),
  };
  return { host, callsByConnection };
}

describe('buildPlatformJiraIdentity', () => {
  it('returns empty and skips the platform call when the org has no bound Jira sources', async () => {
    const { host, callsByConnection } = makeHost([
      {
        connectionId: 'conn-other',
        siteUrl: 'https://other.atlassian.net',
        users: [{ accountId: 'mallory', displayName: 'Mallory', active: true, accountType: 'atlassian' }],
      },
    ]);
    const ctx = makeCtx([]);
    const identity = buildPlatformJiraIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([]);
    expect(callsByConnection.size).toBe(0);
  });

  it('drops deployment connections the org has not bound before fetching users', async () => {
    const { host, callsByConnection } = makeHost([
      {
        connectionId: 'conn-me',
        siteUrl: 'https://me.atlassian.net',
        users: [{ accountId: 'alice', displayName: 'Alice', active: true, accountType: 'atlassian' }],
      },
      {
        connectionId: 'conn-other',
        siteUrl: 'https://other.atlassian.net',
        users: [{ accountId: 'mallory', displayName: 'Mallory', active: true, accountType: 'atlassian' }],
      },
    ]);
    const ctx = makeCtx([{ sourceId: encodeSourceId('conn-me', 'proj-1') }]);
    const identity = buildPlatformJiraIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts.map(a => a.externalUserId)).toEqual(['alice']);
    expect(callsByConnection.get('conn-me')).toBeGreaterThanOrEqual(1);
    expect(callsByConnection.get('conn-other')).toBeUndefined();
  });
});
