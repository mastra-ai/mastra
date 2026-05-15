let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the session via the Mastra server's auth refresh endpoint.
 * Returns true if the refresh succeeded (new cookie is set).
 */
async function refreshSession(baseUrl: string, apiPrefix: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}${apiPrefix}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch wrapper that automatically attempts to refresh the session on 401 errors.
 *
 * When a request returns 401, this will:
 * 1. Call /api/auth/refresh to get a fresh session cookie
 * 2. If refresh succeeds, retry the original request
 * 3. If refresh fails, return the original 401 response
 *
 * Concurrent 401s share the same refresh call to avoid multiple refresh attempts.
 *
 * @param baseUrl - The base URL of the Mastra server (e.g., from useMastraClient)
 * @param input - The URL or Request to fetch
 * @param init - Optional fetch init options
 * @returns The fetch response
 */
export async function fetchWithRefresh(
  baseUrl: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Normalize into a Request so we can clone it for retry (body streams are single-use)
  const request = new Request(input, init);
  const retry = request.clone();

  const res = await fetch(request);

  if (res.status !== 401) return res;

  // Don't intercept the refresh call itself to avoid infinite loops
  if (new URL(request.url).pathname.endsWith('/auth/refresh')) return res;

  if (!refreshPromise) {
    refreshPromise = refreshSession(baseUrl, '/api').finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  if (!refreshed) return res;

  // Retry with the cloned request (body intact)
  return fetch(retry);
}

/**
 * Creates a fetch function that automatically refreshes the session on 401 errors.
 * This can be passed to MastraClient as the `fetch` option.
 *
 * @param baseUrl - The base URL of the Mastra server
 * @param apiPrefix - The API prefix (defaults to '/api')
 * @returns A fetch-compatible function that handles 401 refresh
 */
export function createFetchWithRefresh(baseUrl: string, apiPrefix: string = '/api'): typeof fetch {
  let localRefreshPromise: Promise<boolean> | null = null;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const retry = request.clone();

    const res = await fetch(request);

    if (res.status !== 401) return res;

    // Don't intercept the refresh call itself to avoid infinite loops
    if (request.url.includes('/auth/refresh')) return res;

    if (!localRefreshPromise) {
      localRefreshPromise = refreshSession(baseUrl, apiPrefix).finally(() => {
        localRefreshPromise = null;
      });
    }

    const refreshed = await localRefreshPromise;
    if (!refreshed) return res;

    // Retry with the cloned request (body intact)
    return fetch(retry);
  };
}
