import createClient from 'openapi-fetch';

import type { paths } from '../platform-api.js';

export const MASTRA_PLATFORM_API_URL = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';

/**
 * Derive the gateway URL from the platform URL when not explicitly set.
 * If the platform points at staging, the gateway defaults to staging too.
 */
function deriveGatewayUrl(): string {
  if (process.env.MASTRA_GATEWAY_URL) return process.env.MASTRA_GATEWAY_URL;
  if (MASTRA_PLATFORM_API_URL.includes('staging')) return 'https://gateway-api.staging.mastra.ai/v1';
  return 'https://gateway-api.mastra.ai/v1';
}

export const MASTRA_GATEWAY_URL = deriveGatewayUrl();

/**
 * Derive the studio URL from the platform URL when not explicitly set.
 * If the platform points at staging, the studio defaults to staging too.
 */
function deriveStudioUrl(): string {
  if (process.env.MASTRA_STUDIO_URL) return process.env.MASTRA_STUDIO_URL;
  if (MASTRA_PLATFORM_API_URL.includes('staging')) return 'https://studio.staging.mastra.ai';
  return 'https://studio.mastra.ai';
}

export const MASTRA_STUDIO_URL = deriveStudioUrl();

export const SESSION_EXPIRED_MESSAGE = 'Session expired. Run: mastra auth login';

/**
 * Throw a standardized error for API failures.
 * - 401: "Session expired" (authentication failed)
 * - Other: Show the server's error detail or fall back to status code
 */
export function throwApiError(message: string, status: number, detail?: string): never {
  if (status === 401) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  if (detail) {
    throw new Error(detail);
  }
  throw new Error(`${message}: ${status}`);
}

// Shared mutable token state — updated by refreshes so all callers see the latest.
let _currentToken: string | null = null;
let _currentOrgId: string | null = null;
let _refreshInFlight: Promise<string> | null = null;

/**
 * Set the current token/orgId used by authenticated fetch.
 * Call this after login or getToken().
 */
export function setCurrentAuth(token: string, orgId?: string) {
  _currentToken = token;
  if (orgId !== undefined) _currentOrgId = orgId;
}

/**
 * Get the current token, if one has been set.
 */
export function getCurrentToken(): string | null {
  return _currentToken;
}

/**
 * A fetch wrapper that auto-refreshes the token on 401 and retries once.
 * Used by both createApiClient (openapi-fetch) and raw fetch calls.
 */
async function authenticatedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  // openapi-fetch passes a single Request object (no init). If the first
  // fetch() returns 401 we need to retry, but the original Request's body
  // will already be consumed. Clone it up front so the retry can use the clone.
  const clonedRequest = input instanceof Request ? input.clone() : null;

  // Prime _currentToken from the request headers so the 401-retry path works
  // even when callers use platformFetch() directly instead of createApiClient().
  if (!_currentToken) {
    const authHeader =
      (input instanceof Request ? input.headers.get('Authorization') : null) ??
      (init?.headers instanceof Headers
        ? init.headers.get('Authorization')
        : typeof init?.headers === 'object' && init.headers && !Array.isArray(init.headers)
          ? (init.headers as Record<string, string>)['Authorization']
          : null);
    if (authHeader?.startsWith('Bearer ')) {
      _currentToken = authHeader.slice(7);
    }
  }

  const response = await fetch(input, init);

  if (response.status !== 401 || !_currentToken) {
    return response;
  }

  // Avoid multiple concurrent refreshes
  if (!_refreshInFlight) {
    _refreshInFlight = (async () => {
      try {
        // Dynamic import to avoid circular dependency
        const { tryRefreshToken, loadCredentials } = await import('./credentials.js');
        const creds = await loadCredentials();
        if (!creds) throw new Error('No credentials');

        const newToken = await tryRefreshToken(creds);
        if (!newToken) throw new Error('Refresh failed');

        _currentToken = newToken;
        return newToken;
      } finally {
        _refreshInFlight = null;
      }
    })();
  }

  let newToken: string;
  try {
    newToken = await _refreshInFlight;
  } catch {
    // Refresh failed — return the original 401 response
    return response;
  }

  // Retry with the refreshed token.
  if (clonedRequest) {
    // Rebuild from the clone so headers + body are intact.
    const retryHeaders = new Headers(clonedRequest.headers);
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    return fetch(new Request(clonedRequest, { headers: retryHeaders }));
  }

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  return fetch(input, { ...init, headers: retryHeaders });
}

/**
 * Create a typed API client with Bearer token + org ID headers.
 * Uses authenticatedFetch for automatic 401 retry.
 */
export function createApiClient(token: string, orgId?: string) {
  setCurrentAuth(token, orgId);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }

  return createClient<paths>({
    baseUrl: MASTRA_PLATFORM_API_URL,
    headers,
    fetch: authenticatedFetch,
  });
}

/**
 * Build auth headers for raw fetch calls (zip upload, SSE streaming, tokens).
 */
export function authHeaders(token: string, orgId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  return headers;
}

/**
 * Make an authenticated fetch call that auto-refreshes on 401.
 * Use this instead of raw fetch() for platform API calls.
 */
export function platformFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return authenticatedFetch(input, init);
}
