/** Send the browser to an MCP server's sign-in page. */
export function goToMcpServerSignIn(authorizationUrl: string): void {
  window.location.assign(authorizationUrl);
}

/** Search params the OAuth callback adds when it returns an admin to MCP server settings. */
export const MCP_OAUTH_RETURN_PARAMS = ['mcpServer', 'oauth', 'reason'] as const;

export type McpOAuthReturn = { serverId: string | null } & ({ ok: true } | { ok: false; message: string });

const FAILED = "The server's sign-in did not complete. Sign in again.";

const FAILURE_MESSAGES: Record<string, string> = {
  invalid_state: 'The sign-in link was not valid. Sign in again.',
  signed_out: 'You were signed out of the Factory during sign-in. Sign in to the Factory, then try again.',
  unavailable: 'Sign-in is unavailable right now. Try again later.',
  expired: 'The sign-in expired or was already used. Sign in again.',
  forbidden: 'Only organization admins can sign in to MCP servers.',
  not_found: 'That MCP server was removed.',
  denied: "Access was denied on the server's sign-in page.",
  failed: FAILED,
  changed: 'The server changed while you were signing in. Sign in again.',
  connect_failed: "Signed in, but the server's tools could not be loaded. Refresh its tools to try again.",
};

/** What the OAuth callback reported, or `null` when the page was not opened by it. */
export function readMcpOAuthReturn(params: URLSearchParams): McpOAuthReturn | null {
  const outcome = params.get('oauth');
  if (!outcome) return null;
  const serverId = params.get('mcpServer');
  if (outcome === 'connected') return { serverId, ok: true };
  return {
    serverId,
    ok: false,
    message: FAILURE_MESSAGES[params.get('reason') ?? ''] ?? FAILED,
  };
}
