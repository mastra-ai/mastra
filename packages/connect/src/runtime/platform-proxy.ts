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
import type { RequestContext } from '@mastra/core/request-context';

import {
  getConnectionContext,
  getCredential,
  proxyRequestWithResponse,
  resolveClient,
  type ConnectClientOptions,
  type ConnectionContext,
  type ConnectionCredential,
  type ProxyRequestOptions,
} from '../client.js';
import { MastraConnectError } from '../errors.js';

/**
 * The shape of an individual request as templates author them — a strict
 * subset of the upstream proxy configuration containing only the fields the
 * templates actually use.
 */
/**
 * Pagination configuration accepted by `platformProxy.paginate`. Mirrors the
 * subset of Nango's paginate options that shipped templates use:
 *
 * - `link`: follow a next-link URL returned in the response body.
 * - `offset`: increment a numeric offset query parameter each page.
 * - `cursor`: forward an opaque cursor value from the response into the
 *   next request as a query parameter.
 */
export type PaginateConfig = LinkPaginateConfig | OffsetPaginateConfig | CursorPaginateConfig;

export interface PlatformProxyRequest {
  endpoint: string;
  params?: NonNullable<ProxyRequestOptions['query']>;
  headers?: Record<string, string>;
  data?: unknown;
  /**
   * Retry hint from templates. We treat this as a soft ceiling — the platform
   * proxy already applies its own retry policy; templates that ask for `n`
   * retries get up to `n` transient retries here on network/5xx failures.
   * Honored for idempotent HTTP methods (GET/HEAD/PUT/DELETE), and for a POST
   * or PATCH that carries an `Idempotency-Key` header, since the provider then
   * deduplicates a replay. Any other POST or PATCH gets exactly one attempt.
   */
  retries?: number;
  /** Provider base URL selected by the tool from connection config or metadata. */
  baseUrlOverride?: string;
  /**
   * How to decode the provider response body. Defaults to JSON. Set to
   * `'arraybuffer'` when the endpoint returns binary content (e.g. file
   * exports); the body is returned as an ArrayBuffer that a template can
   * wrap with `Buffer.from(...)`.
   */
  responseType?: 'arraybuffer';
  /**
   * Optional pagination config. Only consumed by `platformProxy.paginate`;
   * ignored by the single-page HTTP method helpers. Kept on the base shape
   * because templates author one `ProxyConfiguration` object and pass it to
   * whichever helper they need.
   */
  paginate?: PaginateConfig;
}

/** Extended request shape for `platformProxy.proxy` / `platformProxy.paginate`. */
export interface PlatformProxyDispatchRequest extends PlatformProxyRequest {
  /** HTTP method. Defaults to GET when omitted (matches Nango's `proxy` helper). */
  method?: ProxyRequestOptions['method'];
}

interface CommonPaginateConfig {
  /** Dot-separated path inside the response body where the items array lives. */
  response_path?: string;
  /** Page-size query parameter name to send with each request. */
  limit_name_in_request?: string;
  /** Page-size value to send with each request. */
  limit?: number;
}

export interface LinkPaginateConfig extends CommonPaginateConfig {
  type: 'link';
  /** Dot-separated path inside the response body that contains the next-page URL. */
  link_path_in_response_body: string;
}

export interface OffsetPaginateConfig extends CommonPaginateConfig {
  type: 'offset';
  /** Query parameter name that receives the running offset. */
  offset_name_in_request: string;
  /** Initial offset value. Defaults to 0. */
  offset_start_value?: number;
}

export interface CursorPaginateConfig extends CommonPaginateConfig {
  type: 'cursor';
  /** Dot-separated path inside the response body that contains the next cursor value. */
  cursor_path_in_response_body: string;
  /** Query parameter name that receives the next cursor value. */
  cursor_name_in_request: string;
}

/** Templates treat provider response bodies as untyped JSON until they validate them. */
type ProviderResponseData = ReturnType<typeof JSON.parse>;

/**
 * Connection facts as templates consume them. The upstream SDK types
 * connection config and metadata values as `any` and vendored templates are
 * written against that contract (they narrow with schema parses or truthiness
 * checks), so the template-facing surface mirrors it. The package's own API
 * (`ConnectionContext` in client.ts) stays strictly typed.
 */
export interface TemplateConnectionContext {
  connection_config: Record<string, ProviderResponseData>;
  metadata: Record<string, ProviderResponseData> | null;
}

