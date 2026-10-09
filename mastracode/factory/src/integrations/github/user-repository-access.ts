/**
 * Per-user GitHub repository visibility for self-hosted Factory.
 *
 * Installations are org-owned rows, but an installation's repository set is
 * not something every org member may see: a teammate's personal-account
 * installation (or an org installation covering repos a member can't read)
 * would otherwise expose private repositories to the whole Factory org.
 *
 * The install callback is the only point where Factory holds a verified
 * GitHub user token, so it snapshots the repository ids that user can reach
 * through each installation (`GET /user/installations/{id}/repositories`).
 * Repository pickers and project resolution intersect the live installation
 * listing with that snapshot. A user with no snapshot sees nothing until they
 * connect GitHub themselves; reconnecting refreshes the snapshot.
 *
 * Stored in the `github` integration settings row for `(org, user)`.
 */

import type { GithubSubscriptionStorage } from './subscriptions.js';

type UserRepositoryAccessSettings = { repositoryAccess?: Record<string, unknown> };

/** Replace the user's snapshot: installation external id → accessible repository ids. */
export async function recordUserRepositoryAccess(
  storage: GithubSubscriptionStorage,
  orgId: string,
  userId: string,
  access: Record<string, number[]>,
): Promise<void> {
  const existing = (await storage.settings.get(orgId, userId)) ?? {};
  await storage.settings.save(orgId, userId, { ...existing, repositoryAccess: access });
}

/** Installation external ids the user has a snapshot for. */
export async function listUserAccessibleInstallations(
  storage: GithubSubscriptionStorage,
  orgId: string,
  userId: string,
): Promise<Set<string>> {
  const settings = (await storage.settings.get(orgId, userId)) as UserRepositoryAccessSettings | null;
  return new Set(Object.keys(settings?.repositoryAccess ?? {}));
}

/** Repository ids the user may see through `installationExternalId`; empty when unknown. */
export async function getUserAccessibleRepositoryIds(
  storage: GithubSubscriptionStorage,
  orgId: string,
  userId: string,
  installationExternalId: string,
): Promise<Set<number>> {
  const settings = (await storage.settings.get(orgId, userId)) as UserRepositoryAccessSettings | null;
  const ids = settings?.repositoryAccess?.[installationExternalId];
  return new Set(Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : []);
}
