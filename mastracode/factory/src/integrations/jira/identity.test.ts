import { describe, expect, it, vi } from 'vitest';

import type { IntegrationContext } from '../base.js';
import type { JiraApiClient, JiraUserRecord } from './api.js';
import { buildJiraIdentity } from './identity.js';

const ctx = {} as IntegrationContext;

function makeClient(pages: JiraUserRecord[][], baseUrl = 'https://acme.atlassian.net') {
  const listUsers = vi.fn(async (opts: { startAt?: number; maxResults?: number } = {}) => {
    const idx = Math.floor((opts.startAt ?? 0) / 100);
    return pages[idx] ?? [];
  });
  return {
    client: { baseUrl, listUsers } as unknown as JiraApiClient,
    listUsers,
  };
}

describe('buildJiraIdentity', () => {
  it('paginates users/search and tags each with the site host as installation', async () => {
    const { client, listUsers } = makeClient([
      [
        { accountId: 'a-1', accountType: 'atlassian', active: true, displayName: 'Alice', emailAddress: 'a@example.com' },
        { accountId: 'a-2', accountType: 'atlassian', active: true, displayName: 'Bob' },
      ],
    ]);
    const identity = buildJiraIdentity({ apiClient: () => client });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toEqual([
      { externalUserId: 'a-1', label: 'Alice', email: 'a@example.com', installation: 'acme.atlassian.net' },
      { externalUserId: 'a-2', label: 'Bob', installation: 'acme.atlassian.net' },
    ]);
    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ startAt: 0, maxResults: 100 }));
  });

  it('drops inactive accounts and non-atlassian account types', async () => {
    const { client } = makeClient([
      [
        { accountId: 'a-1', accountType: 'atlassian', active: true, displayName: 'Alice' },
        { accountId: 'a-2', accountType: 'atlassian', active: false, displayName: 'Retired' },
        { accountId: 'a-3', accountType: 'app', active: true, displayName: 'JiraBot' },
        { accountId: 'a-4', accountType: 'customer', active: true, displayName: 'Portal User' },
      ],
    ]);
    const identity = buildJiraIdentity({ apiClient: () => client });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts.map(a => a.externalUserId)).toEqual(['a-1']);
  });

  it('continues paging until a short page is returned', async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({
      accountId: `id-${i}`,
      accountType: 'atlassian',
      active: true,
      displayName: `User ${i}`,
    }));
    const second = [{ accountId: 'id-tail', accountType: 'atlassian', active: true, displayName: 'Tail' }];
    const { client, listUsers } = makeClient([first, second]);
    const identity = buildJiraIdentity({ apiClient: () => client });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toHaveLength(101);
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, expect.objectContaining({ startAt: 0 }));
    expect(listUsers).toHaveBeenNthCalledWith(2, expect.objectContaining({ startAt: 100 }));
  });

  it('returns empty when Jira is not configured', async () => {
    const identity = buildJiraIdentity({ apiClient: () => null });
    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });
    expect(accounts).toEqual([]);
  });

  it('stops paging on error and returns what was already collected', async () => {
    const fullFirstPage = Array.from({ length: 100 }, (_, i) => ({
      accountId: `id-${i}`,
      accountType: 'atlassian',
      active: true,
      displayName: `User ${i}`,
    })) as JiraUserRecord[];
    const listUsers = vi
      .fn<JiraApiClient['listUsers']>()
      .mockResolvedValueOnce(fullFirstPage)
      .mockRejectedValueOnce(new Error('boom'));
    const client = { baseUrl: 'https://acme.atlassian.net', listUsers } as unknown as JiraApiClient;
    const identity = buildJiraIdentity({ apiClient: () => client });

    const accounts = await identity.listCandidateAccounts(ctx, { orgId: 'org-1' });

    expect(accounts).toHaveLength(100);
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('filters by case-insensitive substring match', async () => {
    const { client } = makeClient([
      [
        { accountId: 'a-1', accountType: 'atlassian', active: true, displayName: 'Octocat', emailAddress: 'octo@x.com' },
        { accountId: 'a-2', accountType: 'atlassian', active: true, displayName: 'Monalisa', emailAddress: 'mona@x.com' },
      ],
    ]);
    const identity = buildJiraIdentity({ apiClient: () => client });
    const filtered = await identity.listCandidateAccounts(ctx, { orgId: 'org-1', query: 'MONA' });
    expect(filtered.map(a => a.externalUserId)).toEqual(['a-2']);
  });
});
