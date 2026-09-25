import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../base.js';
import { buildLinearIdentity, type LinearIdentityHost } from './identity.js';

const ctx = {} as IntegrationContext;

function makeHost(overrides: {
  connection?: { workspaceUrlKey?: string | null } | null;
  accessToken?: string;
  tokenError?: Error;
  pages?: Array<{
    nodes: Array<{ id: string; name?: string | null; displayName?: string | null; email?: string | null }>;
    hasNextPage?: boolean;
    endCursor?: string | null;
  }>;
  graphqlError?: Error;
} = {}) {
  const graphql = vi.fn(async () => {
    if (overrides.graphqlError) throw overrides.graphqlError;
    const page = overrides.pages?.shift() ?? { nodes: [], hasNextPage: false, endCursor: null };
    return {
      users: {
        nodes: page.nodes,
        pageInfo: {
          hasNextPage: page.hasNextPage ?? false,
          endCursor: page.endCursor ?? null,
        },
      },
    };
  });
  const host: LinearIdentityHost = {
    loadConnection: async () => (overrides.connection === undefined ? { workspaceUrlKey: 'acme' } : overrides.connection),
    getFreshAccessToken: async () => {
      if (overrides.tokenError) throw overrides.tokenError;
      return overrides.accessToken ?? 'token-abc';
    },
    linearGraphql: graphql as unknown as LinearIdentityHost['linearGraphql'],
  };
  return { host, graphql };
}

describe('buildLinearIdentity', () => {
  it('paginates workspace users through Linear GraphQL and tags with workspaceUrlKey as installation', async () => {
    const { host, graphql } = makeHost({
      pages: [
        {
          nodes: [
            { id: 'u_1', name: 'Alice', displayName: 'alice', email: 'alice@example.com' },
            { id: 'u_2', name: 'Bob', displayName: 'bob' },
          ],
          hasNextPage: true,
          endCursor: 'cursor-1',
        },
        { nodes: [{ id: 'u_3', name: 'Carol', displayName: 'carol' }] },
      ],
    });
    const identity = buildLinearIdentity(host);

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      { externalUserId: 'u_1', label: 'alice', email: 'alice@example.com', installation: 'acme' },
      { externalUserId: 'u_2', label: 'bob', installation: 'acme' },
      { externalUserId: 'u_3', label: 'carol', installation: 'acme' },
    ]);
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql).toHaveBeenNthCalledWith(1, 'token-abc', expect.stringMatching(/FactoryIdentityLinearUsers/), {
      first: 100,
      after: null,
    });
    expect(graphql).toHaveBeenNthCalledWith(2, 'token-abc', expect.stringMatching(/FactoryIdentityLinearUsers/), {
      first: 100,
      after: 'cursor-1',
    });
  });

  it('returns empty when the org has no Linear connection', async () => {
    const { host, graphql } = makeHost({ connection: null });
    const identity = buildLinearIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([]);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('returns empty when loading the connection throws (storage not ready)', async () => {
    const graphql = vi.fn();
    const host: LinearIdentityHost = {
      loadConnection: async () => {
        throw new Error('storage not initialized');
      },
      getFreshAccessToken: async () => 'token-abc',
      linearGraphql: graphql as unknown as LinearIdentityHost['linearGraphql'],
    };
    const identity = buildLinearIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([]);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('drops guest users locally', async () => {
    const { host } = makeHost({
      pages: [
        {
          nodes: [
            { id: 'u_1', displayName: 'member' },
            { id: 'u_2', displayName: 'guest', guest: true } as { id: string; displayName: string },
          ],
        },
      ],
    });
    const identity = buildLinearIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts.map(a => a.externalUserId)).toEqual(['u_1']);
  });

  it('returns empty when the access token cannot be refreshed', async () => {
    const { host, graphql } = makeHost({ tokenError: new Error('expired') });
    const identity = buildLinearIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([]);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('stops pagination on a GraphQL error and returns what was already collected', async () => {
    // The first call will succeed; the second throws.
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({
        users: {
          nodes: [{ id: 'u_1', displayName: 'alice' }],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
        },
      })
      .mockRejectedValueOnce(new Error('linear api boom'));
    const host: LinearIdentityHost = {
      loadConnection: async () => ({ workspaceUrlKey: 'acme' }),
      getFreshAccessToken: async () => 'token-abc',
      linearGraphql: graphql as unknown as LinearIdentityHost['linearGraphql'],
    };
    const identity = buildLinearIdentity(host);
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([{ externalUserId: 'u_1', label: 'alice', installation: 'acme' }]);
    expect(graphql).toHaveBeenCalledTimes(2);
  });

  it('filters by case-insensitive substring match on label, email, and id', async () => {
    const { host } = makeHost({
      pages: [
        {
          nodes: [
            { id: 'u_1', displayName: 'octocat', email: 'octo@x.com' },
            { id: 'u_2', displayName: 'monalisa', email: 'mona@x.com' },
            { id: 'u_3', displayName: 'other' },
          ],
        },
      ],
    });
    const identity = buildLinearIdentity(host);

    const byLabel = await identity.listCandidateAccounts(ctx, { orgId: 'org-1', query: 'OCTO' });
    expect(byLabel.map(a => a.externalUserId)).toEqual(['u_1']);

    const { host: host2 } = makeHost({
      pages: [
        {
          nodes: [
            { id: 'u_1', displayName: 'octocat', email: 'octo@x.com' },
            { id: 'u_2', displayName: 'monalisa', email: 'mona@x.com' },
          ],
        },
      ],
    });
    const byEmail = await buildLinearIdentity(host2).listCandidateAccounts(ctx, { orgId: 'org-1', query: 'mona' });
    expect(byEmail.map(a => a.externalUserId)).toEqual(['u_2']);
  });
});
