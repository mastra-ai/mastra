import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';
import { buildPlatformLinearIdentity, type PlatformLinearIdentityHost } from './identity.js';
import { encodeSourceId, encodeTeamSourceId } from './integration.js';

interface DeploymentWorkspace {
  linearWorkspaceId: string;
  urlKey: string | null;
  users?: Array<{ id: string; displayName?: string; name?: string; email?: string }>;
}

function makeCtx(bindings: Array<{ sourceId: string }>): IntegrationContext {
  return {
    storage: {
      intake: {
        listBindings: vi.fn(async ({ integrationId }: { orgId: string; integrationId?: string }) => {
          if (integrationId && integrationId !== 'linear') return [];
          return bindings.map(b => ({
            integrationId: 'linear',
            sourceId: b.sourceId,
            factoryProjectId: 'proj-1',
            board: null,
          }));
        }),
      },
    },
  } as unknown as IntegrationContext;
}

function makeHost(workspaces: DeploymentWorkspace[]): {
  host: PlatformLinearIdentityHost;
  request: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn(async (_method: string, path: string) => {
    const match = /workspaces\/([^/]+)\/users/.exec(path);
    const workspaceId = match ? decodeURIComponent(match[1]) : '';
    const workspace = workspaces.find(w => w.linearWorkspaceId === workspaceId);
    return { users: workspace?.users ?? [], pageInfo: { hasNextPage: false } };
  });
  const host: PlatformLinearIdentityHost = {
    apiPrefix: '/v1/server/linear',
    client: () => ({ request }) as unknown as PlatformApiClient,
    listWorkspaces: async () => workspaces.map(({ linearWorkspaceId, urlKey }) => ({ linearWorkspaceId, urlKey })),
  };
  return { host, request };
}

describe('buildPlatformLinearIdentity', () => {
  it('returns empty and skips the platform call when the org has no bound Linear sources', async () => {
    // Defense against a shared-deployment leak: the platform client is
    // deployment-scoped, so discovery could otherwise surface members from
    // workspaces connected by a different tenant.
    const { host, request } = makeHost([
      { linearWorkspaceId: 'ws-other', urlKey: 'other', users: [{ id: 'u-mallory', displayName: 'Mallory' }] },
    ]);
    const ctx = makeCtx([]);
    const identity = buildPlatformLinearIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it('drops deployment workspaces the org has not bound before fetching users', async () => {
    const { host, request } = makeHost([
      { linearWorkspaceId: 'ws-me', urlKey: 'me', users: [{ id: 'u-alice', displayName: 'Alice' }] },
      { linearWorkspaceId: 'ws-other', urlKey: 'other', users: [{ id: 'u-mallory', displayName: 'Mallory' }] },
    ]);
    const ctx = makeCtx([{ sourceId: encodeSourceId('ws-me', 'proj-1') }]);
    const identity = buildPlatformLinearIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts.map(a => a.externalUserId)).toEqual(['u-alice']);
    const userCalls = request.mock.calls.filter(([, path]) => (path as string).includes('/users'));
    expect(userCalls.every(([, path]) => (path as string).includes('ws-me'))).toBe(true);
    expect(userCalls.some(([, path]) => (path as string).includes('ws-other'))).toBe(false);
  });

  it('accepts team source bindings as evidence the org owns a workspace', async () => {
    const { host } = makeHost([
      { linearWorkspaceId: 'ws-me', urlKey: 'me', users: [{ id: 'u-alice', displayName: 'Alice' }] },
    ]);
    const ctx = makeCtx([{ sourceId: encodeTeamSourceId('ws-me', 'team-eng') }]);
    const identity = buildPlatformLinearIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts.map(a => a.externalUserId)).toEqual(['u-alice']);
  });
});
