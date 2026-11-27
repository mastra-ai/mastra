/**
 * Platform-agnostic HTTP client for the settings API.
 *
 * No DOM, no `window`, no `import.meta`, no hardcoded origin: the base URL and
 * the `fetch` implementation are injected. The web app injects `baseUrl: ''`
 * (same-origin, Vite proxies `/api`); a future React Native app injects its
 * server's absolute origin and (optionally) its own fetch.
 *
 * Error handling is centralized: a failing response is turned into an `Error`
 * whose message prefers the server's `{ message }`, then its `{ error }`, and falls back to the
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

/**
 * A non-2xx response. `status` lets callers treat specific statuses (like 404) differently, and `body` holds the
 * parsed JSON when a caller needs more than the message, such as the failure a refused save reports.
 */
export class ApiError extends Error {
  override name = 'ApiError';
  /** Builds the error from the message shown to people, the HTTP status and the parsed JSON body, if any. */
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/** Builds the `ApiError` for a failing response, reading its JSON body once. */
async function extractError(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body — fall through to the status-based message.
  }
  if (body && typeof body === 'object') {
    const message = 'message' in body ? body.message : undefined;
    const error = 'error' in body ? body.error : undefined;
    // `error` is often a machine code (`credentials_unavailable`); `message` is the sentence written for people.
    if (typeof message === 'string' && message) return new ApiError(message, res.status, body);
    if (typeof error === 'string') return new ApiError(error, res.status, body);
  }
  return new ApiError(`Request failed (${res.status})`, res.status, body);
}

export function createApiClient({ baseUrl, fetchImpl }: ApiClientConfig): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Read the global fetch per request, not once: the app builds its client at
    // startup, before anything that wraps fetch (a test's network mock) installs.
    const doFetch = fetchImpl ?? globalThis.fetch;
    // `credentials: 'include'` so cross-site session cookies are sent when the
    // SPA is hosted on a different origin than the API (platform deploy). It is
    // a no-op for same-origin local dev.
    const init: RequestInit = { method, credentials: 'include' };
    if (body instanceof Blob) {
      init.headers = { 'Content-Type': body.type };
      init.body = body;
    } else if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const res = await doFetch(`${baseUrl}${path}`, init);
    if (!res.ok) throw await extractError(res);
    return (await res.json()) as T;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  };
}
