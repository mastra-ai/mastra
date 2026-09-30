/**
 * Platform Incident.io identity capability.
 *
 * Discovery is scoped to the requesting `orgId`: platform incident.io
 * connections are deployment-wide, so a shared deployment could otherwise
 * expose members from workspaces connected by a different tenant. We
 * intersect the active platform connections with the ones the org has
 * actually bound as intake sources in Factory storage and only walk that
 * intersection. Fresh platform incident.io installs surface no members
 * until the org has bound at least one source through intake — a UX
 * trade-off to prevent cross-tenant leaks.
 *
 * With the intersection in hand we paginate `GET /v2/users` through the
 * Mastra Platform connection proxy for each connection. The proxy
 * transparently swaps the caller's bearer token for the Nango-brokered
 * incident.io API key. A connection's platform id (a UUID) is tagged as
 * `installation` when present so operators with multiple incident.io
 * workspaces can tell same-named accounts apart in the settings dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { IncidentioApiClient, IncidentioPage, IncidentioUser } from '../../incidentio/api.js';
import { decodeScopedSourceId } from './integration.js';

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
    async listCandidateAccounts(ctx, { orgId, query }) {
      // Read the org's bound incident.io intake sources first: if it hasn't
      // wired any connections through intake, there's nothing to list — and
      // skipping the platform call prevents a shared deployment from
      // surfacing another tenant's connections at all.
      const orgConnectionIds = new Set<string>();
      try {
        const bindings = await ctx.storage.intake.listBindings({ orgId, integrationId: 'incidentio' });
        for (const binding of bindings) {
          const decoded = decodeScopedSourceId(binding.sourceId);
          if (decoded) orgConnectionIds.add(decoded.connectionId);
        }
      } catch {
        return [];
      }
      if (orgConnectionIds.size === 0) return [];
      let allContexts;
      try {
        allContexts = await host.activeContexts();
      } catch {
        return [];
      }
      // Intersect the deployment-scoped active-connection list with the
      // connections the org has bound. Anything the org has not bound is
      // skipped — its members are not this org's business.
      const contexts = allContexts.filter(c => orgConnectionIds.has(c.connectionId));
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
