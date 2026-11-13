import {
  createProjectConnectSession,
  createReconnectSession,
  disconnectConnection,
  getConnectUrl,
  getConnectionContext,
  getCredential,
  hasDotSegment,
  linkConnectionToProject,
  listIntegrations,
  listProjectConnections,
  platformFetch,
  proxyRequest,
  proxyRequestWithResponse,
  RESOURCE_ID_HEADER,
  resolveClient,
  throwPlatformError,
  validateResourceId,
} from './client.js';
import type {
  ConnectClientOptions,
  ConnectSession,
  ConnectUrl,
  ConnectionContext,
  ConnectionCredential,
  IntegrationCatalogEntry,
  ProjectConnection,
  ProxyRequestOptions,
  ProxyResponse,
  ResolvedClient,
} from './client.js';
import { MastraConnectError } from './errors.js';
import { EventsClient, resolveEventsUrl } from './events.js';

/** Auth and identity headers the client sets; per-call headers can't override them. */
const RESERVED_REQUEST_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-organization-id',
  'x-mastra-project-id',
  RESOURCE_ID_HEADER,
]);

/** Default per-request timeout for {@link ConnectClient} calls. */
export const DEFAULT_CONNECT_CLIENT_TIMEOUT_MS = 15_000;

/** Largest delay `setTimeout` honors; larger values fire almost immediately. */
const MAX_TIMER_MS = 2_147_483_647;

function withoutReservedHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !RESERVED_REQUEST_HEADERS.has(name.toLowerCase())),
  );
}

export interface ConnectClientConfig extends ConnectClientOptions {
  /**
   * Per-request timeout in milliseconds for every call this client makes,
   * including proxy calls. Defaults to 15000. A timeout throws
   * `MastraConnectError` with code `timeout`.
   */
  timeoutMs?: number;
  /**
   * Events service base URL, for the events client. Falls back to
   * MASTRA_EVENTS_API_URL, then the regional default from
   * MASTRA_PLATFORM_REGION, then https://events.mastra.ai.
   */
  eventsUrl?: string;
}

export interface ListConnectionsInput {
  /** Keep only connections whose integration id is one of these. */
  providerKeys?: readonly string[];
  /** Project to list. Defaults to the client's project. */
  projectId?: string;
}

export type ConnectRequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ConnectRequestInit {
  /** JSON-encoded request body. */
  body?: unknown;
  /** Extra headers for this call only. Authorization, organization, project and resource headers are ignored. */
  headers?: Record<string, string>;
  /** Query parameters; `undefined` values are skipped. */
  query?: Record<string, string | undefined>;
  /** Aborts the call; combined with the client's timeout. */
  signal?: AbortSignal;
}

/**
 * Typed client for the Mastra platform integrations API (`/v2`): project
 * connections, credentials, the connection proxy, and connect sessions.
 *
 * Every field of the configuration falls back to the same environment
 * variables as `tools()` and `channels()`. Unlike those, every call made
 * through this client is bounded by `timeoutMs`.
 *
 * @example
 * ```ts
 * const connect = new ConnectClient();
 * const [jira] = await connect.listConnections({ providerKeys: ['jira'] });
 * const issue = await connect.proxy(jira.id, { method: 'GET', path: '/rest/api/3/issue/ENG-1' });
 * ```
 */
export class ConnectClient {
  readonly #config: ConnectClientConfig;
  readonly #client: ResolvedClient;
  readonly #projectId: string | undefined;
  #events: EventsClient | undefined;

