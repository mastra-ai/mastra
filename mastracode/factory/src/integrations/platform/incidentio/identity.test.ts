import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../../base.js';
import type { IncidentioApiClient } from '../../incidentio/api.js';
import { buildPlatformIncidentioIdentity, type PlatformIncidentioIdentityHost } from './identity.js';
import { encodeScopedSourceId } from './integration.js';

function makeCtx(bindings: Array<{ sourceId: string }>): IntegrationContext {
  return {
    storage: {
      intake: {
        listBindings: vi.fn(async ({ integrationId }: { orgId: string; integrationId?: string }) => {
          if (integrationId && integrationId !== 'incidentio') return [];
          return bindings.map(b => ({
            integrationId: 'incidentio',
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
  label: string | null;
  users: Array<{ id: string; name?: string; email?: string }>;
}

function makeHost(connections: FakeConnection[]): {
  host: PlatformIncidentioIdentityHost;
  callsByConnection: Map<string, number>;
} {
  const callsByConnection = new Map<string, number>();
  const host: PlatformIncidentioIdentityHost = {
    activeContexts: async () =>
      connections.map(({ connectionId, label, users }) => ({
        connectionId,
        label,
        api: {
          listUsers: vi.fn(async () => {
            callsByConnection.set(connectionId, (callsByConnection.get(connectionId) ?? 0) + 1);
            return { items: users };
          }),
        } as unknown as IncidentioApiClient,
      })),
  };
  return { host, callsByConnection };
}

describe('buildPlatformIncidentioIdentity', () => {
  it('returns empty and skips the platform call when the org has no bound incident.io sources', async () => {
    const { host, callsByConnection } = makeHost([
      { connectionId: 'conn-other', label: 'Other Tenant', users: [{ id: 'mallory', name: 'Mallory' }] },
    ]);
    const ctx = makeCtx([]);
    const identity = buildPlatformIncidentioIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([]);
    expect(callsByConnection.size).toBe(0);
  });

  it('drops deployment connections the org has not bound before fetching users', async () => {
    const { host, callsByConnection } = makeHost([
      { connectionId: 'conn-me', label: 'My Tenant', users: [{ id: 'alice', name: 'Alice' }] },
      { connectionId: 'conn-other', label: 'Other Tenant', users: [{ id: 'mallory', name: 'Mallory' }] },
    ]);
    const ctx = makeCtx([{ sourceId: encodeScopedSourceId('conn-me', 'source-1') }]);
    const identity = buildPlatformIncidentioIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts.map(a => a.externalUserId)).toEqual(['alice']);
    expect(callsByConnection.get('conn-me')).toBeGreaterThanOrEqual(1);
    expect(callsByConnection.get('conn-other')).toBeUndefined();
  });
});
