/**
 * Platform GitHub identity capability.
 *
 * Enumerates the installations Mastra Platform reports for the deployment
 * (via `GET /v1/server/github-app/installations`) and fetches each one's
 * members roster via `GET /v1/server/github-app/installations/:id/members`.
 *
 * Discovery is scoped to the requesting `orgId`: the platform client is
 * deployment-level, so a shared deployment could otherwise expose members
 * from installations connected by a different tenant. We intersect the
 * platform installation list with the installations the org has registered
 * in Factory's source-control storage (`versionControl.registerInstallation`,
 * called by intake) and only fetch members for that intersection. Fresh
 * platform installs surface no members until the org has walked at least one
 * installation through intake — a UX trade-off to prevent cross-tenant leaks.
 *
 * The platform endpoint returns org members for org installations and a
 * single-element list with the account owner for user-account installations;
 * both shapes flow through identically. Members are deduped by `login`
 * across installations, and the GitHub account login (`org` slug or user
 * login) is tagged as `installation` so operators who connect multiple
 * accounts can tell same-named users apart. When the platform payload
 * includes `avatarUrl` we forward it so the settings UI and `@me` chips
 * render a face instead of initials.
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
  /**
   * Installation ids (as strings, matching the platform payload's
   * `installationId`) that the requesting org has registered in Factory's
   * source-control storage. Used to intersect the deployment-scoped platform
   * installation list with the org's own installations so a shared
   * deployment never leaks members from other tenants' installations.
   */
  listOrgInstallationIds(orgId: string): Promise<Set<string>>;
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
      // Read the org's own installations first: if it hasn't registered any
      // via intake, there's nothing to list — and skipping the platform call
      // prevents a shared deployment from surfacing another tenant's
      // installations at all.
      const orgInstallationIds = await host.listOrgInstallationIds(orgId);
      if (orgInstallationIds.size === 0) return [];
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
      // Intersect the deployment-scoped platform installation list with the
      // org's registered installations. Anything the org has not registered
      // is skipped — its members are not this org's business.
      const installations = discovery.installations.filter(
        entry => entry.usable && !entry.suspendedAt && orgInstallationIds.has(String(entry.installationId)),
      );

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
          // GitHub logins are globally unique — dedupe by login alone so a
          // user in two connected orgs claims one row, not two.
          const key = member.login;
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
