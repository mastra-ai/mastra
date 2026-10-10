const AUTHORIZATION_HEADER = 'authorization';

/**
 * Read the credential Studio should present to the browser stream from its
 * configured headers.
 *
 * Studio deployments may authenticate every request with an
 * `Authorization: Bearer <token>` header. The `WebSocket` API can't set request
 * headers, so that token has to travel as the `apiKey` query parameter instead.
 * The `Bearer ` prefix is stripped the same way the server strips it, so both
 * paths carry the same token.
 */
export function readBrowserStreamToken(headers: Record<string, string> | undefined): string | undefined {
  const entry = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === AUTHORIZATION_HEADER);
  if (!entry) return undefined;

  const token = entry[1].replace(/^Bearer\s+/i, '').trim();
  return token === '' ? undefined : token;
}

interface BuildBrowserStreamUrlOptions {
  agentId: string;
  threadId: string;
  /** Credential to append as `apiKey`. Omit for cookie-authenticated deployments. */
  token?: string;
}

/**
 * Build the WebSocket URL for an agent's browser stream.
 *
 * The route lives outside the API prefix and authenticates from the same-origin
 * session cookie, or from the `apiKey` query parameter for deployments that
 * authenticate with a header token.
 */
export function buildBrowserStreamUrl({ agentId, threadId, token }: BuildBrowserStreamUrlOptions): string {
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const streamUrl = `${wsProtocol}//${host}/browser/${agentId}/stream?threadId=${encodeURIComponent(threadId)}`;

  if (!token) return streamUrl;
  return `${streamUrl}&apiKey=${encodeURIComponent(token)}`;
}
