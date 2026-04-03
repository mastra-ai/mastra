let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the session via the Mastra server's auth refresh endpoint.
 * Returns true if the refresh succeeded (new cookie is set).
 */
async function refreshSession(baseUrl: string): Promise<boolean> {
  try {
    console.info('[fetchWithRefresh] calling refresh:', `${baseUrl}/api/auth/refresh`);
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    console.info('[fetchWithRefresh] refresh response:', res.status, res.ok);
    return res.ok;
  } catch (err) {
    console.info('[fetchWithRefresh] refresh error:', err);
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

  console.info('[fetchWithRefresh] initial response:', request.url, res.status);
  if (res.status !== 401) return res;

  // Don't intercept the refresh call itself to avoid infinite loops
  if (request.url.includes('/auth/refresh')) {
    console.info('[fetchWithRefresh] skipping refresh for refresh endpoint');
    return res;
  }

  console.info('[fetchWithRefresh] got 401, attempting refresh...');
  if (!refreshPromise) {
    refreshPromise = refreshSession(baseUrl).finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  console.info('[fetchWithRefresh] refresh result:', refreshed);
  if (!refreshed) return res;

  // Retry with the cloned request (body intact)
  console.info('[fetchWithRefresh] retrying original request...');
  return fetch(retry);
}
