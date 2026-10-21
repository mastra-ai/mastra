import { z } from 'zod';

import { extractProblemDetail, MastraConnectError } from './errors.js';
import {
  describePlatformCall,
  endPlatformCallSpan,
  errorPlatformCallSpan,
  startPlatformCallSpan,
} from './instrumentation.js';

/**
 * Configuration for talking to the Mastra platform integrations service.
 * Every field falls back to an environment variable, so a fully env-configured
 * app can pass nothing at all.
 */
export interface ConnectClientOptions {
  /** Platform access token. Falls back to MASTRA_PLATFORM_ACCESS_TOKEN, then MASTRA_PLATFORM_SECRET_KEY. */
  accessToken?: string;
  /** Organization id. Falls back to MASTRA_ORG_ID; the x-organization-id header is omitted when absent. */
  orgId?: string;
  /**
   * Project id, sent as the x-mastra-project-id header so the platform can
   * attribute proxy activity to this project. Falls back to MASTRA_PROJECT_ID;
   * the header is omitted when absent.
   */
  projectId?: string;
  /**
   * Integrations service base URL. Falls back to MASTRA_INTEGRATIONS_API_URL,
   * then the regional default from MASTRA_PLATFORM_REGION ('us' | 'eu'),
   * then https://integrations.mastra.ai.
   */
  baseUrl?: string;
  /** Fetch implementation, for testing or custom transports. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /**
   * End-user resource key this client acts for. When set, every platform call
   * asserts it via the `x-mastra-resource-id` header and connection listings
   * are scoped to global + that resource's connections. The platform rejects
   * calls against a resource-scoped connection whose key does not match (404),
   * and ignores the header on global connections. No env fallback on purpose:
   * a resource scope is always an explicit, per-identity decision.
   */
  resourceId?: string;
}

export interface ResolvedClient {
  baseUrl: string;
  headers: Record<string, string>;
  fetch: typeof globalThis.fetch;
  accessToken: string;
  /** Validated end-user resource key this client asserts, when scoped. */
  resourceId?: string;
}

const DEFAULT_INTEGRATIONS_URL = 'https://integrations.mastra.ai';
const REGIONAL_INTEGRATIONS_URLS: Record<'us' | 'eu', string> = {
  us: 'https://integrations.us.mastra.ai',
  eu: 'https://integrations.eu.mastra.ai',
};

/**
 * Mirrors the URL conventions of the platform factory api-client
 * (`MASTRA_PLATFORM_REGION` case-insensitive 'us'/'eu'; unknown regions fall
 * through to the global default).
 */
function resolveIntegrationsUrl(): string {
  const region = process.env.MASTRA_PLATFORM_REGION?.trim().toLowerCase();
  if (region === 'us' || region === 'eu') return REGIONAL_INTEGRATIONS_URLS[region];
  return DEFAULT_INTEGRATIONS_URL;
}

// Written as a loop rather than /\/+$/ so a hostile baseUrl of many slashes
// cannot trigger polynomial regex backtracking (CodeQL js/polynomial-redos).
function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

/** Header asserting the end-user resource key on platform data-path calls. */
export const RESOURCE_ID_HEADER = 'x-mastra-resource-id';

/**
 * Validates an end-user resource key against the platform contract: an opaque
 * string of 1–256 characters after trimming. Returns the trimmed key.
 * Mirrors the platform's `resourceIdSchema` so an invalid key fails here —
 * before any platform call — instead of as an opaque 400.
 */