/**
 * Connection context extended with the raw credential in the upstream SDK's
 * wire shape. Only handed to exec bodies whose template reads
 * `connection.credentials`; the generator rewrites their `getConnection()`
 * calls to `getConnectionWithCredentials()` so the common path never fetches
 * a secret it doesn't use. Never log this value.
 */
export interface TemplateConnectionContextWithCredentials extends TemplateConnectionContext {
  credentials: Record<string, ProviderResponseData>;
}

/** Maps the platform credential to the field names templates are written against. */
function toTemplateCredentials(credential: ConnectionCredential): Record<string, ProviderResponseData> {
  return credential.type === 'oauth2'
    ? { type: 'OAUTH2', access_token: credential.accessToken, expires_at: credential.expiresAt }
    : { type: 'API_KEY', apiKey: credential.apiKey };
}

/**
 * Structural view of a zod schema as `zodValidateInput` consumes it. Typed
 * structurally instead of against `ZodType` so the runtime works with any
 * zod major the host app resolves (the package's zod peer spans 3 and 4).
 */
export interface ZodLikeSchema<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues?: unknown; message?: string } };
}

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
  /**
   * Method-agnostic proxy call. Mirrors Nango's `nango.proxy({ method, ... })`
   * helper — dispatches to the underlying HTTP method (default GET) so
   * templates that build a single request config and pick the method
   * separately work unchanged.
   */
  proxy<T = ProviderResponseData>(config: PlatformProxyDispatchRequest): Promise<PlatformProxyResponse<T>>;
  /**
   * Iterates a paginated provider endpoint using Nango's paginate config
   * shape. Each yielded value is the page's item array as parsed from the
   * response body. Follows `type: 'link'` (next-link URL), `'offset'`
   * (offset query parameter), or `'cursor'` (opaque cursor value).
   */
  paginate<T = ProviderResponseData>(config: PlatformProxyDispatchRequest): AsyncGenerator<T[], void, unknown>;
  getConnection(): Promise<TemplateConnectionContext>;
  /**
   * `getConnection()` plus the raw connection credential fetched from the
   * platform. Generated only for templates that read `connection.credentials`.
   */
  getConnectionWithCredentials(): Promise<TemplateConnectionContextWithCredentials>;
  /**
   * Mirrors the upstream SDK contract templates are written against: always
   * resolves to an object (empty when the connection has no metadata).
   */
  getMetadata<T = Record<string, ProviderResponseData>>(): Promise<T>;
  /**
   * Templates cache derived connection facts here (for example the Jira
   * templates resolve and store the Atlassian `cloudId`/`baseUrl`). The
   * platform connection record is not writable from a tool, so updates land
   * in an in-memory overlay shared by every request-bound copy of the
   * toolset's proxy: `getMetadata` reads through it, and a fresh process
   * simply re-derives the values on its first call.
   */
  updateMetadata(update: Record<string, unknown>): Promise<void>;
  /**
   * Mirrors the upstream SDK's input-validation helper. Generated tools
   * already validate inputs through their tool input schema, so this mostly
   * re-parses, but templates rely on it for defaults/coercion and for the
   * `{ data }` result shape.
   */
  zodValidateInput<T>(args: { zodSchema: ZodLikeSchema<T>; input: unknown }): Promise<{ data: T }>;
  ActionError: typeof ToolActionError;
  log: (...args: unknown[]) => void;
  /**
   * The request context of the call currently being served, when bound via
   * `withRequestContext`. Carried so connection resolution can use per-request
   * end-user identity once user-scoped connections are supported.
   */
  readonly requestContext?: RequestContext;
  /** Returns a copy of this proxy bound to one request's context. */
  withRequestContext(requestContext: RequestContext): PlatformProxy;
}

/** Methods with an idempotency contract per RFC 9110; only these may be retried. */
const IDEMPOTENT_METHODS = new Set<ProxyRequestOptions['method']>(['GET', 'HEAD', 'PUT', 'DELETE']);

interface CreatePlatformProxyOptions {
  connectionId?: string;
  client?: ConnectClientOptions;
  requestContext?: RequestContext;
  /**
   * Internal: the metadata overlay shared across request-bound copies of one
   * toolset proxy. The connection id is fixed per proxy context, so the
   * overlay is per-connection; revisit if connection resolution ever becomes
   * request-scoped.
   */
  metadataOverlay?: Record<string, unknown>;
}

