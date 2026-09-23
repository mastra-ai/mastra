/**
 * Jira identity capability for the standalone integration.
 *
 * Paginates `GET /rest/api/3/users/search` directly against the connected
 * Atlassian site using the Basic-auth credentials the integration already
 * holds. Filters out inactive accounts and non-atlassian account types
 * (app-users, customer-portal accounts) so the roster only surfaces real
 * teammates for `@me` claims.
 *
 * The Jira site host serves as the `installation` disambiguator so a
 * factory org that talks to multiple sites (rare, but supported) can tell
 * two same-named users apart in the settings dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';
import type { JiraApiClient, JiraUserRecord } from './api.js';

export interface JiraIdentityHost {
  /** Returns the site-authenticated Jira client, or null when Jira isn't configured. */
  apiClient(): JiraApiClient | null;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

function siteHost(client: JiraApiClient): string | undefined {
  try {
    return new URL(client.baseUrl).host;
  } catch {
    return undefined;
  }
}

function isAtlassianUser(user: JiraUserRecord): boolean {
  if (user.active === false) return false;
  if (user.accountType && user.accountType !== 'atlassian') return false;
  return true;
}

export function buildJiraIdentity(host: JiraIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      const client = host.apiClient();
      if (!client) return [];
      const installation = siteHost(client);

      const collected: IntegrationCandidateAccount[] = [];
      // Jira's classic paging: startAt keeps advancing until a short page.
      // Cap at 20 pages (2000 users) to keep the dropdown snappy.
      for (let page = 0; page < 20; page++) {
        let users: JiraUserRecord[];
        try {
          users = await client.listUsers({ startAt: page * 100, maxResults: 100, query });
        } catch {
          break;
        }
        for (const user of users) {
          if (!isAtlassianUser(user)) continue;
          collected.push({
            externalUserId: user.accountId,
            label: user.displayName ?? user.accountId,
            ...(user.emailAddress ? { email: user.emailAddress } : {}),
            ...(installation ? { installation } : {}),
          });
        }
        if (users.length < 100) break;
      }
      return collected.filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
