/**
 * Runtime shim that provides the subset of Nango's action SDK used by the
 * templates we vendor. Generated tool exec bodies receive a `nango` object
 * shaped like this and never touch @nangohq/node — every request goes through
 * the Mastra platform's `/v2/proxy` endpoint.
 *
 * The shim intentionally implements only what the templates we ship actually
 * call. If we vendor a template that uses a helper not modelled here, the
 * generator will fail at generation time (unknown property access on `nango`)
 * rather than exploding at runtime.
 */
import { proxyRequest, type ProxyRequestOptions, type ResolvedClient } from '../client.js';
import { MastraConnectError } from '../errors.js';

/**
 * The shape of an individual request as Nango templates author them. This is
 * a strict subset of Nango's `ProxyConfiguration` — fields the templates
 * actually use.
 */
export interface NangoRequestConfig {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  data?: unknown;
  /**
   * Retry hint from templates. We treat this as a soft ceiling — the platform
   * proxy already applies its own retry policy; templates that ask for `n`
   * retries get up to `n` transient retries here on network/5xx failures.
   */
  retries?: number;
}

/** Nango action templates treat provider response bodies as untyped JSON until they validate them. */
type ProviderResponseData = ReturnType<typeof JSON.parse>;

/** Mirrors Nango's response shape closely enough for the templates we vendor. */
export interface NangoResponse<T = ProviderResponseData> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * Thrown from generated exec bodies to signal a domain error. Templates
 * construct these with `throw new nango.ActionError({ type, message, ... })`.
 */
export class NangoActionError extends Error {
  readonly payload: Record<string, unknown>;
  constructor(payload: { type?: string; message?: string; details?: unknown; [key: string]: unknown }) {
    super(payload.message ?? payload.type ?? 'Nango action error');
    this.name = 'NangoActionError';
    this.payload = payload;
  }
}

/**
 * The `nango` binding passed as the first argument of every generated exec
 * body. Only fields we've seen used are exposed.
 */
export interface NangoContext {
  get<T = ProviderResponseData>(config: NangoRequestConfig): Promise<NangoResponse<T>>;
  post<T = ProviderResponseData>(config: NangoRequestConfig): Promise<NangoResponse<T>>;
  put<T = ProviderResponseData>(config: NangoRequestConfig): Promise<NangoResponse<T>>;
  patch<T = ProviderResponseData>(config: NangoRequestConfig): Promise<NangoResponse<T>>;
  delete<T = ProviderResponseData>(config: NangoRequestConfig): Promise<NangoResponse<T>>;
  ActionError: typeof NangoActionError;
  log: (...args: unknown[]) => void;
}

interface CreateNangoContextOptions {
  client: ResolvedClient;
  connectionId: string;
}

async function callProxy<T>(
  method: ProxyRequestOptions['method'],
  { client, connectionId }: CreateNangoContextOptions,
  config: NangoRequestConfig,
): Promise<NangoResponse<T>> {
  const attempts = Math.max(1, Math.min(config.retries ?? 1, 5));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const data = (await proxyRequest(client, connectionId, {
        method,
        path: config.endpoint,
        query: config.params,
        headers: config.headers,
        body: config.data,
      })) as T;
      // proxyRequest currently returns the parsed JSON body only; templates
      // rarely inspect status/headers, but expose stubs to keep the shape
      // faithful.
      return { data, status: 200, headers: {} };
    } catch (error) {
      lastError = error;
      // Only retry on network-ish failures. MastraConnectError with
      // proxy_error status >= 500 is worth retrying; auth/404 is not.
      if (!isTransient(error)) throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new MastraConnectError('proxy_error', 'Proxy call failed after retries.');
}

function isTransient(error: unknown): boolean {
  if (error instanceof MastraConnectError && error.code === 'proxy_error') {
    return typeof error.status === 'number' && error.status >= 500;
  }
  // Network errors (fetch rejections) surface as generic Errors.
  return !(error instanceof MastraConnectError);
}

/** Builds a `nango`-shaped context bound to one connection for a single tool call. */
export function createNangoContext(options: CreateNangoContextOptions): NangoContext {
  const bind =
    (method: ProxyRequestOptions['method']) =>
    <T>(config: NangoRequestConfig): Promise<NangoResponse<T>> =>
      callProxy<T>(method, options, config);
  return {
    get: bind('GET'),
    post: bind('POST'),
    put: bind('PUT'),
    patch: bind('PATCH'),
    delete: bind('DELETE'),
    ActionError: NangoActionError,
    log: (...args: unknown[]) => {
      // Templates use nango.log for observability; forward to console.
      console.log('[@mastra/connect]', ...args);
    },
  };
}
