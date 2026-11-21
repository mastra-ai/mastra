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

export type PlatformConnectProviderId = 'jira' | 'incident-io' | 'gitlab' | 'vanta' | 'linear';

export const MASTRA_PLATFORM_URL = 'https://projects.mastra.ai';

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
  gitlab: { id: 'gitlab', displayName: 'GitLab', authKind: 'oauth' },
  vanta: { id: 'vanta', displayName: 'Vanta', authKind: 'oauth' },
  linear: { id: 'linear', displayName: 'Linear', authKind: 'oauth' },
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
    let reason: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; reason?: string; message?: string };
      code = body.error;
      reason = body.reason;
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    const err = new Error(message);
    (err as { code?: string }).code = code;
    (err as { reason?: string }).reason = reason;
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

export interface ConnectToolConnection {
  id: string;
  integrationId: string;
  providerName: string;
  logoUrl: string | null;
  accountLabel: string | null;
  status: string;
}

/** The one piece of setup a Factory lacks to list its project's connections. */
export type ConnectToolsSetupMissing = 'no_credentials' | 'no_project_id';

/**
 * Why the server can't list Connect tools: the missing setup piece, `unknown` from servers that predate the reason,
 * or `undefined` when the error isn't the "off" answer at all.
 */
export function connectToolsOffReason(error: unknown): ConnectToolsSetupMissing | 'unknown' | undefined {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'connect_tools_off') return undefined;
  const reason = 'reason' in error ? error.reason : undefined;
  return reason === 'no_credentials' || reason === 'no_project_id' ? reason : 'unknown';
}

export interface ConnectTools {
  /** The Platform project whose connections sessions get as tools. */
  projectId: string;
  /**
   * `default`: sessions get Factory's own Connect tools. `custom`: the Factory's `tools` option sets session tools.
   * Servers that predate this field omit it.
   */
  toolsSource?: 'default' | 'custom';
  connections: ConnectToolConnection[];
}

export async function listConnectTools(baseUrl: string): Promise<ConnectTools> {
  return requestJson<ConnectTools>(baseUrl, '/web/integrations/platform/connect-tools');
}

/** One tool a session gets from the Connect tools source, or one Factory leaves out by default. */
export interface ConnectToolInfo {
  name: string;
  description: string | null;
  /** The tool pauses the run until someone approves each call. */
  requiresApproval: boolean;
  /** Factory leaves this default Connect tool out of sessions: its name says it deletes or archives. */
  excluded?: 'destructive';
}

export interface ConnectToolList {
  toolsSource: 'default' | 'custom';
  tools: ConnectToolInfo[];
}

export async function listConnectToolList(baseUrl: string): Promise<ConnectToolList> {
  return requestJson<ConnectToolList>(baseUrl, '/web/integrations/platform/connect-tools/tools');
}

export interface ConnectToolGroups {
  /** Tools by the integration id their name starts with (`posthog_get_insight` → `posthog`). */
  byIntegration: Map<string, ConnectToolInfo[]>;
  /** Tools from no listed connection, such as MCP or custom tools a `tools` option adds. */
  other: ConnectToolInfo[];
}

/** Connect names each tool `<integrationId>_<tool>`, so a tool belongs to the connection its name starts with. */
export function groupConnectTools(tools: ConnectToolInfo[], integrationIds: string[]): ConnectToolGroups {
  // Longest id first, so an id that starts another id can't take its tools.
  const ids = [...new Set(integrationIds)].sort((a, b) => b.length - a.length);
  const byIntegration = new Map<string, ConnectToolInfo[]>();
  const other: ConnectToolInfo[] = [];
  for (const tool of tools) {
    const id = ids.find(candidate => tool.name.startsWith(`${candidate}_`));
    if (!id) {
      other.push(tool);
      continue;
    }
    const group = byIntegration.get(id) ?? [];
    group.push(tool);
    byIntegration.set(id, group);
  }
  return { byIntegration, other };
}

/**
 * The Connect settings page of the Platform project. Without the organization id, Platform's `/org/*` route fills in
 * the user's current organization.
 */
export function platformProjectConnectUrl(projectId: string, organizationId?: string): string {
  const org = organizationId ? `orgs/${encodeURIComponent(organizationId)}` : 'org';
  return `${MASTRA_PLATFORM_URL}/${org}/projects/${encodeURIComponent(projectId)}/settings/connect`;
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
