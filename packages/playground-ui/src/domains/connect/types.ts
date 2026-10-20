/**
 * Wire contract of the end-user connect surface that `userConnectRoutes()`
 * from `@mastra/connect` mounts on the dev server (default base path
 * `/connect`). These routes are custom `apiRoutes`, so they are not part of
 * the `@mastra/client-js` SDK — the shapes below mirror
 * `packages/connect/src/user-connect-routes.ts` and must stay in sync with it.
 */

export interface UserConnectAuthField {
  name: string;
  label?: string | null;
  description?: string | null;
  placeholder?: string | null;
  secret?: boolean | null;
  required?: boolean | null;
  order?: number | null;
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
  connected: boolean;
  scope: UserConnectionScope | null;
}

/** Structured output of the built-in `request_connection` tool. */
export interface ConnectPromptPayload {
  type: 'connect-prompt';
  requestedProvider?: string;
  providers: ConnectPromptProvider[];
}

/** Narrows an arbitrary tool output to a connect-prompt payload. */
export function isConnectPromptPayload(output: unknown): output is ConnectPromptPayload {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { type?: unknown }).type === 'connect-prompt' &&
    Array.isArray((output as { providers?: unknown }).providers)
  );
}
