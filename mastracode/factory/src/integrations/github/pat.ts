/**
 * Org-scoped GitHub Personal Access Token settings.
 *
 * GitHub App installation tokens are the wrong credential for the `gh` CLI —
 * they hit "Resource not accessible by integration" on endpoints the CLI
 * needs regardless of the minted permission set. When an org pastes a PAT in
 * Settings, the sandbox `GH_TOKEN` injection sites and the
 * `github_refresh_token` tool use it instead of a minted installation token.
 * Tokens must be classic PATs whose account has access to the linked repos.
 *
 * Two kinds:
 * - `default` — the worker token every sandbox gets.
 * - `reviewer` — optional second token for review-board sessions, so PR
 *   reviews come from a different account than the author. When it isn't
 *   configured, review sessions fall back to the worker token.
 *
 * Both live in the generic `integration_settings` collection for the
 * `github` integration under a sentinel user id (the settings are org-wide,
 * but the schema keys settings per `(org, user)`). Tokens are never returned
 * to the browser — the routes only report whether each is configured.
 */

import type { GithubSubscriptionStorage } from './subscriptions.js';

/** Sentinel `user_id` for the org-wide settings row. */
const PAT_SETTINGS_USER_ID = '__github_org_settings__';

export type GithubPatKind = 'default' | 'reviewer';

type GithubOrgSettings = { pat?: string; reviewerPat?: string };

const FIELD_FOR_KIND: Record<GithubPatKind, keyof GithubOrgSettings> = {
  default: 'pat',
  reviewer: 'reviewerPat',
};

function asToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The PAT to install for `kind`, or null. `reviewer` falls back to the
 * worker token so review sessions still authenticate when no dedicated
 * reviewer token is configured. Fail-soft: storage errors (e.g. integration
 * storage not initialized in a partial test harness) read as "no PAT
 * configured" so token minting still works. */
export async function getGithubPat(
  getStorage: () => GithubSubscriptionStorage,
  orgId: string,
  kind: GithubPatKind = 'default',
): Promise<string | null> {
  try {
    const settings = (await getStorage().settings.get(orgId, PAT_SETTINGS_USER_ID)) as GithubOrgSettings | null;
    if (!settings) return null;
    if (kind === 'reviewer') return asToken(settings.reviewerPat) ?? asToken(settings.pat);
    return asToken(settings.pat);
  } catch {
    return null;
  }
}

/** Which tokens are configured, without fallback semantics — feeds the
 * settings UI status badges. */
export async function getGithubPatStatus(
  getStorage: () => GithubSubscriptionStorage,
  orgId: string,
): Promise<{ configured: boolean; reviewerConfigured: boolean }> {
  try {
    const settings = (await getStorage().settings.get(orgId, PAT_SETTINGS_USER_ID)) as GithubOrgSettings | null;
    return {
      configured: asToken(settings?.pat) !== null,
      reviewerConfigured: asToken(settings?.reviewerPat) !== null,
    };
  } catch {
    return { configured: false, reviewerConfigured: false };
  }
}

export async function setGithubPat(
  storage: GithubSubscriptionStorage,
  orgId: string,
  pat: string,
  kind: GithubPatKind = 'default',
): Promise<void> {
  const existing = ((await storage.settings.get(orgId, PAT_SETTINGS_USER_ID)) ?? {}) as GithubOrgSettings;
  await storage.settings.save(orgId, PAT_SETTINGS_USER_ID, { ...existing, [FIELD_FOR_KIND[kind]]: pat });
}

export async function clearGithubPat(
  storage: GithubSubscriptionStorage,
  orgId: string,
  kind: GithubPatKind = 'default',
): Promise<void> {
  const existing = (await storage.settings.get(orgId, PAT_SETTINGS_USER_ID)) as GithubOrgSettings | null;
  const field = FIELD_FOR_KIND[kind];
  if (!existing?.[field]) return;
  const { [field]: _removed, ...rest } = existing;
  await storage.settings.save(orgId, PAT_SETTINGS_USER_ID, rest);
}
