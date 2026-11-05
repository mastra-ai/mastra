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

export type PlatformConnectProviderId = 'jira' | 'incident-io' | 'gitlab';

export interface PlatformConnectAuthField {
  name: string;
  target: 'credentials' | 'params';
  label: string;
  description: string | null;
  placeholder: string | null;
  secret: boolean;
  required: boolean;
}

export interface PlatformCatalogProvider {
  id: string;
  displayName: string;
  logoUrl: string | null;
  authType: string | null;
  mcp: boolean;
  authFields: PlatformConnectAuthField[];
}

export type PlatformConnectProvider = Pick<PlatformCatalogProvider, 'id' | 'displayName' | 'authType' | 'authFields'>;

export const PLATFORM_CONNECT_PROVIDERS: Record<PlatformConnectProviderId, PlatformConnectProvider> = {
  jira: { id: 'jira', displayName: 'Jira', authType: 'OAUTH2', authFields: [] },
  'incident-io': { id: 'incident-io', displayName: 'incident.io', authType: 'API_KEY', authFields: [] },
  gitlab: { id: 'gitlab', displayName: 'GitLab', authType: 'OAUTH2', authFields: [] },
};

function isPlatformConnectProviderId(id: string): id is PlatformConnectProviderId {
  return Object.hasOwn(PLATFORM_CONNECT_PROVIDERS, id);
}

export interface PlatformProviderConnection {
  id: string;
  integrationId: string;
  status: string;
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
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      ...init,
    });
  } catch (cause) {
    const err = new Error('Network request failed');
    (err as { transient?: boolean }).transient = true;
    (err as { cause?: unknown }).cause = cause;
    throw err;
  }
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
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

/**
 * Only confirmed transient failures are worth retrying: fetch rejections
 * (tagged by `requestJson`) and 5xx responses. Everything else — 4xx (auth,
 * gating) and contract failures like malformed JSON — fails immediately.
 */
function isRetryableListFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { transient?: boolean }).transient === true) return true;
  const status = (error as { status?: number }).status;
  return status !== undefined && status >= 500;
}

/**
 * True when the server says Platform connect is not offered here (auth off,
 * no Platform credentials) — a 403/404, as opposed to a transient failure.
 * Consumers hide the feature for the former and show a retry for the latter.
 */
export function isPlatformConnectUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  return status === 403 || status === 404;
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

export async function listAllPlatformConnections(baseUrl: string): Promise<PlatformProviderConnection[]> {
  const { connections } = await requestJson<{ connections: PlatformProviderConnection[] }>(
    baseUrl,
    '/web/integrations/platform/connections',
  );
  return connections;
}

export async function listPlatformCatalog(baseUrl: string): Promise<PlatformCatalogProvider[]> {
  const { providers } = await requestJson<{ providers: PlatformCatalogProvider[] }>(
    baseUrl,
    '/web/integrations/platform/catalog',
  );
  return providers;
}

/** Mint a Nango connect session for a new provider connection. */
export async function createPlatformConnectSession(baseUrl: string, provider: string): Promise<PlatformConnectSession> {
  return requestJson<PlatformConnectSession>(
    baseUrl,
    `/web/integrations/platform/${encodeURIComponent(provider)}/connect-session`,
    { method: 'POST' },
  );
}

/** Mint a Nango reconnect session for an existing provider connection. */
export async function createPlatformReconnectSession(
  baseUrl: string,
  provider: string,
  connectionId: string,
): Promise<PlatformConnectSession> {
  return requestJson<PlatformConnectSession>(
    baseUrl,
    `/web/integrations/platform/${encodeURIComponent(provider)}/connections/${encodeURIComponent(connectionId)}/reconnect-session`,
    { method: 'POST' },
  );
}

export interface HeadlessAuthInput {
  authType?: string | null;
  credentials?: Record<string, string>;
  params?: Record<string, string>;
}

/**
 * Complete a minted connect/reconnect session headlessly. OAuth providers get
 * the provider's own consent popup; API-key providers submit the credential
 * directly with no popup. Flow params (an MCP server URL) ride along either way.
 */
export async function runHeadlessAuth({
  session,
  authType,
  credentials,
  params,
}: HeadlessAuthInput & { session: PlatformConnectSession }): Promise<void> {
  const nango = new Nango({ connectSessionToken: session.sessionToken });
  const options: AuthOptions = {};
  if (credentials) options.credentials = authType === 'TWO_STEP' ? { type: 'TWO_STEP', ...credentials } : credentials;
  else options.detectClosedAuthWindow = true;
  if (params) options.params = params;
  try {
    await nango.auth(session.integrationId, options);
  } catch (error) {
    throw toHeadlessAuthError(error);
  }
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
  provider: string,
  connectionId: string,
  options: { intervalMs?: number; deadlineMs?: number } = {},
): Promise<PlatformProviderConnection | null> {
  const intervalMs = options.intervalMs ?? ACTIVE_POLL_INTERVAL_MS;
  const deadline = Date.now() + (options.deadlineMs ?? ACTIVE_POLL_DEADLINE_MS);
  const list = isPlatformConnectProviderId(provider)
    ? () => listPlatformConnections(baseUrl, provider)
    : () => listAllPlatformConnections(baseUrl);
  for (;;) {
    try {
      const connections = await list();
      const connection = connections.find(candidate => candidate.id === connectionId);
      if (connection?.status === 'active') return connection;
    } catch (error) {
      // A transient list failure must not fail the whole connect flow — the
      // vendor may already have confirmed auth. Keep polling until the
      // deadline; permanent (4xx) failures still reject.
      if (!isRetryableListFailure(error)) throw error;
    }
    if (Date.now() >= deadline) return null;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
