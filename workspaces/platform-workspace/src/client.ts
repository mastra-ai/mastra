export interface PlatformClientOptions {
  accessToken?: string;
  projectId?: string;
  actingUserId?: string;
  sandboxProvider?: SandboxProvider;
  /**
   * Advisory correlation id for the factory session driving this client.
   * Sent as `x-mastra-session-id` on every proxy request so proxy-side logs
   * can be joined back to the calling session without a multi-store hand-join
   * (`threadId → sessionId → sandboxId → providerResourceId`). Never used for
   * authorization — the Bearer token remains the only credential.
   */
  sessionId?: string;
  /**
   * Advisory correlation id for the factory thread, sent as
   * `x-mastra-thread-id` when present. See {@link PlatformClientOptions.sessionId}.
   */
  threadId?: string;
  fetch?: typeof fetch;
}

export interface PlatformRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

export type SandboxProvider = 'railway' | 'e2b';

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

function resolveSandboxProvider(value: string | undefined): SandboxProvider {
  const provider = value?.trim() || 'e2b';
  if (provider !== 'railway' && provider !== 'e2b') {
    throw new Error('SANDBOX_PROVIDER must be either "railway" or "e2b"');
  }
  return provider;
}

export function resolvePlatformOptions(options: PlatformClientOptions) {
  const environmentSandboxProvider = process.env.SANDBOX_PROVIDER?.trim();
  const configuredSandboxProvider = options.sandboxProvider ?? environmentSandboxProvider;

  return {
    accessToken: requireOption(options.accessToken ?? process.env.MASTRA_PLATFORM_ACCESS_TOKEN, 'accessToken'),
    projectId: requireOption(options.projectId ?? process.env.MASTRA_PROJECT_ID, 'projectId'),
    actingUserId: options.actingUserId?.trim() || undefined,
    proxyUrl: (process.env.MASTRA_WORKSPACE_PROXY_URL ?? DEFAULT_PROXY_URL).replace(/\/$/, ''),
    sandboxProvider: resolveSandboxProvider(configuredSandboxProvider),
    sessionId: options.sessionId,
    threadId: options.threadId,
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
  readonly actingUserId: string | undefined;
  readonly proxyUrl: string;
  readonly sandboxProvider: SandboxProvider;
  /** Advisory session correlation id — see {@link PlatformClientOptions.sessionId}. */
  readonly sessionId: string | undefined;
  /** Advisory thread correlation id — see {@link PlatformClientOptions.threadId}. */
  readonly threadId: string | undefined;
  readonly fetch: typeof fetch;

  constructor(options: PlatformClientOptions) {
    const resolved = resolvePlatformOptions(options);
    this.accessToken = resolved.accessToken;
    this.projectId = resolved.projectId;
    this.actingUserId = resolved.actingUserId;
    this.proxyUrl = resolved.proxyUrl;
    this.sandboxProvider = resolved.sandboxProvider;
    this.sessionId = resolved.sessionId;
    this.threadId = resolved.threadId;
    this.fetch = resolved.fetch;
  }

  async request(path: string, options: PlatformRequestOptions = {}): Promise<Response> {
    return this.requestAtPath(`/${this.sandboxProvider}`, path, options);
  }

  async requestProvider(path: string, options: PlatformRequestOptions = {}): Promise<Response> {
    return this.requestAtPath(`/${this.sandboxProvider}`, path, options);
  }

  private async requestAtPath(providerPath: string, path: string, options: PlatformRequestOptions): Promise<Response> {
    const url = new URL(`${this.proxyUrl}/v1${providerPath}/projects/${encodeURIComponent(this.projectId)}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${this.accessToken}`);
    if (this.actingUserId) headers.set('x-acting-user-id', this.actingUserId);
    // Advisory correlation headers — the proxy folds them into its log lines
    // so proxy-side events can be joined back to the calling factory session
    // without a cross-store hand-join. Unknown headers are passthrough for
    // older proxies; these are never used for authorization.
    if (this.sessionId) headers.set('x-mastra-session-id', this.sessionId);
    if (this.threadId) headers.set('x-mastra-thread-id', this.threadId);

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
