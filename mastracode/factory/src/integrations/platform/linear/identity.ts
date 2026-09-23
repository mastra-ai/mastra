/**
 * Platform Linear identity capability.
 *
 * Iterates the workspaces Factory has connected via platform for the
 * acting org, then paginates the platform endpoint
 * `GET /v1/server/linear/workspaces/:workspaceId/users` (which fans out to
 * Linear's GraphQL `users` query behind the scenes).
 *
 * Members are deduped by `(workspaceId, id)` because a self-hosted Linear
 * instance and Linear Cloud can share user ids technically. The
 * `workspaceUrlKey` is tagged as `installation` so operators with more
 * than one connected workspace can disambiguate identically-named users
 * in the settings dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';

interface PlatformLinearUser {
  id: string;
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface PlatformLinearUsersPage {
  users: PlatformLinearUser[];
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
}

export interface PlatformLinearIdentityHost {
  client(): PlatformApiClient;
  listWorkspaces(): Promise<Array<{ linearWorkspaceId: string; urlKey: string | null }>>;
  apiPrefix: string;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

export function buildPlatformLinearIdentity(host: PlatformLinearIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      let workspaces;
      try {
        workspaces = await host.listWorkspaces();
      } catch {
        return [];
      }
      if (workspaces.length === 0) return [];
      const client = host.client();
      const collected = new Map<string, IntegrationCandidateAccount>();
      for (const workspace of workspaces) {
        const installation = workspace.urlKey ?? undefined;
        let cursor: string | null = null;
        // Cap at 20 pages / workspace to keep the dropdown snappy.
        for (let page = 0; page < 20; page++) {
          const params = new URLSearchParams({ pageSize: '100' });
          if (cursor) params.set('cursor', cursor);
          let result: PlatformLinearUsersPage;
          try {
            result = await client.request<PlatformLinearUsersPage>(
              'GET',
              `${host.apiPrefix}/workspaces/${encodeURIComponent(workspace.linearWorkspaceId)}/users?${params}`,
            );
          } catch {
            break;
          }
          for (const user of result.users) {
            const key = `${workspace.linearWorkspaceId}:${user.id}`;
            if (collected.has(key)) continue;
            const label = user.displayName ?? user.name ?? user.id;
            collected.set(key, {
              externalUserId: user.id,
              label,
              ...(user.email ? { email: user.email } : {}),
              ...(installation ? { installation } : {}),
            });
          }
          if (!result.pageInfo?.hasNextPage) break;
          cursor = result.pageInfo.endCursor ?? null;
          if (!cursor) break;
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
