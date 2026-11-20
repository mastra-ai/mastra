/**
 * Wire contract of the end-user connect surface that `userConnectRoutes()`
 * from `@mastra/connect` mounts on the dev server (default base path
 * `/connect`). These routes are custom `apiRoutes`, so they are not part of
 * the `@mastra/client-js` SDK — the shapes below mirror
 * `packages/connect/src/user-connect-routes.ts` and must stay in sync with it.
 */

export interface UserConnectAuthField {
  name: string;
  /**
   * Where the value goes in a headless auth call: `credentials` are
   * exchanged with the provider, `params` configure the flow (e.g. an MCP
   * server URL). Missing (older servers) is treated as `credentials`.
   */
  target?: 'credentials' | 'params' | null;
  label?: string | null;
  description?: string | null;
  placeholder?: string | null;
  defaultValue?: string | null;
  /** Value format to validate against; unknown formats are ignored. */
  format?: string | null;
  pattern?: string | null;
  /** When set, the value must be one of these options (rendered as a select). */
  options?: readonly string[] | null;
  prefix?: string | null;
  suffix?: string | null;
  documentationUrl?: string | null;
  /** Warnings to show when the field holds a given value, keyed by value. */
  warnings?: Readonly<Record<string, string>> | null;
  /** Only show (and submit) the field while another field equals a value. */
  visibleWhen?: { field: string; equals: string } | null;
  secret?: boolean | null;
  required?: boolean | null;
  order?: number | null;
}

/** JSON redemption of the launch gate (`Accept: application/json`). */
export interface UserConnectLaunchTokenResponse {
  /**
   * Nango connect session token for headless authorization, or null when the
   * server could not extract one — the client then falls back to the hosted
   * popup through the same gate's 302 flow.
   */
  sessionToken: string | null;
  expiresAt: string;
}

export interface UserConnectProvider {
  id: string;
  displayName: string | null;
  logoUrl: string | null;
  authType: string | null;
  authFields: UserConnectAuthField[] | null;
}

export interface UserConnectProvidersResponse {
  providers: UserConnectProvider[];
}

export type UserConnectionScope = 'global' | 'user';

export interface UserConnection {
  id: string;
  integrationId: string;
  /**
   * Display metadata resolved server-side against the FULL platform catalog
   * (not the policy-filtered provider list), so rows for de-allowlisted
   * providers still render properly. Null when the catalog has no entry or
   * the lookup failed.
   */
  displayName: string | null;
  logoUrl: string | null;
  status: string;
  accountLabel: string | null;
  scope: UserConnectionScope;
}

export interface UserConnectionsResponse {
  connections: UserConnection[];
}

export interface UserConnectSessionResponse {
  connectionId: string;
  integrationId: string;
  /**
   * Server-relative launch-gate path (`{basePath}/connections/:id/launch`).
   * The popup navigates here — same-origin with the Mastra server and
   * authenticated — and the server verifies this browser owns the pending
   * session before 302ing into the vendor OAuth flow. The raw vendor connect
   * URL is never exposed to the browser.
   */
  launchUrl: string;
  expiresAt: string | null;
}

export interface UserConnectionStatusResponse {
  id: string;
  status: string;
  scope: UserConnectionScope;
}

export interface UserConnectErrorBody {
  error: { code: string; message: string };
}

/**
 * One provider in the structured output of the built-in `request_connection`
 * tool (`@mastra/connect`'s `ConnectPromptProvider`). Chat renders these as a
 * connect card.
 */
export interface ConnectPromptProvider {
  id: string;
  displayName: string | null;
  logoUrl: string | null;
  authType: string | null;
  /** Fields the UI must collect before starting headless authorization. */
  authFields: UserConnectAuthField[] | null;
  connected: boolean;
  scope: UserConnectionScope | null;
}

/** Structured output of the built-in `request_connection` tool. */
export interface ConnectPromptPayload {
  type: 'connect-prompt';
  requestedProvider?: string;
  providers: ConnectPromptProvider[];
  /** Outcome for the model once a paused prompt resumes, e.g. "Linear connected successfully." */
  message?: string;
  /** Why the connection failed, when a paused prompt resumed without one. */
  error?: string;
}

/**
 * What the card resumes a paused `request_connection` call with once the
 * connection settles: `active`, or `failed` with the reason the card showed.
 */
export type ConnectPromptResume =
  | { provider: string; status: 'active' }
  | { provider: string; status: 'failed'; error: string };

/** Narrows an arbitrary tool output to a connect-prompt payload. */
export function isConnectPromptPayload(output: unknown): output is ConnectPromptPayload {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { type?: unknown }).type === 'connect-prompt' &&
    Array.isArray((output as { providers?: unknown }).providers)
  );
}
