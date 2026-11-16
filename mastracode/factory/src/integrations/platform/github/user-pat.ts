/**
 * A Factory user's own GitHub Personal Access Token, for orgs on the Mastra
 * Factory apps. A write made for that user runs with it when they have no
 * end-user `factory-github` connection, so GitHub shows them as its author.
 *
 * Stored per (org, user) in the platform GitHub integration's settings, under
 * a prefixed user key so it never collides with other per-user settings.
 * The token itself is never returned to the browser.
 */

export interface GithubUserPatStorage {
  settings: {
    get(orgId: string, userId: string): Promise<Record<string, unknown> | null>;
    save(orgId: string, userId: string, config: Record<string, unknown>): Promise<unknown>;
  };
}

export interface GithubUserPatStatus {
  configured: boolean;
  /** The GitHub account the token belongs to, checked when it was saved. */
  login: string | null;
}

const settingsUserId = (userId: string) => `__github_user_pat__:${userId}`;

const asString = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

export async function getGithubUserPat(
  storage: GithubUserPatStorage,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const row = await storage.settings.get(orgId, settingsUserId(userId));
  return asString(row?.pat);
}

export async function getGithubUserPatStatus(
  storage: GithubUserPatStorage,
  orgId: string,
  userId: string,
): Promise<GithubUserPatStatus> {
  const row = await storage.settings.get(orgId, settingsUserId(userId));
  const configured = asString(row?.pat) !== null;
  return { configured, login: configured ? asString(row?.login) : null };
}

export async function setGithubUserPat(
  storage: GithubUserPatStorage,
  orgId: string,
  userId: string,
  pat: string,
  login: string,
): Promise<void> {
  await storage.settings.save(orgId, settingsUserId(userId), { pat, login });
}

export async function clearGithubUserPat(storage: GithubUserPatStorage, orgId: string, userId: string): Promise<void> {
  await storage.settings.save(orgId, settingsUserId(userId), {});
}