function requireConnectionId(connectionId?: string): string {
  if (connectionId) return connectionId;
  throw new MastraConnectError(
    'missing_connection_id',
    'Missing connection id: pass connectionId or resolve tools through connect().',
  );
}

async function loadConnectionContext({
  connectionId,
  client: clientOptions,
}: CreatePlatformProxyOptions): Promise<ConnectionContext> {
  return getConnectionContext(resolveClient(clientOptions), requireConnectionId(connectionId));
}

async function callProxy<T>(
  method: ProxyRequestOptions['method'],
  { connectionId, client: clientOptions }: CreatePlatformProxyOptions,
  config: PlatformProxyRequest,
): Promise<PlatformProxyResponse<T>> {
  // Checked lazily per call, so building toolsets without a connection id
  // never throws. `connect()` always supplies one; direct `create<Provider>Tools`
  // callers must pass `connectionId`.
  const resolvedConnectionId = requireConnectionId(connectionId);
  const client = resolveClient(clientOptions);
  // Non-idempotent writes get exactly one attempt: a POST/PATCH the provider
  // accepted just before a transient failure must not be replayed as a
  // duplicate mutation. A caller-supplied Idempotency-Key makes the replay
  // safe, so those requests may retry like idempotent methods.
  const retryable = IDEMPOTENT_METHODS.has(method) || hasIdempotencyKey(config.headers);
  const attempts = retryable ? Math.max(1, Math.min(config.retries ?? 1, 5)) : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await proxyRequestWithResponse(client, resolvedConnectionId, {
        method,
        path: config.endpoint,
        query: config.params,
        headers: config.headers,
        baseUrlOverride: config.baseUrlOverride,
        body: config.data,
        responseType: config.responseType,
      });
      return { ...response, data: response.data as T };
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

function hasIdempotencyKey(headers: Record<string, string> | undefined): boolean {
  return Object.keys(headers ?? {}).some(name => name.toLowerCase() === 'idempotency-key');
}

function isTransient(error: unknown): boolean {
  if (error instanceof MastraConnectError && error.code === 'proxy_error') {
    return typeof error.status === 'number' && error.status >= 500;
  }
  // Network errors (fetch rejections) surface as generic Errors.
  return !(error instanceof MastraConnectError);
}

/**
 * Reads `path.a.b` off a nested provider response body. Falls back to a
 * direct property lookup first so keys that literally contain dots (Microsoft
 * Graph's `@odata.nextLink`, for example) resolve without requiring the
 * caller to escape them.
 */
function readPath(source: unknown, path: string | undefined): unknown {
  if (!path) return source;
  if (source !== null && typeof source === 'object' && path in (source as Record<string, unknown>)) {
    return (source as Record<string, unknown>)[path];
  }
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Coerces the items collection at `response_path` to a typed array. */
function extractItems<T>(body: unknown, responsePath: string | undefined): T[] {
  const raw = readPath(body, responsePath);
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/**
 * Splits a next-link URL from a provider response into an endpoint path and
 * a base URL override the platform proxy can execute. Provider next-links
 * come back as absolute URLs (`https://graph.microsoft.com/v1.0/…?…`), which
 * `callProxy` cannot use directly — it needs `path` and `baseUrlOverride`
 * separately.
 */
function splitAbsoluteNextLink(nextLink: string): { path: string; baseUrlOverride: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(nextLink);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') return undefined;
  return {
    path: `${parsed.pathname.replace(/^\/+/, '')}${parsed.search}`,
    baseUrlOverride: `${parsed.protocol}//${parsed.host}`,
  };
}

function buildFirstPageRequest(base: PlatformProxyRequest, config: PaginateConfig): PlatformProxyRequest {
  const params = { ...(base.params ?? {}) };
  if (config.limit_name_in_request && config.limit !== undefined) {
    params[config.limit_name_in_request] = config.limit;
  }
  if (config.type === 'offset') {
    params[config.offset_name_in_request] = config.offset_start_value ?? 0;
  }
  return { ...base, params };
}

function buildNextPageRequest(
  base: PlatformProxyRequest,
  config: PaginateConfig,
  responseBody: unknown,
  lastPageSize: number,
  previous: PlatformProxyRequest,
): PlatformProxyRequest | undefined {
  if (config.type === 'link') {
    const nextLink = readPath(responseBody, config.link_path_in_response_body);
    if (typeof nextLink !== 'string' || nextLink.length === 0) return undefined;
    const split = splitAbsoluteNextLink(nextLink);
    if (!split) return undefined;
    // Follow the provider's next-link verbatim: it already carries every
    // query parameter needed for the next page, and any client-side
    // `params` would collide with it.
    return { ...base, params: undefined, endpoint: split.path, baseUrlOverride: split.baseUrlOverride };
  }
  if (config.type === 'cursor') {
    const nextCursor = readPath(responseBody, config.cursor_path_in_response_body);
    if (typeof nextCursor !== 'string' && typeof nextCursor !== 'number') return undefined;
    if (nextCursor === '' || nextCursor === null || nextCursor === undefined) return undefined;
    return {
      ...previous,
      params: { ...(previous.params ?? {}), [config.cursor_name_in_request]: nextCursor as string | number },
    };
  }
  // Offset: keep advancing until the provider returns fewer items than the
  // page size. Without a limit hint, exit after any page — offset paging is
  // meaningless without a stable window size.
  if (config.limit === undefined || lastPageSize < config.limit) return undefined;
  const previousOffset = Number(previous.params?.[config.offset_name_in_request] ?? config.offset_start_value ?? 0);
  return {
    ...previous,
    params: { ...(previous.params ?? {}), [config.offset_name_in_request]: previousOffset + lastPageSize },
  };
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
  const proxy = <T>({ method, ...config }: PlatformProxyDispatchRequest): Promise<PlatformProxyResponse<T>> =>
    callProxy<T>(method ?? 'GET', context, config);
  async function* paginate<T>({
    paginate: pageConfig,
    method,
    ...requestBase
  }: PlatformProxyDispatchRequest): AsyncGenerator<T[], void, unknown> {
    if (!pageConfig) {
      throw new MastraConnectError(
        'invalid_options',
        'platformProxy.paginate requires a `paginate` config on the request.',
      );
    }
    const httpMethod = method ?? 'GET';
    let nextRequest: PlatformProxyRequest | undefined = buildFirstPageRequest(requestBase, pageConfig);
    while (nextRequest) {
      const response = await callProxy<unknown>(httpMethod, context, nextRequest);
      const items = extractItems<T>(response.data, pageConfig.response_path);
      yield items;
      // The provider indicates the end of pagination by either omitting the
      // next-page cue (link/cursor) or returning fewer items than the page
      // size. Stop before making a redundant call.
      if (items.length === 0) break;
      nextRequest = buildNextPageRequest(requestBase, pageConfig, response.data, items.length, nextRequest);
    }
  }
  let connectionContext: Promise<ConnectionContext> | undefined;
  const loadConnection = () => (connectionContext ??= loadConnectionContext(context));
  const getConnection = async (): Promise<TemplateConnectionContext> => {
    const { connection_config, metadata } = await loadConnection();
    return { connection_config: connection_config ?? {}, metadata };
  };
  const metadataOverlay = context.metadataOverlay ?? {};
  const getConnectionWithCredentials = async (): Promise<TemplateConnectionContextWithCredentials> => {
    const [connection, credential] = await Promise.all([
      getConnection(),
      getCredential(resolveClient(context.client), requireConnectionId(context.connectionId)),
    ]);
    return { ...connection, credentials: toTemplateCredentials(credential) };
  };
  return {
    get: bind('GET'),
    post: bind('POST'),
    put: bind('PUT'),
    patch: bind('PATCH'),
    delete: bind('DELETE'),
    proxy,
    paginate,
    getConnection,
    getConnectionWithCredentials,
    getMetadata: async <T = Record<string, ProviderResponseData>>() => {
      const metadata = (await loadConnection()).metadata;
      return { ...(metadata ?? {}), ...metadataOverlay } as T;
    },
    updateMetadata: async update => {
      Object.assign(metadataOverlay, update);
    },
    zodValidateInput: async <T>({ zodSchema, input }: { zodSchema: ZodLikeSchema<T>; input: unknown }) => {
      const result = zodSchema.safeParse(input);
      if (!result.success) {
        throw new ToolActionError({
          type: 'invalid_input',
          message: 'Invalid input provided to tool action.',
          details: result.error.issues ?? result.error.message,
        });
      }
      return { data: result.data };
    },
    ActionError: ToolActionError,
    // Upstream template logs may contain request or provider data. Keep the
    // compatibility method but discard arbitrary values at this trust boundary.
    log: () => {},
    requestContext: context.requestContext,
    withRequestContext: requestContext => createPlatformProxy({ ...context, requestContext, metadataOverlay }),
  };
}
