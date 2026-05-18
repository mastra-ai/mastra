import type {
  AuthorizeToolIntegrationParams,
  AuthorizeToolIntegrationResponse,
  ClientOptions,
  DisconnectToolIntegrationConnectionParams,
  DisconnectToolIntegrationConnectionResponse,
  GetToolIntegrationConnectionUsageResponse,
  ListToolIntegrationConnectionFieldsParams,
  ListToolIntegrationConnectionFieldsResponse,
  ListToolIntegrationConnectionsParams,
  ListToolIntegrationConnectionsResponse,
  ListToolIntegrationToolsParams,
  ListToolIntegrationToolsResponse,
  ListToolServicesResponse,
  ToolIntegrationAuthStatusResponse,
  ToolIntegrationConnectionStatusParams,
  ToolIntegrationConnectionStatusResponse,
  ToolIntegrationHealthResponse,
} from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific tool integration.
 *
 * Exposes the catalog (services + tools), the OAuth surface (authorize +
 * auth-status + connection-status) and an integration-level health check.
 */
export class ToolIntegration extends BaseResource {
  constructor(
    options: ClientOptions,
    private integrationId: string,
  ) {
    super(options);
  }

  /**
   * Lists tool services exposed by this integration.
   */
  listToolServices(): Promise<ListToolServicesResponse> {
    return this.request(`/tool-integrations/${encodeURIComponent(this.integrationId)}/tool-services`);
  }

  /**
   * Lists tools from this integration with optional filtering and pagination.
   */
  listTools(params?: ListToolIntegrationToolsParams): Promise<ListToolIntegrationToolsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.toolService) {
      searchParams.set('toolService', params.toolService);
    }
    if (params?.search) {
      searchParams.set('search', params.search);
    }
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }

    const queryString = searchParams.toString();
    return this.request(
      `/tool-integrations/${encodeURIComponent(this.integrationId)}/tools${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Starts an OAuth flow for a (toolService, connectionId) pair. Returns
   * a redirect URL and an opaque auth handle to poll with `getAuthStatus`.
   */
  authorize(params: AuthorizeToolIntegrationParams): Promise<AuthorizeToolIntegrationResponse> {
    return this.request(`/tool-integrations/${encodeURIComponent(this.integrationId)}/authorize`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Polls the OAuth flow status for an outstanding authorize call.
   */
  getAuthStatus(authId: string): Promise<ToolIntegrationAuthStatusResponse> {
    return this.request(
      `/tool-integrations/${encodeURIComponent(this.integrationId)}/auth-status/${encodeURIComponent(authId)}`,
    );
  }

  /**
   * Batch-checks whether a set of (connectionId, toolService) tuples are
   * currently connected.
   */
  getConnectionStatus(params: ToolIntegrationConnectionStatusParams): Promise<ToolIntegrationConnectionStatusResponse> {
    return this.request(`/tool-integrations/${encodeURIComponent(this.integrationId)}/connection-status`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Lists existing provider connections, scoped to a tool service.
   *
   * Default behavior: the connection owner is resolved server-side from the
   * request's auth context. Admin callers (with `tool-integrations:admin`
   * permission) may also pass `authorId` to target a specific author, or
   * omit it to receive connections across all authors known to
   * `tool_connections` for this provider/service.
   *
   * Cursor pagination: pass `cursor` from the previous response's
   * `nextCursor` to fetch the next page. `limit` caps page size
   * (default 50, max 200).
   */
  listConnections(params: ListToolIntegrationConnectionsParams): Promise<ListToolIntegrationConnectionsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('toolService', params.toolService);
    if (params.authorId) {
      searchParams.set('authorId', params.authorId);
    }
    if (params.cursor) {
      searchParams.set('cursor', params.cursor);
    }
    if (params.limit !== undefined && params.limit !== null) {
      searchParams.set('limit', String(params.limit));
    }
    return this.request(
      `/tool-integrations/${encodeURIComponent(this.integrationId)}/connections?${searchParams.toString()}`,
    );
  }

  /**
   * Lists provider-specific fields the picker should collect before
   * initiating a new connection (e.g. Confluence subdomain). Most tool
   * services return an empty array.
   */
  listConnectionFields(
    params: ListToolIntegrationConnectionFieldsParams,
  ): Promise<ListToolIntegrationConnectionFieldsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('toolService', params.toolService);
    return this.request(
      `/tool-integrations/${encodeURIComponent(this.integrationId)}/connection-fields?${searchParams.toString()}`,
    );
  }

  /**
   * Disconnects (revokes + deletes) a persisted connection.
   *
   * Without `force: true` the server refuses if any agent still pins the
   * connection. With `force: true` the provider-side revoke is best-effort
   * (errors are tolerated) and the local row is always removed.
   */
  disconnectConnection(
    connectionId: string,
    params?: DisconnectToolIntegrationConnectionParams,
  ): Promise<DisconnectToolIntegrationConnectionResponse> {
    const searchParams = new URLSearchParams();
    if (params?.force) {
      searchParams.set('force', 'true');
    }
    const queryString = searchParams.toString();
    return this.request(
      `/tool-integrations/${encodeURIComponent(this.integrationId)}/connections/${encodeURIComponent(connectionId)}${
        queryString ? `?${queryString}` : ''
      }`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Lists the agents that currently pin a given connection. Used by the
   * picker to warn the user before disconnecting a shared account.
   */
  getConnectionUsage(connectionId: string): Promise<GetToolIntegrationConnectionUsageResponse> {
    return this.request(
      `/tool-integrations/${encodeURIComponent(this.integrationId)}/connections/${encodeURIComponent(connectionId)}/usage`,
    );
  }

  /**
   * Returns integration-level health (config, reachability, etc.).
   */
  getHealth(): Promise<ToolIntegrationHealthResponse> {
    return this.request(`/tool-integrations/${encodeURIComponent(this.integrationId)}/health`);
  }
}
