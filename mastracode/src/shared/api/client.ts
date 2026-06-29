/**
 * Platform-agnostic HTTP client for the settings API.
 *
 * No DOM, no `window`, no `import.meta`, no hardcoded origin: the base URL and
 * the `fetch` implementation are injected. The web app injects `baseUrl: ''`
 * (same-origin, Vite proxies `/api`); a future React Native app injects its
 * server's absolute origin and (optionally) its own fetch.
 *
 * Error handling is centralized: a failing response is turned into an `Error`
 * whose message prefers the server's `{ error }` envelope and falls back to the
 * HTTP status. Hooks surface this; they do not parse responses themselves.
 */

export interface ApiClientConfig {
  /** Origin prefix for every request. `''` means same-origin. */
  baseUrl: string;
  /** Defaults to the global `fetch` (present in browsers and React Native). */
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string, body?: unknown): Promise<T>;
}

async function extractError(res: Response): Promise<string> {
  try {
    const data: unknown = await res.clone().json();
    if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  } catch {
    // Non-JSON body — fall through to the status-based message.
  }
  return `Request failed (${res.status})`;
}

export function createApiClient({ baseUrl, fetchImpl }: ApiClientConfig): ApiClient {
  const doFetch = fetchImpl ?? globalThis.fetch;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const res = await doFetch(`${baseUrl}${path}`, init);
    if (!res.ok) throw new Error(await extractError(res));
    return (await res.json()) as T;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  };
}