  constructor(config: ConnectClientConfig = {}) {
    const timeoutMs = config.timeoutMs ?? DEFAULT_CONNECT_CLIENT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_MS) {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid timeoutMs: expected a positive number up to ${MAX_TIMER_MS}, got ${timeoutMs}.`,
      );
    }
    // Fail fast on a bad events URL rather than on first `events` access.
    resolveEventsUrl(config);
    const resolved = resolveClient(config);
    this.#config = config;
    this.#client = { ...resolved, baseUrl: stripVersionSuffix(resolved.baseUrl), timeoutMs };
    this.#projectId = resolved.headers['x-mastra-project-id'];
  }

  /** The integrations API base URL this client calls. */
  get baseUrl(): string {
    return this.#client.baseUrl;
  }

  /** The project this client lists and links connections for, when configured. */
  get projectId(): string | undefined {
    return this.#projectId;
  }

  /** The end-user resource key this client asserts, when scoped. */
  get resourceId(): string | undefined {
    return this.#client.resourceId;
  }

  /**
   * Events service client sharing this client's credentials and project.
   * Streams are long-lived, so `timeoutMs` does not apply to them.
   */
  get events(): EventsClient {
    this.#events ??= new EventsClient(this.#config);
    return this.#events;
  }

  /** Returns a client scoped to an end-user resource; this client is unchanged. */
  withResource(resourceId: string): ConnectClient {
    return new ConnectClient({ ...this.#config, resourceId: validateResourceId(resourceId) });
  }

  /**
   * Lists the project's connections, optionally only for some providers.
   * Always reads the project listing: org connections not linked to the
   * project are not visible, and their provider events are not published to
   * it.
   */
  async listConnections(input: ListConnectionsInput = {}): Promise<ProjectConnection[]> {
    const connections = await listProjectConnections(this.#client, this.#requireProject(input.projectId));
    if (!input.providerKeys) return connections;
    const keys = new Set(input.providerKeys);
    return connections.filter(connection => keys.has(connection.integrationId));
  }

  /** Links an org connection to a project. Idempotent. */
  async linkConnection(connectionId: string, input: { projectId?: string } = {}): Promise<void> {
    return linkConnectionToProject(this.#client, this.#requireProject(input.projectId), connectionId);
  }

  listIntegrations(): Promise<IntegrationCatalogEntry[]> {
    return listIntegrations(this.#client);
  }

  getCredential(connectionId: string): Promise<ConnectionCredential> {
    return getCredential(this.#client, connectionId);
  }

  getContext(connectionId: string): Promise<ConnectionContext> {
    return getConnectionContext(this.#client, connectionId);
  }

  /** Calls the provider through the connection proxy and returns its parsed body. */
  proxy(connectionId: string, request: ProxyRequestOptions): Promise<unknown> {
    return proxyRequest(this.#client, connectionId, { ...request, headers: withoutReservedHeaders(request.headers) });
  }

  /** Like {@link proxy}, but also returns the provider's status and headers. */
  proxyWithResponse(connectionId: string, request: ProxyRequestOptions): Promise<ProxyResponse> {
    return proxyRequestWithResponse(this.#client, connectionId, {
      ...request,
      headers: withoutReservedHeaders(request.headers),
    });
  }

  /** Starts a connect session whose connection is born linked to the project. */
  async createConnectSession(integrationId: string, input: { projectId?: string } = {}): Promise<ConnectSession> {
    return createProjectConnectSession(this.#client, this.#requireProject(input.projectId), integrationId);
  }

  createReconnectSession(connectionId: string): Promise<ConnectSession> {
    return createReconnectSession(this.#client, connectionId);
  }

  getConnectUrl(connectionId: string): Promise<ConnectUrl> {
    return getConnectUrl(this.#client, connectionId);
  }

  disconnect(connectionId: string): Promise<void> {
    return disconnectConnection(this.#client, connectionId);
  }

  /**
   * Low-level JSON call against the integrations host, for platform routes
   * outside the typed surface. Non-2xx responses throw `MastraConnectError`;
   * an empty body resolves to `undefined`.
   */
  async request<T = unknown>(method: ConnectRequestMethod, path: string, init: ConnectRequestInit = {}): Promise<T> {
    const context = `calling ${method} ${path.split('?', 1)[0]}`;
    const response = await this.#send(method, path, init);
    if (!response.ok) {
      await throwPlatformError(response, context, this.#client.accessToken);
    }
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new MastraConnectError(
        'platform_error',
        `Platform returned an unparseable response body while ${context}.`,
      );
    }
  }

  /**
   * Sends a request without following redirects and returns the raw
   * `Response`, for platform routes that answer with a redirect. No status
   * mapping is applied.
   */
  async fetchRaw(method: ConnectRequestMethod, path: string, init: ConnectRequestInit = {}): Promise<Response> {
    return this.#send(method, path, init, 'manual');
  }

  async #send(
    method: ConnectRequestMethod,
    path: string,
    init: ConnectRequestInit,
    redirect?: RequestInit['redirect'],
  ): Promise<Response> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new MastraConnectError('invalid_options', `Invalid platform path '${path}': must start with a single '/'.`);
    }
    const [pathname = '', existingQuery] = path.split('#', 1)[0]!.split(/\?(.*)/s, 2);
    if (hasDotSegment(pathname)) {
      throw new MastraConnectError('invalid_options', `Invalid platform path '${path}': dot segments are not allowed.`);
    }
    const search = new URLSearchParams(existingQuery ?? '');
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) search.set(key, value);
    }
    const query = search.size > 0 ? `?${search.toString()}` : '';

    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(init.headers ?? {})) {
      const lower = name.toLowerCase();
      if (RESERVED_REQUEST_HEADERS.has(lower)) continue;
      headers[lower] = value;
    }
    const request: RequestInit = { method, headers };
    if (init.body !== undefined) {
      headers['content-type'] ??= 'application/json';
      request.body = JSON.stringify(init.body);
    }
    if (redirect) request.redirect = redirect;
    if (init.signal) request.signal = init.signal;
    return platformFetch(this.#client, `${pathname}${query}`, request);
  }

  #requireProject(projectId: string | undefined): string {
    const resolved = projectId?.trim() || this.#projectId;
    if (!resolved) {
      throw new MastraConnectError(
        'missing_project_id',
        'Missing Mastra project id: set MASTRA_PROJECT_ID, or pass projectId to the ConnectClient or the call.',
      );
    }
    return resolved;
  }
}

/**
 * Strips a trailing `/v1` so legacy platform API URLs such as
 * `https://platform.mastra.ai/v1` keep working: callers pass fully
 * versioned paths.
 */
function stripVersionSuffix(baseUrl: string): string {
  if (!baseUrl.endsWith('/v1')) return baseUrl;
  let end = baseUrl.length - 3;
  while (end > 0 && baseUrl[end - 1] === '/') end--;
  return baseUrl.slice(0, end);
}
