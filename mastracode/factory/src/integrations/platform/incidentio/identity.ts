/**
 * Platform Incident.io identity capability.
 *
 * Iterates every active platform incident.io connection for the org and
 * paginates `GET /v2/users` through the Mastra Platform connection proxy
 * for each. The proxy transparently swaps the caller's bearer token for
 * the Nango-brokered incident.io API key.
 *
 * A connection's platform id (a UUID) is tagged as `installation` when
 * present so operators with multiple incident.io workspaces can tell
 * same-named accounts apart in the settings dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { IncidentioApiClient, IncidentioPage, IncidentioUser } from '../../incidentio/api.js';

export interface PlatformIncidentioIdentityHost {
  activeContexts(): Promise<Array<{ api: IncidentioApiClient; connectionId: string; label: string | null }>>;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

export function buildPlatformIncidentioIdentity(host: PlatformIncidentioIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      let contexts;
      try {
        contexts = await host.activeContexts();
      } catch {
        return [];
      }
      const collected = new Map<string, IntegrationCandidateAccount>();
      for (const ctx of contexts) {
        const installation = ctx.label ?? ctx.connectionId;
        let cursor: string | undefined;
        for (let page = 0; page < 20; page++) {
          let result: IncidentioPage<IncidentioUser>;
          try {
            result = await ctx.api.listUsers({ pageSize: 100, ...(cursor ? { cursor } : {}) });
          } catch {
            break;
          }
          for (const user of result.items) {
            const key = `${installation}:${user.id}`;
            if (collected.has(key)) continue;
            collected.set(key, {
              externalUserId: user.id,
              label: user.name || user.id,
              ...(user.email ? { email: user.email } : {}),
              installation,
            });
          }
          if (!result.nextCursor) break;
          cursor = result.nextCursor;
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
