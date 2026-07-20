export interface PlatformClientOptions {
  accessToken?: string;
  projectId?: string;
  fetch?: typeof fetch;
}

export interface PlatformRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_PROXY_URL = 'https://workspaces.mastra.ai';

/**
 * Default per-request timeout for calls to the workspace proxy. Applied only
 * when the caller doesn't already pass an `AbortSignal`. Long-running routes
 * (e.g. `POST /sandbox/:id/exec`) pass their own longer signal.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export function requireOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function resolvePlatformOptions(options: PlatformClientOptions) {
  return {
    accessToken: requireOption(options.accessToken ?? process.env.MASTRA_PLATFORM_ACCESS_TOKEN, 'accessToken'),
    projectId: requireOption(options.projectId ?? process.env.MASTRA_PROJECT_ID, 'projectId'),
    proxyUrl: (process.env.MASTRA_WORKSPACE_PROXY_URL ?? DEFAULT_PROXY_URL).replace(/\/$/, ''),
    fetch: options.fetch ?? fetch,
  };
}

/**
 * Structured error shape returned by the workspace proxy. All routes emit
 * `{ error: { message, type } }` on failure — see servers/workspace-proxy in
 * the Platform repo. Kept as a wire-level type so callers can switch on
 * `error.code` without re-parsing `error.body`.
 */
export interface PlatformProxyError {
  message: string;
  /** Machine-readable error kind, e.g. `not_found`, `invalid_request`, `authentication_error`. */
  type: string;
}

function parseProxyError(body: string): PlatformProxyError | undefined {
  if (!body) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const err = (parsed as { error?: unknown }).error;
  if (typeof err !== 'object' || err === null) return undefined;
  const { message, type } = err as { message?: unknown; type?: unknown };
  if (typeof message !== 'string' || typeof type !== 'string') return undefined;
  return { message, type };
}

export class PlatformApiError extends Error {
  readonly status: number;
  readonly body: string;
  /** Machine-readable proxy error kind (e.g. `not_found`), when the response body matches `{ error: { message, type } }`. */
  readonly code: string | undefined;
  /** Human-readable proxy error message, when the response body matches `{ error: { message, type } }`. */
  readonly proxyMessage: string | undefined;

  constructor(status: number, body: string) {
    const parsed = parseProxyError(body);
    const summary = parsed ? `${parsed.type}: ${parsed.message}` : body;
    super(`Platform proxy request failed with ${status}${summary ? `: ${summary}` : ''}`);
    this.name = 'PlatformApiError';
    this.status = status;
    this.body = body;
    this.code = parsed?.type;
    this.proxyMessage = parsed?.message;
  }
}

export class PlatformClient {
  readonly accessToken: string;
  readonly projectId: string;
  readonly proxyUrl: string;
  readonly fetch: typeof fetch;

  constructor(options: PlatformClientOptions) {
    const resolved = resolvePlatformOptions(options);
    this.accessToken = resolved.accessToken;
    this.projectId = resolved.projectId;
    this.proxyUrl = resolved.proxyUrl;
    this.fetch = resolved.fetch;
  }

  async request(path: string, options: PlatformRequestOptions = {}): Promise<Response> {
    const url = new URL(`${this.proxyUrl}/v1/projects/${encodeURIComponent(this.projectId)}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${this.accessToken}`);

    // Strip our helper-only field so the underlying fetch sees a valid RequestInit.
    const { query: _query, ...fetchOptions } = options;
    // Apply a default timeout only when the caller didn't already supply an
    // AbortSignal — long-running routes (exec) provide their own longer signal.
    const signal = fetchOptions.signal ?? AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS);
    const response = await this.fetch(url, { ...fetchOptions, headers, signal });
    if (!response.ok) {
      throw new PlatformApiError(response.status, await response.text());
    }
    return response;
  }
}
