/**
 * Browser-side helpers for connecting Platform-managed provider accounts
 * without leaving Factory.
 *
 * The server's `/web/integrations/platform/*` routes mint short-lived Nango
 * connect/reconnect sessions with the deploy's Platform machine credentials;
 * the browser then completes authorization headlessly with
 * `@nangohq/frontend` — the provider's own OAuth consent popup for OAuth
 * providers, or a direct credential submission for API-key providers. No
 * Nango-branded UI and no Mastra Platform round trip.
 */

import Nango, { AuthError } from '@nangohq/frontend';
import type { AuthOptions } from '@nangohq/frontend';

export type PlatformConnectProviderId = 'jira' | 'incident-io';

/** How the provider authorizes: OAuth consent popup or an API-key form. */
export type PlatformConnectAuthKind = 'oauth' | 'apiKey';

export interface PlatformConnectProviderMeta {
  id: PlatformConnectProviderId;
  displayName: string;
  authKind: PlatformConnectAuthKind;
}

export const PLATFORM_CONNECT_PROVIDERS: Record<PlatformConnectProviderId, PlatformConnectProviderMeta> = {
  jira: { id: 'jira', displayName: 'Jira', authKind: 'oauth' },
  'incident-io': { id: 'incident-io', displayName: 'incident.io', authKind: 'apiKey' },
};

export interface PlatformProviderConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
  displayName?: string | null;
}

export interface PlatformConnectSession {
  connectionId: string;
  integrationId: string;
  connectUrl: string;
  sessionToken: string;
  expiresAt: string;
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      code = body.error;
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    const err = new Error(message);
    (err as { code?: string }).code = code;
    throw err;
  }
  return (await res.json()) as T;
}

/** List the org's Platform connections for one provider (all auth variants). */
export async function listPlatformConnections(
  baseUrl: string,
  provider: PlatformConnectProviderId,
): Promise<PlatformProviderConnection[]> {
  const { connections } = await requestJson<{ connections: PlatformProviderConnection[] }>(
    baseUrl,
    `/web/integrations/platform/${provider}/connections`,
  );
  return connections;
}

/** Mint a Nango connect session for a new provider connection. */
export async function createPlatformConnectSession(
  baseUrl: string,
  provider: PlatformConnectProviderId,
): Promise<PlatformConnectSession> {
  return requestJson<PlatformConnectSession>(baseUrl, `/web/integrations/platform/${provider}/connect-session`, {
    method: 'POST',
  });
}

/** Mint a Nango reconnect session for an existing provider connection. */
export async function createPlatformReconnectSession(
  baseUrl: string,
  provider: PlatformConnectProviderId,
  connectionId: string,
): Promise<PlatformConnectSession> {
  return requestJson<PlatformConnectSession>(
    baseUrl,
    `/web/integrations/platform/${provider}/connections/${encodeURIComponent(connectionId)}/reconnect-session`,
    { method: 'POST' },
  );
}

export type HeadlessAuthFailure = 'popup_blocked' | 'window_closed' | 'failed';

export class HeadlessAuthError extends Error {
  constructor(
    message: string,
    readonly reason: HeadlessAuthFailure,
  ) {
    super(message);
    this.name = 'HeadlessAuthError';
  }
}

/**
 * Complete a minted connect/reconnect session headlessly. OAuth providers get
 * the provider's own consent popup; API-key providers submit the credential
 * directly with no popup. Mirrors Mastra Platform's own headless connect.
 */
export async function runHeadlessAuth(input: {
  session: PlatformConnectSession;
  credentials?: Record<string, string>;
}): Promise<void> {
  const nango = new Nango({ connectSessionToken: input.session.sessionToken });
  const options: AuthOptions = {};
  if (input.credentials) options.credentials = input.credentials;
  else options.detectClosedAuthWindow = true;
  try {
    await nango.auth(input.session.integrationId, options);
  } catch (error) {
    throw toHeadlessAuthError(error);
  }
}

function toHeadlessAuthError(error: unknown): HeadlessAuthError {
  if (error instanceof AuthError && error.type === 'blocked_by_browser') {
    return new HeadlessAuthError('Popup was blocked. Allow popups for this site and try again.', 'popup_blocked');
  }
  if (error instanceof AuthError && error.type === 'window_closed') {
    return new HeadlessAuthError('Authorization window was closed before the connection finished.', 'window_closed');
  }
  return new HeadlessAuthError(
    error instanceof Error && error.message ? error.message : 'Authorization failed.',
    'failed',
  );
}

const ACTIVE_POLL_INTERVAL_MS = 2_000;
const ACTIVE_POLL_DEADLINE_MS = 60_000;

/**
 * Wait for the connection to report `active`. The vendor confirms auth
 * asynchronously (webhook), so the row can lag the popup by a few seconds.
 * Resolves with the connection, or `null` when the deadline passes — callers
 * treat that as "still pending", not failure.
 */
export async function waitForActiveConnection(
  baseUrl: string,
  provider: PlatformConnectProviderId,
  connectionId: string,
  options: { intervalMs?: number; deadlineMs?: number } = {},
): Promise<PlatformProviderConnection | null> {
  const intervalMs = options.intervalMs ?? ACTIVE_POLL_INTERVAL_MS;
  const deadline = Date.now() + (options.deadlineMs ?? ACTIVE_POLL_DEADLINE_MS);
  for (;;) {
    const connections = await listPlatformConnections(baseUrl, provider);
    const connection = connections.find(candidate => candidate.id === connectionId);
    if (connection?.status === 'active') return connection;
    if (Date.now() >= deadline) return null;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
