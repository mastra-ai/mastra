/**
 * Platform GitHub identity capability.
 *
 * Walks every installation Factory has registered for the acting org, then
 * fetches its members roster via the platform endpoint
 * `GET /v1/server/github-app/installations/:installationId/members`.
 *
 * The platform endpoint returns the org members for org installations and
 * a single-element list with the account owner themselves for user-account
 * installations. Both shapes flow through identically here.
 *
 * Members are deduped by `login` across installations, and the GitHub
 * account login (`org` slug or user login) is tagged as `installation` so
 * operators who connect multiple accounts can tell same-named users apart.
 * When the platform payload includes `avatarUrl` we forward it so the
 * settings UI and `@me` chips render a face instead of initials.
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
            ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
          });
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
