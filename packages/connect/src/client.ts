import { z } from 'zod';

import { extractProblemDetail, MastraConnectError } from './errors.js';

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
   * Integrations service base URL. Falls back to MASTRA_INTEGRATIONS_API_URL,
   * then the regional default from MASTRA_PLATFORM_REGION ('us' | 'eu'),
   * then https://integrations.mastra.ai.
   */
  baseUrl?: string;
  /** Fetch implementation, for testing or custom transports. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
}

export interface ResolvedClient {
  baseUrl: string;
  headers: Record<string, string>;
  fetch: typeof globalThis.fetch;
  accessToken: string;
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

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
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

  return { baseUrl, headers, fetch: options?.fetch ?? globalThis.fetch, accessToken };
}

function redact(message: string, accessToken: string): string {
  return message.split(accessToken).join('[REDACTED]');
}

async function platformFetch(client: ResolvedClient, path: string, init?: RequestInit): Promise<Response> {
  try {
    return await client.fetch(`${client.baseUrl}${path}`, {
      ...init,
      headers: { ...client.headers, ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes(client.accessToken)) {
      const redacted = new Error(redact(error.message, client.accessToken));
      redacted.name = error.name;
      throw redacted;
    }
    throw error;
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

// —— response schemas (mirroring the platform's http-schemas) ——

export const connectionSchema = z.object({
  id: z.string(),
  integrationId: z.string(),
  status: z.enum(['active', 'needs_reauth']),
  connectedByUserId: z.string().nullish(),
  connectedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  accountLabel: z.string().nullish(),
});

export type ProjectConnection = z.infer<typeof connectionSchema>;

const connectionListSchema = z.object({
  connections: z.array(connectionSchema),
});

export const credentialSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('oauth2'), accessToken: z.string(), expiresAt: z.string().nullable() }),
  z.object({ type: z.literal('api_key'), apiKey: z.string() }),
]);

export type ConnectionCredential = z.infer<typeof credentialSchema>;

// —— endpoint functions ——

export async function listProjectConnections(client: ResolvedClient, projectId: string): Promise<ProjectConnection[]> {
  const response = await platformFetch(client, `/v2/projects/${encodeURIComponent(projectId)}/connections`);
  if (!response.ok) {
    await throwPlatformError(response, `listing connections for project ${projectId}`);
  }
  const parsed = connectionListSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new MastraConnectError(
      'platform_error',
      `Platform returned an unexpected connection list shape for project ${projectId}.`,
    );
  }
  return parsed.data.connections;
}

export async function getCredential(client: ResolvedClient, connectionId: string): Promise<ConnectionCredential> {
  const response = await platformFetch(client, `/v2/connections/${encodeURIComponent(connectionId)}/credentials`);
  if (!response.ok) {
    await throwPlatformError(response, `fetching credentials for connection ${connectionId}`);
  }
  const parsed = credentialSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new MastraConnectError(
      'unsupported_credential_type',
      `Platform returned an unsupported credential type for connection ${connectionId}.`,
    );
  }
  return parsed.data;
}

export interface ProxyRequestOptions {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Provider-relative path (no leading slash required; absolute URLs and '..' are rejected by the platform). */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
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
export async function proxyRequest(
  client: ResolvedClient,
  connectionId: string,
  options: ProxyRequestOptions,
): Promise<unknown> {
  const cleanPath = options.path.replace(/^\/+/, '');
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const queryString = search.size > 0 ? `?${search.toString()}` : '';
  const url = `/v2/connections/${encodeURIComponent(connectionId)}/proxy/${cleanPath}${queryString}`;

  const headers: Record<string, string> = { ...options.headers };
  const init: RequestInit = { method: options.method, headers };
  if (options.body !== undefined) {
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

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
