/**
 * Platform Linear identity capability.
 *
 * Discovery is scoped to the requesting `orgId`: the platform client is
 * deployment-level, so a shared deployment could otherwise expose members
 * from workspaces connected by a different tenant. We intersect the
 * platform workspace list with the workspaces the org has actually bound
 * as intake sources in Factory storage. Fresh platform Linear installs
 * surface no members until the org has bound at least one Linear team or
 * project through intake — a UX trade-off to prevent cross-tenant leaks.
 *
 * With the intersection in hand we paginate the platform endpoint
 * `GET /v1/server/linear/workspaces/:workspaceId/users` (which fans out to
 * Linear's GraphQL `users` query behind the scenes). Members are deduped
 * by `(workspaceId, id)` because a self-hosted Linear instance and Linear
 * Cloud can share user ids technically. The `workspaceUrlKey` is tagged
 * as `installation` so operators with more than one connected workspace
 * can disambiguate identically-named users in the settings dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';
import { parseSourceId } from './integration.js';

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
    async listCandidateAccounts(ctx, { orgId, query }) {
      // Read the org's bound Linear intake sources first: if it hasn't wired
      // any workspaces through intake, there's nothing to list — and skipping
      // the platform call prevents a shared deployment from surfacing another
      // tenant's workspaces at all.
      const orgWorkspaceIds = new Set<string>();
      try {
        const bindings = await ctx.storage.intake.listBindings({ orgId, integrationId: 'linear' });
        for (const binding of bindings) {
          try {
            orgWorkspaceIds.add(parseSourceId(binding.sourceId).workspaceId);
          } catch {
            // Malformed source ids belong to a previous encoding; skip them.
          }
        }
      } catch {
        return [];
      }
      if (orgWorkspaceIds.size === 0) return [];
      let deploymentWorkspaces;
      try {
        deploymentWorkspaces = await host.listWorkspaces();
      } catch {
        return [];
      }
      // Intersect the deployment-scoped platform workspace list with the
      // org's bound workspaces. Anything the org has not bound is skipped —
      // its members are not this org's business.
      const workspaces = deploymentWorkspaces.filter(workspace =>
        orgWorkspaceIds.has(workspace.linearWorkspaceId),
      );
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
              ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
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
