/**
 * Platform GitHub identity capability.
 *
 * Enumerates every installation the caller has connected on Mastra Platform
 * (via `GET /v1/server/github-app/installations`) and fetches each one's
 * members roster via `GET /v1/server/github-app/installations/:id/members`.
 * Discovery is deliberately independent of Factory's source-control storage:
 * a user who has connected GitHub on Platform but not yet registered any
 * repositories still has org members Factory can list as claim candidates.
 * The platform endpoint returns the org members for org installations and
 * a single-element list with the account owner for user-account
 * installations. Both shapes flow through identically here.
 *
 * Members are deduped by `login` across installations, and the GitHub
 * account login (`org` slug or user login) is tagged as `installation` so
 * operators who connect multiple accounts can tell same-named users apart.
 * When the platform payload includes `avatarUrl` we forward it so the
 * settings UI and `@me` chips render a face instead of initials.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../../base.js';
import type { PlatformApiClient } from '../api-client.js';

interface PlatformGithubInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
  suspendedAt: string | null;
  usable: boolean;
}

interface PlatformGithubInstallationsResponse {
  installations: PlatformGithubInstallation[];
}

interface PlatformGithubMember {
  id: number;
  login: string;
  type?: string;
  avatarUrl?: string;
  htmlUrl?: string;
}

export interface PlatformGithubIdentityHost {
  client(): PlatformApiClient;
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
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      const client = host.client();
      let discovery: PlatformGithubInstallationsResponse;
      try {
        discovery = await client.request<PlatformGithubInstallationsResponse>(
          'GET',
          `${host.apiPrefix}/github-app/installations`,
        );
      } catch {
        return [];
      }
      const installations = discovery.installations.filter(entry => entry.usable && !entry.suspendedAt);

      const collected = new Map<string, IntegrationCandidateAccount>();
      for (const installation of installations) {
        let result: { members?: PlatformGithubMember[] };
        try {
          result = await client.request<{ members?: PlatformGithubMember[] }>(
            'GET',
            `${host.apiPrefix}/github-app/installations/${installation.installationId}/members`,
          );
        } catch {
          continue;
        }
        for (const member of result.members ?? []) {
          const key = `${installation.accountLogin}:${member.login}`;
          if (collected.has(key)) continue;
          collected.set(key, {
            externalUserId: member.login,
            label: member.login,
            installation: installation.accountLogin,
            ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
          });
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