export function validateResourceId(resourceId: string): string {
  if (typeof resourceId !== 'string') {
    throw new MastraConnectError('invalid_options', `Invalid resourceId: expected a string, got ${typeof resourceId}.`);
  }
  const trimmed = resourceId.trim();
  if (trimmed.length < 1 || trimmed.length > 256) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid resourceId: expected 1-256 characters after trimming, got ${trimmed.length}.`,
    );
  }
  return trimmed;
}

export function resolveClient(options?: ConnectClientOptions): ResolvedClient {
  const accessToken =
    options?.accessToken?.trim() ||
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() ||
    process.env.MASTRA_PLATFORM_SECRET_KEY?.trim();
  if (!accessToken) {
    throw new MastraConnectError(
      'missing_access_token',
      'Missing Mastra platform access token: set MASTRA_PLATFORM_ACCESS_TOKEN (or MASTRA_PLATFORM_SECRET_KEY), or pass client.accessToken.',
    );
  }

  const baseUrl = stripTrailingSlashes(
    options?.baseUrl?.trim() || process.env.MASTRA_INTEGRATIONS_API_URL?.trim() || resolveIntegrationsUrl(),
  );

  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
  };
  const orgId = options?.orgId?.trim() || process.env.MASTRA_ORG_ID?.trim();
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  const projectId = options?.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (projectId) {
    headers['x-mastra-project-id'] = projectId;
  }
  const resourceId = options?.resourceId !== undefined ? validateResourceId(options.resourceId) : undefined;
  if (resourceId !== undefined) {
    headers[RESOURCE_ID_HEADER] = resourceId;
  }

  return { baseUrl, headers, fetch: options?.fetch ?? globalThis.fetch, accessToken, resourceId };
}

function redact(message: string, accessToken: string): string {
  return message.split(accessToken).join('[REDACTED]');
}

async function platformFetch(client: ResolvedClient, path: string, init?: RequestInit): Promise<Response> {
  // Single choke point for outbound connect HTTP (platform API + vendor
  // proxy), so one span here covers every external call this package makes.
  const span = startPlatformCallSpan(describePlatformCall(init?.method ?? 'GET', path));
  try {
    const response = await client.fetch(`${client.baseUrl}${path}`, {
      ...init,
      headers: { ...client.headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    endPlatformCallSpan(span, response.status);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes(client.accessToken)) {
      const redacted = new Error(redact(error.message, client.accessToken));
      redacted.name = error.name;
      errorPlatformCallSpan(span, redacted);
      throw redacted;
    }
    errorPlatformCallSpan(span, error);
    throw error;
  }
}

/** Parses a successful platform response body, mapping invalid JSON to the platform_error contract. */
async function parsePlatformJson(response: Response, context: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MastraConnectError('platform_error', `Platform returned an unparseable response body while ${context}.`);
  }
}

/** Maps a non-2xx response from the platform's own endpoints to a typed error. */
async function throwPlatformError(response: Response, context: string): Promise<never> {
  const { detail, code } = await extractProblemDetail(response);
  if (response.status === 401 || response.status === 403) {
    throw new MastraConnectError('unauthorized', `Unauthorized while ${context}${detail ? `: ${detail}` : '.'}`, {
      status: response.status,
      detail,
    });
  }
  if (response.status === 404) {
    throw new MastraConnectError('connection_not_found', `Not found while ${context}${detail ? `: ${detail}` : '.'}`, {
      status: response.status,
      detail,
    });
  }
  if (code === 'unsupported_credential_type') {
    throw new MastraConnectError(
      'unsupported_credential_type',
      `Unsupported credential type while ${context}${detail ? `: ${detail}` : '.'}`,
      { status: response.status, detail },
    );
  }
  throw new MastraConnectError(
    'platform_error',
    `Platform request failed (${response.status}) while ${context}${detail ? `: ${detail}` : '.'}`,
    { status: response.status, detail },
  );
}

/** Builds a locked MCP transport that can only call one Platform connection endpoint. */
export function platformMcpTransport(client: ResolvedClient, connectionId: string) {
  const url = new URL(`${client.baseUrl}/v2/connections/${encodeURIComponent(connectionId)}/mcp`);
  return {
    url,
    allowedHosts: [url.host],
    fetch: async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const requested = new URL(String(input));
      if (requested.href !== url.href) {
        throw new MastraConnectError(
          'invalid_options',
          `MCP transport refused an unexpected Platform URL for connection ${connectionId}.`,
        );
      }
      const headers = new Headers(client.headers);
      new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
      // The platform token always wins over transport-provided headers. Platform
      // strips it before Nango injects the provider credential upstream.
      headers.set('authorization', `Bearer ${client.accessToken}`);
      try {
        return await client.fetch(url, { ...init, headers, redirect: 'manual' });
      } catch (error) {
        if (error instanceof Error && error.message.includes(client.accessToken)) {
          const redacted = new Error(redact(error.message, client.accessToken));
          redacted.name = error.name;
          throw redacted;
        }
        throw error;
      }
    },
  };
}

// —— response schemas (mirroring the platform's http-schemas) ——

export const connectionSchema = z.object({
  id: z.string(),
  integrationId: z.string(),
  // Lenient on purpose: an unknown future status must not fail the whole
  // connection list — resolution treats anything but 'active'/'needs_reauth'
  // as unusable.
  status: z.string(),
  connectedByUserId: z.string().nullish(),
  connectedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  accountLabel: z.string().nullish(),
  /** End-user resource key the connection is scoped to; null/absent = global. */
  resourceId: z.string().nullish(),
});

export type ProjectConnection = z.infer<typeof connectionSchema>;

const connectionListSchema = z.object({
  connections: z.array(connectionSchema),
});

/**
 * One credential-form field from the platform catalog, as the hosted connect
 * surface needs it. Lenient subset of the platform's `VendorAuthField`.
 */
export const catalogAuthFieldSchema = z.object({
  name: z.string(),
  label: z.string().nullish(),
  description: z.string().nullish(),
  placeholder: z.string().nullish(),
  secret: z.boolean().nullish(),
  required: z.boolean().nullish(),
  order: z.number().nullish(),
});

export type CatalogAuthField = z.infer<typeof catalogAuthFieldSchema>;

export const integrationCatalogEntrySchema = z.object({
  id: z.string(),
  capabilities: z.object({
    mcp: z.boolean().optional(),
  }),
  // Display/auth fields consumed by the end-user connect surface. Nullish so
  // an older platform catalog shape never fails tool resolution.
  displayName: z.string().nullish(),
  logoUrl: z.string().nullish(),
  authType: z.string().nullish(),
  authFields: z.array(catalogAuthFieldSchema).nullish(),
});

export type IntegrationCatalogEntry = z.infer<typeof integrationCatalogEntrySchema>;

const integrationCatalogResponseSchema = z.object({
  integrations: z.array(integrationCatalogEntrySchema),
});

/**
 * Secondary access token minted by the vendor alongside the primary oauth2
 * credential (e.g. `devPortalAccessToken` on Microsoft Teams connections).
 * Keyed by the vendor's connection-config field name. Treat this like any
 * other bearer credential — it authenticates second-audience API calls
 * (Teams Dev Portal, etc.) and must not be logged or forwarded to code that
 * shouldn't hold connection secrets.
 */
export const secondaryAccessTokenSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string().nullable(),
});

export type SecondaryAccessToken = z.infer<typeof secondaryAccessTokenSchema>;

export const credentialSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('oauth2'),
    accessToken: z.string(),
    expiresAt: z.string().nullable(),
    secondaryAccessTokens: z.record(z.string(), secondaryAccessTokenSchema).optional(),
  }),
  z.object({ type: z.literal('api_key'), apiKey: z.string() }),
  z.object({
    type: z.literal('two_step'),
    token: z.string(),
    expiresAt: z.string().nullable(),
  }),
]);

export type ConnectionCredential = z.infer<typeof credentialSchema>;

export const connectionContextSchema = z.object({
  connection_config: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

export type ConnectionContext = z.infer<typeof connectionContextSchema>;

// —— endpoint functions ——

export async function listProjectConnections(client: ResolvedClient, projectId: string): Promise<ProjectConnection[]> {
  // A resource-scoped client lists global + that resource's connections in one
  // round trip; an unscoped client keeps the platform's fail-safe default
  // (global-only), so pre-resourceId deployments never see end-user rows.
  const query =
    client.resourceId !== undefined
      ? `?${new URLSearchParams({ resourceId: client.resourceId, includeGlobal: 'true' })}`
      : '';
  const response = await platformFetch(client, `/v2/projects/${encodeURIComponent(projectId)}/connections${query}`);
  if (!response.ok) {
    await throwPlatformError(response, `listing connections for project ${projectId}`);
  }
  const parsed = connectionListSchema.safeParse(
    await parsePlatformJson(response, `listing connections for project ${projectId}`),
  );
  if (!parsed.success) {
    throw new MastraConnectError(
      'platform_error',
      `Platform returned an unexpected connection list shape for project ${projectId}.`,
    );
  }
  return parsed.data.connections;
}

export async function listIntegrations(client: ResolvedClient): Promise<IntegrationCatalogEntry[]> {
  const response = await platformFetch(client, '/v2/integrations');
  if (!response.ok) {
    await throwPlatformError(response, 'listing integrations');
  }
  const parsed = integrationCatalogResponseSchema.safeParse(await parsePlatformJson(response, 'listing integrations'));
  if (!parsed.success) {
    throw new MastraConnectError('platform_error', 'Platform returned an unexpected integration catalog shape.');
  }
  return parsed.data.integrations;
}

export async function getConnectionContext(client: ResolvedClient, connectionId: string): Promise<ConnectionContext> {
  const response = await platformFetch(client, `/v2/connections/${encodeURIComponent(connectionId)}/context`);
  if (!response.ok) {
    await throwPlatformError(response, `retrieving context for connection ${connectionId}`);
  }
  const parsed = connectionContextSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new MastraConnectError(
      'platform_error',
      `Platform returned an unexpected context shape for connection ${connectionId}.`,
    );
  }
  return parsed.data;
}

export async function getCredential(client: ResolvedClient, connectionId: string): Promise<ConnectionCredential> {
  const response = await platformFetch(client, `/v2/connections/${encodeURIComponent(connectionId)}/credentials`);
  if (!response.ok) {
    await throwPlatformError(response, `fetching credentials for connection ${connectionId}`);
  }
  const parsed = credentialSchema.safeParse(
    await parsePlatformJson(response, `fetching credentials for connection ${connectionId}`),
  );
  if (!parsed.success) {
    throw new MastraConnectError(
      'unsupported_credential_type',
      `Platform returned an unsupported credential type for connection ${connectionId}.`,
    );
  }
  return parsed.data;
}

type ProxyQueryPrimitive = string | number | boolean;

export interface ProxyRequestOptions {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Provider-relative path (no leading slash required; dot segments are rejected client-side, absolute URLs by the platform). */
  path: string;
  query?: Record<string, ProxyQueryPrimitive | ProxyQueryPrimitive[] | undefined>;
  headers?: Record<string, string>;
  baseUrlOverride?: string;
  body?: unknown;
  /**
   * How to decode the response body. Defaults to JSON parsing (with a raw
   * text fallback when JSON parsing fails). Set to `'arraybuffer'` for
   * providers that return binary payloads (file exports, downloaded assets):
   * the response body is returned as an ArrayBuffer and never parsed.
   */
  responseType?: 'arraybuffer';
}

/**
 * Sends a request through the platform connection proxy and returns the
 * provider's parsed JSON on 2xx.
 *
 * Error-mapping scope: 401/404 map to `unauthorized`/`connection_not_found`
 * only when the response carries a platform RFC-7807 problem body — a
 * provider's own 401/404 passed through the proxy stays `proxy_error` with the
 * provider status attached.
 */
/**
 * True when any path segment is a literal or percent-encoded dot segment.
 * fetch/URL normalizes `..` (and `%2e%2e` variants) *before* the request is
 * sent, which would let a crafted path escape the connection-proxy prefix and
 * hit an arbitrary platform route with the caller's bearer token.
 */
function hasDotSegment(path: string): boolean {
  return path.split('/').some(segment => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // Malformed percent-encoding: reject rather than guess what the
      // URL parser would do with it.
      return true;
    }
    return decoded === '.' || decoded === '..';
  });
}

/**
 * Client-side shape check on `baseUrlOverride` before it is forwarded to the
 * platform proxy. The platform is the source of truth on which origins a
 * connection may target; this rejects trivially unsafe values (non-HTTPS
 * schemes, embedded credentials, unparseable URLs) so an authenticated
 * platform request is never issued with a malformed override header.
 */
function assertValidBaseUrlOverride(baseUrlOverride: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrlOverride);
  } catch {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid baseUrlOverride '${baseUrlOverride}': must be an absolute URL.`,
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid baseUrlOverride '${baseUrlOverride}': only https:// URLs are allowed.`,
    );
  }
  if (parsed.username || parsed.password) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid baseUrlOverride '${baseUrlOverride}': embedded credentials are not allowed.`,
    );
  }
}

export interface ProxyResponse {
  data: unknown;
  status: number;
  headers: Record<string, string>;
}

export async function proxyRequest(
  client: ResolvedClient,
  connectionId: string,
  options: ProxyRequestOptions,
): Promise<unknown> {
  return (await proxyRequestWithResponse(client, connectionId, options)).data;
}

/** Preserves HTTP metadata for tools with status-dependent provider contracts. */
export async function proxyRequestWithResponse(
  client: ResolvedClient,
  connectionId: string,
  options: ProxyRequestOptions,
): Promise<ProxyResponse> {
  const cleanPath = options.path.replace(/^\/+/, '');
  if (hasDotSegment(cleanPath)) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid proxy path '${options.path}': dot segments are not allowed.`,
    );
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const queryString = search.size > 0 ? `?${search.toString()}` : '';
  const url = `/v2/connections/${encodeURIComponent(connectionId)}/proxy/${cleanPath}${queryString}`;

  // The platform authenticates proxy requests with the project token and
  // injects the provider credential upstream (same invariant as the MCP
  // transport). A caller-supplied authorization header would merge with the
  // platform bearer under a different casing and corrupt platform auth, so it
  // is dropped here rather than forwarded.
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    const lower = name.toLowerCase();
    if (lower === 'authorization' || lower === 'proxy-authorization') continue;
    headers[name] = value;
  }
  if (options.baseUrlOverride !== undefined) {
    assertValidBaseUrlOverride(options.baseUrlOverride);
    headers['base-url-override'] = options.baseUrlOverride;
  }
  const init: RequestInit = { method: options.method, headers };
  const hasContentType = () => Object.keys(headers).some(name => name.toLowerCase() === 'content-type');
  if (typeof options.body === 'string') {
    // Pre-encoded payloads (multipart, form-encoded) go out unchanged with
    // the caller's content type; only JSON encoding is applied automatically.
    if (!hasContentType()) {
      headers['content-type'] = 'text/plain';
    }
    init.body = options.body;
  } else if (options.body instanceof ArrayBuffer || options.body instanceof Uint8Array) {
    // Buffer extends Uint8Array, so provider file uploads reach the proxy as
    // raw bytes instead of being JSON-encoded into an object of numeric keys.
    if (!hasContentType()) {
      headers['content-type'] = 'application/octet-stream';
    }
    init.body = options.body as RequestInit['body'];
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const response = await platformFetch(client, url, init);

  if (!response.ok) {
    const { detail, isProblemJson } = await extractProblemDetail(response);
    if (isProblemJson) {
      // Platform-originated error (bad path, unknown connection, auth, limits).
      if (response.status === 401 || response.status === 403) {
        throw new MastraConnectError(
          'unauthorized',
          `Unauthorized calling the connection proxy${detail ? `: ${detail}` : '.'}`,
          { status: response.status, detail },
        );
      }
      if (response.status === 404) {
        throw new MastraConnectError(
          'connection_not_found',
          `Connection ${connectionId} not found${detail ? `: ${detail}` : '.'}`,
          { status: response.status, detail },
        );
      }
      throw new MastraConnectError(
        'proxy_error',
        `Proxy request failed (${response.status})${detail ? `: ${detail}` : '.'}`,
        {
          status: response.status,
          detail,
        },
      );
    }
    // Provider-originated error passed through the proxy.
    throw new MastraConnectError(
      'proxy_error',
      `Provider request failed (${response.status})${detail ? `: ${detail}` : '.'}`,
      { status: response.status, detail },
    );
  }

  const metadata = { status: response.status, headers: Object.fromEntries(response.headers.entries()) };
  if (response.status === 204) return { ...metadata, data: null };
  if (options.responseType === 'arraybuffer') {
    return { ...metadata, data: await response.arrayBuffer() };
  }
  const text = await response.text();
  if (!text) return { ...metadata, data: null };
  try {
    return { ...metadata, data: JSON.parse(text) };
  } catch {
    return { ...metadata, data: text };
  }
}

