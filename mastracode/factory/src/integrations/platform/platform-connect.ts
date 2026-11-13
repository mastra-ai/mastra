import { ConnectClient, MastraConnectError } from '@mastra/connect';
import type { ConnectClientConfig, ConnectRequestMethod } from '@mastra/connect';
import { logPlatformError } from './logging.js';

/**
 * A ready Connect client, or the options to build one. Unset options fall
 * back to the platform environment (`MASTRA_PLATFORM_ACCESS_TOKEN`,
 * `MASTRA_INTEGRATIONS_API_URL`, `MASTRA_PLATFORM_REGION`, `MASTRA_PROJECT_ID`).
 */
export type PlatformConnectOption = ConnectClient | ConnectClientConfig;

/**
 * Builds the Connect client a Platform integration talks to the platform
 * through. A client passed in is used as-is; otherwise failed platform calls
 * are logged to stderr, as Factory has always done.
 */
export function createPlatformConnectClient(option?: PlatformConnectOption): ConnectClient {
  if (option instanceof ConnectClient) return option;
  const fetchImpl = option?.fetch ?? ((input, init) => globalThis.fetch(input, init));
  return new ConnectClient({ ...option, fetch: withFailureLogging(fetchImpl) });
}

/**
 * Placeholder bearer for provider API clients that send through
 * {@link connectProxyFetch}: they require a token, but Connect replaces the
 * authorization header with the platform credential, so it never leaves.
 */
export const CONNECT_PROXY_TOKEN = 'mastra-connect';

/**
 * A `fetch` for a provider API client whose base URL is a connection proxy
 * under `connect.baseUrl`. Each request goes through `connect`, which supplies
 * the platform credential, project and timeout. Bodies must be JSON.
 */
export function connectProxyFetch(connect: ConnectClient): typeof globalThis.fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(`${connect.baseUrl}/`)) {
      throw new Error(`Refusing to send a request outside the Connect API: ${new URL(url).origin}.`);
    }
    if (init?.body !== undefined && init.body !== null && typeof init.body !== 'string') {
      throw new Error('Connect proxy requests must have a JSON string body.');
    }
    return connect.fetchRaw((init?.method ?? 'GET') as ConnectRequestMethod, url.slice(connect.baseUrl.length), {
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      ...(init?.body ? { body: JSON.parse(init.body) as unknown } : {}),
      ...(init?.signal ? { signal: init.signal } : {}),
    });
  };
}

/**
 * Calls a platform route that answers with a redirect and returns its
 * `Location`. Any other answer throws a {@link MastraConnectError}.
 */
export async function platformRedirectLocation(
  connect: ConnectClient,
  method: ConnectRequestMethod,
  path: string,
): Promise<string> {
  const response = await connect.fetchRaw(method, path);
  const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
  if (location) return location;
  const detail = (await response.text().catch(() => '')).trim() || undefined;
  throw new MastraConnectError(
    'platform_error',
    `Platform request failed (${response.status}) while calling ${method} ${path.split('?', 1)[0]}: expected a redirect.`,
    { status: response.status, source: 'platform', ...(detail ? { detail } : {}) },
  );
}

/** The HTTP status of a failed platform or proxied provider call. */
export function platformErrorStatus(error: unknown): number | undefined {
  return error instanceof MastraConnectError ? error.status : undefined;
}

/** The detail the platform or provider gave for a failure, falling back to the error message. */
export function platformErrorMessage(error: unknown): string {
  if (error instanceof MastraConnectError) return error.detail ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

/** How long a rate-limited call asked to be retried after, at least `fallbackMs`. */
export function platformRetryDelayMs(error: unknown, fallbackMs: number): number {
  if (error instanceof MastraConnectError && error.status === 429 && error.retryAfterMs !== undefined) {
    return Math.max(fallbackMs, error.retryAfterMs);
  }
  return fallbackMs;
}

function withFailureLogging(fetchImpl: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = requestPath(input);
    let response: Response;
    try {
      response = await fetchImpl(input, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const token = bearerToken(init?.headers);
      logPlatformError('Platform API transport error', {
        method,
        path,
        name: error instanceof Error ? error.name : undefined,
        message: token ? message.split(token).join('[REDACTED]') : message,
      });
      throw error;
    }
    // Redirects are answers here: legacy GitHub install and authorize routes reply with one.
    if (!response.ok && (response.status < 300 || response.status >= 400)) {
      logPlatformError('Platform API request failed', {
        method,
        path,
        status: response.status,
        retryAfter: response.headers.get('retry-after') ?? undefined,
      });
    }
    return response;
  };
}

function bearerToken(headers: RequestInit['headers']): string | undefined {
  const value = new Headers(headers).get('authorization');
  return value?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || undefined;
}

function requestPath(input: string | URL | Request): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?', 1)[0]!;
  }
}
