import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../base.js';
import type { IncidentioApiClient, IncidentioPage, IncidentioUser } from './api.js';
import { buildIncidentioIdentity } from './identity.js';

const ctx = {} as IntegrationContext;

function makeClient(pages: Array<{ items: IncidentioUser[]; nextCursor?: string | null }>) {
  const listUsers = vi.fn(async () => {
    const next = pages.shift();
    if (!next) return { items: [], nextCursor: null } satisfies IncidentioPage<IncidentioUser>;
    return { items: next.items, nextCursor: next.nextCursor ?? null } satisfies IncidentioPage<IncidentioUser>;
  });
  const client = { listUsers } as unknown as IncidentioApiClient;
  return { client, listUsers };
}

describe('buildIncidentioIdentity', () => {
  it('paginates workspace users and tags each with the installation host', async () => {
    const { client, listUsers } = makeClient([
      {
        items: [
          { id: 'u_1', name: 'Alice', email: 'a@x.com' },
          { id: 'u_2', name: 'Bob' },
        ],
        nextCursor: 'cur-1',
      },
      { items: [{ id: 'u_3', name: 'Carol', email: 'c@x.com' }], nextCursor: null },
    ]);
    const identity = buildIncidentioIdentity({
      apiClient: () => client,
      installationHost: () => 'api.incident.io',
    });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      { externalUserId: 'u_1', label: 'Alice', email: 'a@x.com', installation: 'api.incident.io' },
      { externalUserId: 'u_2', label: 'Bob', installation: 'api.incident.io' },
      { externalUserId: 'u_3', label: 'Carol', email: 'c@x.com', installation: 'api.incident.io' },
    ]);
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { pageSize: 100 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { pageSize: 100, cursor: 'cur-1' });
  });

  it('returns empty when the API client is not configured', async () => {
    const identity = buildIncidentioIdentity({ apiClient: () => null });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([]);
  });

  it('stops paging on error and returns what was already collected', async () => {
    const listUsers = vi
      .fn<IncidentioApiClient['listUsers']>()
      .mockResolvedValueOnce({ items: [{ id: 'u_1', name: 'Alice' }], nextCursor: 'cur-1' })
      .mockRejectedValueOnce(new Error('boom'));
    const client = { listUsers } as unknown as IncidentioApiClient;
    const identity = buildIncidentioIdentity({ apiClient: () => client });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([{ externalUserId: 'u_1', label: 'Alice' }]);
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('filters by case-insensitive substring match on label, id, and email', async () => {
    const { client } = makeClient([
      {
        items: [
          { id: 'u_1', name: 'Octocat', email: 'octo@x.com' },
          { id: 'u_2', name: 'Monalisa', email: 'mona@x.com' },
        ],
      },
    ]);
    const identity = buildIncidentioIdentity({ apiClient: () => client });

    const filtered = await identity.listCandidateAccounts(ctx, { orgId: 'org-1', query: 'MONA' });
    expect(filtered.map(a => a.externalUserId)).toEqual(['u_2']);
  });
});
