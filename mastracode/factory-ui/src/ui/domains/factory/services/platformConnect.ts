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

export type PlatformConnectProviderId =
  | 'jira'
  | 'incident-io'
  | 'notion'
  | 'confluence'
  | 'linear'
  | 'zendesk'
  | 'fireflies';

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
  notion: { id: 'notion', displayName: 'Notion', authKind: 'oauth' },
  confluence: { id: 'confluence', displayName: 'Confluence', authKind: 'oauth' },
  linear: { id: 'linear', displayName: 'Linear', authKind: 'oauth' },
  zendesk: { id: 'zendesk', displayName: 'Zendesk', authKind: 'oauth' },
  fireflies: { id: 'fireflies', displayName: 'Fireflies', authKind: 'oauth' },
};

/**
 * Subset of {@link PlatformConnectProviderId} that Factory's Knowledge
 * Importers settings section exposes. `jira` is intentionally excluded — it's
 * already surfaced via the intake/general Connections section, so listing it
 * twice would confuse the connection-state semantics (one connection powering
 * two features).
 */
export const KNOWLEDGE_IMPORTER_PROVIDER_IDS: readonly PlatformConnectProviderId[] = [
  'notion',
  'confluence',
  'linear',
  'zendesk',
  'fireflies',
];

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

/**
 * A single row from the Platform integration catalog, projected to the SPA's
 * provider slug. `logoUrl` is the Nango-served template logo URL if the
 * Platform catalog knows about this integration, otherwise `null`.
 */
export interface PlatformCatalogEntry {
  provider: PlatformConnectProviderId;
  integrationId: string;
  displayName: string | null;
  logoUrl: string | null;
}

/**
 * Load the Platform integration catalog. Returns one row per registered
 * connect provider — the server projects `PLATFORM_CONNECT_PROVIDERS` onto
 * the Platform's `/v2/integrations` response so the SPA never has to
 * discover slugs of its own.
 */
export async function listPlatformCatalog(baseUrl: string): Promise<PlatformCatalogEntry[]> {
  const { integrations } = await requestJson<{ integrations: PlatformCatalogEntry[] }>(
    baseUrl,
    `/web/integrations/platform/catalog`,
  );
  return integrations;
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
    try {
      const connections = await listPlatformConnections(baseUrl, provider);
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
