/**
 * Platform Jira identity capability.
 *
 * Iterates every active platform Jira connection for the org and calls the
 * same `GET /rest/api/3/users/search` endpoint the standalone integration
 * uses — but this time through the Mastra Platform connection proxy, which
 * transparently swaps the caller's bearer token for the Nango-brokered
 * Atlassian OAuth token.
 *
 * Each connection's site host is tagged as `installation` so operators
 * with multiple Jira sites can tell same-named accounts apart in the
 * settings dropdown.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { JiraApiClient, JiraUserRecord } from '../../jira/api.js';

export interface PlatformJiraIdentityHost {
  activeContexts(): Promise<Array<{ api: JiraApiClient; siteUrl: string }>>;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

function isAtlassianUser(user: JiraUserRecord): boolean {
  if (user.active === false) return false;
  if (user.accountType && user.accountType !== 'atlassian') return false;
  return true;
}

/** See standalone Jira identity — Jira serves avatars in a size-keyed record. */
function pickJiraAvatar(avatarUrls: Record<string, string> | null | undefined): string | undefined {
  if (!avatarUrls) return undefined;
  const preferred = ['48x48', '32x32', '24x24', '16x16'];
  for (const size of preferred) {
    if (avatarUrls[size]) return avatarUrls[size];
  }
  const first = Object.values(avatarUrls).find(url => typeof url === 'string' && url.length > 0);
  return first;
}

function siteHost(siteUrl: string): string | undefined {
  try {
    return new URL(siteUrl).host;
  } catch {
    return undefined;
  }
}

export function buildPlatformJiraIdentity(host: PlatformJiraIdentityHost): IntegrationIdentityCapability {
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
        const installation = siteHost(ctx.siteUrl);
        for (let page = 0; page < 20; page++) {
          let users: JiraUserRecord[];
          try {
            users = await ctx.api.listUsers({ startAt: page * 100, maxResults: 100, query });
          } catch {
            break;
          }
          for (const user of users) {
            if (!isAtlassianUser(user)) continue;
            const key = `${installation ?? ''}:${user.accountId}`;
            if (collected.has(key)) continue;
            const avatarUrl = pickJiraAvatar(user.avatarUrls);
            collected.set(key, {
              externalUserId: user.accountId,
              label: user.displayName ?? user.accountId,
              ...(user.emailAddress ? { email: user.emailAddress } : {}),
              ...(avatarUrl ? { avatarUrl } : {}),
              ...(installation ? { installation } : {}),
            });
          }
          if (users.length < 100) break;
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