export const connectSessionSchema = z.object({
  connectionId: z.string(),
  integrationId: z.string(),
  connectUrl: z.string(),
  sessionToken: z.string(),
  expiresAt: z.string(),
});

export type ConnectSession = z.infer<typeof connectSessionSchema>;

/**
 * Creates a project-scoped connect session. A resource-scoped client passes
 * its resource key in the body, so the resulting connection is owned by that
 * end user; an unscoped client creates a global connection.
 */
export async function createProjectConnectSession(
  client: ResolvedClient,
  projectId: string,
  integrationId: string,
): Promise<ConnectSession> {
  const response = await platformFetch(
    client,
    `/v2/projects/${encodeURIComponent(projectId)}/integrations/${encodeURIComponent(integrationId)}/connect-sessions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(client.resourceId !== undefined ? { resourceId: client.resourceId } : {}),
    },
  );
  if (!response.ok) {
    await throwPlatformError(response, `creating a connect session for ${integrationId}`);
  }
  const parsed = connectSessionSchema.safeParse(
    await parsePlatformJson(response, `creating a connect session for ${integrationId}`),
  );
  if (!parsed.success) {
    throw new MastraConnectError(
      'platform_error',
      `Platform returned an unexpected connect-session shape for ${integrationId}.`,
    );
  }
  return parsed.data;
}

/** Disconnects a connection. The platform tears down the vendor side asynchronously. */
export async function disconnectConnection(client: ResolvedClient, connectionId: string): Promise<void> {
  const response = await platformFetch(client, `/v2/connections/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await throwPlatformError(response, `disconnecting connection ${connectionId}`);
  }
}
