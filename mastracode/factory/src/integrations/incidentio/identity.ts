/**
 * Incident.io identity capability for the standalone integration.
 *
 * Paginates `GET /v2/users` on the connected incident.io workspace using
 * the deployment API key the integration was constructed with. Returns
 * every visible user; `@me` claims filter to the ones the acting user
 * ticks on the settings page.
 *
 * The incident.io API host is tagged as `installation` so multi-workspace
 * setups (rare) can disambiguate same-named users in the dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';
import type { IncidentioApiClient, IncidentioUser } from './api.js';

export interface IncidentioIdentityHost {
  apiClient(): IncidentioApiClient | null;
  installationHost?(): string | undefined;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

export function buildIncidentioIdentity(host: IncidentioIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      const client = host.apiClient();
      if (!client) return [];
      const installation = host.installationHost?.();

      const collected: IntegrationCandidateAccount[] = [];
      let cursor: string | null = null;
      // Cap iteration to 20 pages (~2000 users) so a single laggy account
      // does not stall the whole identity dropdown.
      for (let page = 0; page < 20; page++) {
        let result: { items: IncidentioUser[]; nextCursor: string | null };
        try {
          result = await client.listUsers({ pageSize: 100, ...(cursor ? { cursor } : {}) });
        } catch {
          break;
        }
        for (const user of result.items) {
          collected.push({
            externalUserId: user.id,
            label: user.name || user.id,
            ...(user.email ? { email: user.email } : {}),
            ...(installation ? { installation } : {}),
          });
        }
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
      return collected.filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
