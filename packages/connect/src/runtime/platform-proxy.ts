/**
 * Runtime request context handed to generated tool exec bodies. It implements
 * the subset of the upstream template SDK that shipped templates actually
 * call, but every request goes through the Mastra platform's `/v2/proxy`
 * endpoint — no third-party SDK is involved at runtime.
 *
 * The context intentionally implements only what the templates we ship
 * actually use. If we vendor a template that needs a helper not modelled
 * here, the generator fails at generation time (unknown property access)
 * rather than exploding at runtime.
 */
import { proxyRequest, resolveClient, type ProxyRequestOptions } from '../client.js';
import { MastraConnectError } from '../errors.js';
import type { ProviderToolsOptions } from '../toolset.js';
import { resolveConnectionId } from '../toolset.js';

/**
 * The shape of an individual request as templates author them — a strict
 * subset of the upstream proxy configuration containing only the fields the
 * templates actually use.
 */
export interface PlatformProxyRequest {
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

/** Templates treat provider response bodies as untyped JSON until they validate them. */
type ProviderResponseData = ReturnType<typeof JSON.parse>;

/** Mirrors the upstream response shape closely enough for the templates we vendor. */
export interface PlatformProxyResponse<T = ProviderResponseData> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * Thrown from generated exec bodies to signal a domain error. Templates
 * construct these with `throw new platformProxy.ActionError({ type, message, ... })`.
 */
export class ToolActionError extends Error {
  readonly payload: Record<string, unknown>;
  constructor(payload: { type?: string; message?: string; details?: unknown; [key: string]: unknown }) {
    super(payload.message ?? payload.type ?? 'Tool action error');
    this.name = 'ToolActionError';
    this.payload = payload;
  }
}

/**
 * The `platformProxy` binding passed as the first argument of every generated
 * exec body. Only fields we've seen used are exposed.
 */
export interface PlatformProxy {
  get<T = ProviderResponseData>(config: PlatformProxyRequest): Promise<PlatformProxyResponse<T>>;
  post<T = ProviderResponseData>(config: PlatformProxyRequest): Promise<PlatformProxyResponse<T>>;
  put<T = ProviderResponseData>(config: PlatformProxyRequest): Promise<PlatformProxyResponse<T>>;
  patch<T = ProviderResponseData>(config: PlatformProxyRequest): Promise<PlatformProxyResponse<T>>;
  delete<T = ProviderResponseData>(config: PlatformProxyRequest): Promise<PlatformProxyResponse<T>>;
  ActionError: typeof ToolActionError;
  log: (...args: unknown[]) => void;
}

interface CreatePlatformProxyOptions {
  envVar: string;
  options?: ProviderToolsOptions;
}

async function callProxy<T>(
  method: ProxyRequestOptions['method'],
  { envVar, options }: CreatePlatformProxyOptions,
  config: PlatformProxyRequest,
): Promise<PlatformProxyResponse<T>> {
  // Connection id and client config resolve lazily per call, so building
  // toolsets without env vars set never throws.
  const connectionId = resolveConnectionId(envVar, options?.connectionId);
  const client = resolveClient(options?.client);
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

/**
 * Builds the platform proxy context shared by every tool of a provider
 * toolset. Connection id and client config resolve lazily inside each call.
 */
export function createPlatformProxy(context: CreatePlatformProxyOptions): PlatformProxy {
  const bind =
    (method: ProxyRequestOptions['method']) =>
    <T>(config: PlatformProxyRequest): Promise<PlatformProxyResponse<T>> =>
      callProxy<T>(method, context, config);
  return {
    get: bind('GET'),
    post: bind('POST'),
    put: bind('PUT'),
    patch: bind('PATCH'),
    delete: bind('DELETE'),
    ActionError: ToolActionError,
    log: (...args: unknown[]) => {
      // Templates use log for observability; forward to console.
      console.log('[@mastra/connect]', ...args);
    },
  };
}
