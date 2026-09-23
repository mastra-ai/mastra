/**
 * Platform GitHub identity capability.
 *
 * Walks every installation Factory has registered for the acting org, then
 * fetches its org-members roster via the platform endpoint
 * `GET /v1/server/github-app/installations/:installationId/members`.
 *
 * The platform endpoint returns `[]` for installations installed on a user
 * account (as opposed to an org), so we treat both empty and 404 responses
 * as "nothing to claim" rather than an error — that matches the standalone
 * capability's behavior when the App is installed on a user account.
 *
 * Members are deduped by `login` across installations, and the GitHub
 * account login (`org` slug) is tagged as `installation` so operators who
 * connect multiple orgs can tell same-named users apart.
 */

import type { SourceControlStorageHandle } from '../../../storage/domains/source-control/base.js';
import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';

interface PlatformGithubMember {
  id: number;
  login: string;
  type?: string;
  avatarUrl?: string;
  htmlUrl?: string;
}

export interface PlatformGithubIdentityHost {
  client(): PlatformApiClient;
  storage(): SourceControlStorageHandle;
  apiPrefix: string;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  return false;
}

export function buildPlatformGithubIdentity(host: PlatformGithubIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId, query }) {
      let installations;
      try {
        installations = await host.storage().installations.list({ orgId });
      } catch {
        return [];
      }

      const client = host.client();
      const collected = new Map<string, IntegrationCandidateAccount>();
      for (const installation of installations) {
        const installationId = installation.externalId;
        if (!installationId) continue;
        let result: { members?: PlatformGithubMember[] };
        try {
          result = await client.request<{ members?: PlatformGithubMember[] }>(
            'GET',
            `${host.apiPrefix}/github-app/installations/${encodeURIComponent(installationId)}/members`,
          );
        } catch {
          continue;
        }
        for (const member of result.members ?? []) {
          const key = `${installation.accountName}:${member.login}`;
          if (collected.has(key)) continue;
          collected.set(key, {
            externalUserId: member.login,
            label: member.login,
            ...(installation.accountName ? { installation: installation.accountName } : {}),
          });
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
