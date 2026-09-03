/**
 * Shared copy for the GitHub connect/manage affordances.
 *
 * GitHub's App install screen asks which account to install into, and picking
 * a personal account when the repos live in an organization produces an empty
 * repository list with no explanation. These helpers keep the guidance — and
 * the names of the accounts already installed — identical across the wizard
 * step, the settings panel, and the create-factory palette.
 *
 * Note this is the *GitHub* organization (the App installation target), not
 * the WorkOS organization behind the `organization_required` status reason.
 */

import type { GithubInstallation } from '../services/github';

/** Canonical guidance for GitHub's "install into…" account chooser. */
export const GITHUB_ORG_CHOICE_HINT =
  'On GitHub, install the app into the organization that owns the repositories this factory will work on — not your personal account, unless the repos live there.';

/** Single-line variant for slots that cannot wrap, such as palette subtitles. */
export const GITHUB_ORG_CHOICE_HINT_SHORT = 'Install into the organization that owns your repositories.';

/**
 * Human-readable summary of which GitHub accounts the App is installed on, or
 * `null` when there is nothing nameable to show (no installations, or every
 * installation predates the stored account login).
 */
export function describeInstallations(installations: GithubInstallation[]): string | null {
  const logins = installations.map(installation => installation.accountLogin).filter((login): login is string => !!login);
  if (logins.length === 0) return null;
  return `Installed on: ${logins.join(', ')}`;
}
