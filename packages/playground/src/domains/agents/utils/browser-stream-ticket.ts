const DEFAULT_API_PREFIX = '/api';

interface RequestBrowserStreamTicketOptions {
  agentId: string;
  threadId: string;
  baseUrl?: string;
  apiPrefix?: string;
  /** Studio's configured request headers, including any `Authorization` token. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function normalizeApiPrefix(apiPrefix: string | undefined): string {
  const prefix = apiPrefix ?? DEFAULT_API_PREFIX;
  const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return trimmed || DEFAULT_API_PREFIX;
}

/**
 * Exchange Studio's configured credentials for a single-use browser stream
 * upgrade ticket.
 *
 * The `WebSocket` API can't set request headers, so a deployment that
 * authenticates every request with an `Authorization` header has no way to
 * present that credential on the handshake. Sending it as a query parameter
 * would leak a reusable secret into proxy and access logs, so this mints a
 * short-lived, single-use ticket over an ordinary authenticated request instead.
 *
 * Returns `undefined` when no ticket can be obtained — there is no fallback that
 * puts the reusable credential in the URL, so callers connect unauthenticated
 * and let the server reject the upgrade.
 */
export async function requestBrowserStreamTicket({
  agentId,
  threadId,
  baseUrl,
  apiPrefix,
  headers,
  signal,
}: RequestBrowserStreamTicketOptions): Promise<string | undefined> {
  const prefix = normalizeApiPrefix(apiPrefix);
  const url = `${baseUrl ?? ''}${prefix}/agents/${encodeURIComponent(agentId)}/browser/stream-ticket`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ threadId }),
      signal,
    });

    if (!response.ok) return undefined;

    const body = (await response.json()) as { ticket?: unknown };
    return typeof body.ticket === 'string' && body.ticket !== '' ? body.ticket : undefined;
  } catch {
    return undefined;
  }
}
