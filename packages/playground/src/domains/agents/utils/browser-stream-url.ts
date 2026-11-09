interface BuildBrowserStreamUrlOptions {
  agentId: string;
  threadId: string;
  /** Single-use upgrade ticket. Omit for deployments that authenticate from a session cookie. */
  ticket?: string;
}

/**
 * Build the WebSocket URL for an agent's browser stream.
 *
 * The route lives outside the API prefix and authenticates from the same-origin
 * session cookie, or from a single-use upgrade ticket minted over an
 * authenticated request. A reusable credential is never placed in this URL:
 * query strings are retained by proxies and access logs.
 */
export function buildBrowserStreamUrl({ agentId, threadId, ticket }: BuildBrowserStreamUrlOptions): string {
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const streamUrl = `${wsProtocol}//${host}/browser/${agentId}/stream?threadId=${encodeURIComponent(threadId)}`;

  if (!ticket) return streamUrl;
  return `${streamUrl}&ticket=${encodeURIComponent(ticket)}`;
}
