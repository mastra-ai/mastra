/**
 * GitHub identity capability for the standalone integration.
 *
 * Iterates the source-control installations the acting org has connected on
 * this integration. Only `Organization`-typed installations produce members
 * (a user-account installation has no roster). For each org installation we
 * paginate `GET /orgs/{org}/members` using the installation-scoped Octokit
 * the integration already builds. Results are de-duplicated by GitHub login
 * across installations (a person on two orgs is still one identity) and
 * tagged with their installation's account name so the settings UI can
 * disambiguate when the same login appears twice.
 *
 * A failing installation is dropped rather than failing the whole call.
 * Source (a) observed-from-comments discovery is intentionally not merged
 * here — the identity capability now reflects the real org roster.
 */

import type { Octokit } from '@octokit/rest';

import type { FactoryIntegration, IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';

/**
 * The narrow slice of the standalone GitHub integration the identity
 * capability consults. Passing this shape rather than the full class keeps
 * the identity module easy to test with a fake — the roster fetch is the
 * whole surface area we care about.
 */
export interface GithubIdentityHost {
  /** Same instance handed to route handlers; scoped to the acting org. */
  sourceControlStorage: {
    installations: {
      list(args: { orgId: string }): Promise<
        Array<{
          id: string;
          integrationId: string;
          externalId: string;
          accountName: string | null;
          accountType: string | null;
        }>
      >;
    };
  };
  /** Reuses the integration's App-authenticated installation Octokit factory. */
  getInstallationOctokit(installationId: number): Octokit;
}

/**
 * Case-insensitive substring match against label + email, matching the shape
 * the other integrations use so the user's typed query behaves the same
 * everywhere in the settings dropdown.
 */
function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

export function buildGithubIdentity(host: GithubIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId, query }) {
      const installations = await host.sourceControlStorage.installations.list({ orgId });
      const githubInstallations = installations.filter(
        installation => installation.integrationId === 'github' && installation.accountType === 'Organization',
      );

      const perInstallation = await Promise.all(
        githubInstallations.map(async installation => {
          const externalInstallationId = Number(installation.externalId);
          if (!Number.isFinite(externalInstallationId)) return [] as IntegrationCandidateAccount[];
          const org = installation.accountName;
          if (!org) return [] as IntegrationCandidateAccount[];
          try {
            const octokit = host.getInstallationOctokit(externalInstallationId);
            const members = await octokit.paginate(octokit.orgs.listMembers, {
              org,
              per_page: 100,
              role: 'all',
            });
            return members.map((member): IntegrationCandidateAccount => ({
              externalUserId: String(member.login ?? member.id),
              label: String(member.login ?? member.id),
              installation: org,
            }));
          } catch {
            return [] as IntegrationCandidateAccount[];
          }
        }),
      );

      // Dedupe by externalUserId (GitHub login is globally unique). Keep the
      // first installation's account so we surface a stable disambiguator when
      // one person is on multiple orgs.
      const seen = new Map<string, IntegrationCandidateAccount>();
      for (const account of perInstallation.flat()) {
        if (seen.has(account.externalUserId)) continue;
        seen.set(account.externalUserId, account);
      }
      return [...seen.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}

/** Structural check kept in the module so a future rename in Octokit tips off callers here. */
export type GithubIdentityFactoryIntegrationBinding = Pick<FactoryIntegration, 'identity'>;
