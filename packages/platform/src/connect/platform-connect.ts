export interface PlatformConnectOptions {
  accessToken: string;
  projectId: string;
  /**
   * Integrations API URL. Falls back to `MASTRA_INTEGRATIONS_API_URL`, then the regional default from
   * `MASTRA_PLATFORM_REGION` (`us` or `eu`), then `https://integrations.mastra.ai`.
   */
  apiUrl?: string;
  fetch?: typeof fetch;
}

/** An integration in the Platform catalog, such as `github` or `linear`. */
export interface PlatformIntegration {
  id: string;
  displayName?: string | null;
  logoUrl?: string | null;
  authType?: string | null;
  capabilities: { mcp?: boolean };
}

/** An account connected to the project, either shared by the project or owned by one end user. */
export interface PlatformConnection {
  id: string;
  integrationId: string;
  /** `active` and `needs_reauth` connections can be used; other statuses cannot. */
  status: string;
  accountLabel?: string | null;
  /** The end user who owns the connection, or null for a connection shared by the whole project. */
  resourceId?: string | null;
  connectedByUserId?: string | null;
  connectedAt?: string | null;
  createdAt?: string | null;
}

/** A pending connection and the link that completes it. */
export interface PlatformConnectSession {
  connectionId: string;
  integrationId: string;
  /** Open this link in the end user's browser to sign in to the provider. */
  connectUrl: string;
  expiresAt: string;
}

export class PlatformConnectError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Platform Connect request failed with ${status}${body ? `: ${body}` : ''}`);
    this.name = 'PlatformConnectError';
  }
}

const REGIONAL_API_URLS: Record<string, string> = {
  us: 'https://integrations.us.mastra.ai',
  eu: 'https://integrations.eu.mastra.ai',
};

function defaultApiUrl() {
  const override = process.env.MASTRA_INTEGRATIONS_API_URL?.trim();
  if (override) return override;
  return (
    REGIONAL_API_URLS[process.env.MASTRA_PLATFORM_REGION?.trim().toLowerCase() ?? ''] ??
    'https://integrations.mastra.ai'
  );
}

/**
 * Mastra Connect for a Platform project: the provider accounts its agents and tools act through.
 * Pass `resourceId` to act for one end user; their connections are theirs alone.
 */
export class PlatformConnect {
  readonly #accessToken: string;
  readonly #projectId: string;
  readonly #apiUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: PlatformConnectOptions) {
    this.#accessToken = options.accessToken;
    this.#projectId = options.projectId;
    this.#apiUrl = (options.apiUrl ?? defaultApiUrl()).replace(/\/+$/, '');
    this.#fetch = options.fetch ?? fetch;
  }

  /** The integrations that can be connected. */
  async listIntegrations(): Promise<PlatformIntegration[]> {
    return (await this.#request<{ integrations: PlatformIntegration[] }>('GET', '/v2/integrations')).integrations;
  }

  /**
   * The project's active connections. Without `resourceId`, only connections shared by the project;
   * with it, that end user's connections plus the shared ones.
   */
  async listConnections(params: { resourceId?: string } = {}): Promise<PlatformConnection[]> {
    const query = params.resourceId
      ? `?${new URLSearchParams({ resourceId: params.resourceId, includeGlobal: 'true' })}`
      : '';
    const { connections } = await this.#request<{ connections: PlatformConnection[] }>(
      'GET',
      `${this.#projectPath}/connections${query}`,
    );
    return connections;
  }

  /**
   * Starts connecting an end user's account to an integration. Send the end user to the returned
   * `connectUrl`; the connection becomes active once they sign in to the provider.
   */
  async createConnectSession(integrationId: string, params: { resourceId: string }): Promise<PlatformConnectSession> {
    const session = await this.#request<Omit<PlatformConnectSession, 'connectUrl'>>(
      'POST',
      `${this.#projectPath}/integrations/${encodeURIComponent(integrationId)}/connect-sessions`,
      { resourceId: params.resourceId },
      params.resourceId,
    );
    // An end user's session never returns its link at creation: it is fetched separately, with
    // the owner asserted again.
    const { connectUrl, expiresAt } = await this.#request<{ connectUrl: string; expiresAt: string }>(
      'GET',
      `/v2/connections/${encodeURIComponent(session.connectionId)}/connect-url`,
      undefined,
      params.resourceId,
    );
    return { connectionId: session.connectionId, integrationId: session.integrationId, connectUrl, expiresAt };
  }

  /** Disconnects one of an end user's connections. */
  async disconnect(connectionId: string, params: { resourceId: string }): Promise<void> {
    await this.#request('DELETE', `/v2/connections/${encodeURIComponent(connectionId)}`, undefined, params.resourceId);
  }

  get #projectPath() {
    return `/v2/projects/${encodeURIComponent(this.#projectId)}`;
  }

  async #request<T>(method: string, path: string, body?: unknown, resourceId?: string): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.#accessToken}`,
      'x-mastra-project-id': this.#projectId,
    };
    if (resourceId !== undefined) headers['x-mastra-resource-id'] = resourceId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await this.#fetch(`${this.#apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new PlatformConnectError(response.status, text);
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
