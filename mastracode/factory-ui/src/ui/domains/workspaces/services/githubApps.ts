/**
 * The org's move from the legacy GitHub App to the Mastra Factory apps, and
 * each user's own GitHub identity once it has moved.
 */

import { runHeadlessAuth } from '../../factory/services/platformConnect';
import type { PlatformConnectSession, PlatformProviderConnection } from '../../factory/services/platformConnect';

export type FactoryGithubApp = 'factory-github' | 'factory-reviews-github';

export interface GithubSwitchMissing {
  /** Apps with no active connection at all. */
  apps: FactoryGithubApp[];
  /** Accounts the org's repositories come from that an app isn't installed on. */
  accounts: Array<{ accountLogin: string; apps: FactoryGithubApp[] }>;
  /** Repositories linked to a project that an app's installation can't reach. */
  repositories: Array<{ slug: string; githubRepositoryId: string; accountLogin: string; apps: FactoryGithubApp[] }>;
  /** App connections whose installation could not be read. */
  unreadable: Array<{ connectionId: string; app: FactoryGithubApp; message: string }>;
}

export interface GithubSwitchStatus {
  mode: 'legacy' | 'connect';
  switchedAt: number | null;
  connections: Array<{
    id: string;
    app: FactoryGithubApp;
    status: PlatformProviderConnection['status'];
    accountLogin: string | null;
  }>;
  /** What the switch still needs. Absent once the org has switched. */
  plan?: { ready: boolean; missing: GithubSwitchMissing };
}

export interface OwnGithub {
  connection: { id: string; status: PlatformProviderConnection['status']; accountLabel: string | null } | null;
  pat: { configured: boolean; login: string | null };
}

export class GithubAppsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'GithubAppsRequestError';
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const { error, message } = (body ?? {}) as { error?: string; message?: string };
    throw new GithubAppsRequestError(message ?? error ?? `Request failed (${res.status})`, res.status, error, body);
  }
  return body as T;
}

/** The org's switch status, or `null` for users who may not switch it (not an org admin, auth off). */
export async function fetchGithubSwitchStatus(baseUrl: string): Promise<GithubSwitchStatus | null> {
  try {
    return await request<GithubSwitchStatus>(baseUrl, '/web/integrations/platform/github/switch');
  } catch (error) {
    if (error instanceof GithubAppsRequestError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}

/** Switches the org to the Mastra Factory apps. A refusal throws with the server's reason in `body`. */
export function switchGithubApps(baseUrl: string): Promise<{ switched: boolean; mode: 'connect' }> {
  return request(baseUrl, '/web/integrations/platform/github/switch', { method: 'POST' });
}

export function fetchOwnGithub(baseUrl: string): Promise<OwnGithub> {
  return request<OwnGithub>(baseUrl, '/web/github/user-connection');
}

/** Connects the signed-in user's own GitHub account, through the Mastra Factory app's OAuth. */
export async function connectOwnGithub(baseUrl: string): Promise<void> {
  const session = await request<PlatformConnectSession>(baseUrl, '/web/github/user-connection/connect-session', {
    method: 'POST',
  });
  await runHeadlessAuth({ session });
}

export function saveOwnGithubPat(baseUrl: string, token: string): Promise<OwnGithub['pat']> {
  return request(baseUrl, '/web/github/user-pat', { method: 'POST', body: JSON.stringify({ token }) });
}

export function deleteOwnGithubPat(baseUrl: string): Promise<OwnGithub['pat']> {
  return request(baseUrl, '/web/github/user-pat', { method: 'DELETE' });
}
