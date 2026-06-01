import type {
  AuthorizeToolProviderParams,
  AuthorizeToolProviderResponse,
  ClientOptions,
  DisconnectToolProviderConnectionParams,
  DisconnectToolProviderConnectionResponse,
  GetToolProviderConnectionUsageParams,
  GetToolProviderConnectionUsageResponse,
  GetToolProviderToolSchemaResponse,
  ListToolProviderConnectionFieldsParams,
  ListToolProviderConnectionFieldsResponse,
  ListToolProviderConnectionsParams,
  ListToolProviderConnectionsResponse,
  ListToolProviderToolkitsResponse,
  ListToolProviderToolsParams,
  ListToolProviderToolsResponse,
  ToolProviderAuthStatusResponse,
  ToolProviderConnectionStatusParams,
  ToolProviderConnectionStatusResponse,
  ToolProviderHealthResponse,
  UpdateToolProviderConnectionParams,
  UpdateToolProviderConnectionResponse,
} from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific tool provider.
 *
 * Exposes the catalog (toolkits + tools), the OAuth surface (authorize +
 * auth-status + connection-status), the lifecycle surface (connections list /
 * disconnect / usage / fields), and a provider-level health check.
 */
export class ToolProvider extends BaseResource {
  constructor(
    options: ClientOptions,
    private providerId: string,
  ) {
    super(options);
  }

  /**
   * Lists available toolkits from this provider.
   */
  listToolkits(): Promise<ListToolProviderToolkitsResponse> {
    return this.request(`/tool-providers/${encodeURIComponent(this.providerId)}/toolkits`);
  }

  /**
   * Lists available tools from this provider, with optional filtering.
   */
  listTools(params?: ListToolProviderToolsParams): Promise<ListToolProviderToolsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.toolkit) {
      searchParams.set('toolkit', params.toolkit);
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
      `/tool-providers/${encodeURIComponent(this.providerId)}/tools${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Gets the input schema for a specific tool.
   */
  getToolSchema(toolSlug: string): Promise<GetToolProviderToolSchemaResponse> {
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/tools/${encodeURIComponent(toolSlug)}/schema`,
    );
  }

  /**
   * Starts an OAuth flow for a (toolkit, connectionId) pair. Returns a
   * redirect URL and an opaque auth handle to poll with `getAuthStatus`.
   */
  authorize(params: AuthorizeToolProviderParams): Promise<AuthorizeToolProviderResponse> {
    return this.request(`/tool-providers/${encodeURIComponent(this.providerId)}/authorize`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Polls the OAuth flow status for an outstanding authorize call.
   */
  getAuthStatus(authId: string): Promise<ToolProviderAuthStatusResponse> {
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/auth-status/${encodeURIComponent(authId)}`,
    );
  }

  /**
   * Batch-checks whether a set of (connectionId, toolkit) tuples are
   * currently connected.
   */
  getConnectionStatus(params: ToolProviderConnectionStatusParams): Promise<ToolProviderConnectionStatusResponse> {
    return this.request(`/tool-providers/${encodeURIComponent(this.providerId)}/connection-status`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Lists existing provider connections, scoped to a toolkit.
   *
   * Default: the connection owner is resolved server-side from the request's
   * auth context. Admin callers (with `tool-providers:admin` permission) may
   * pass `authorId` to target a specific author, or omit it to receive
   * connections across all authors known to `tool_provider_connections` for
   * this provider/toolkit. Pagination is page-based via `page` (1-indexed)
   * and `perPage` (default 50, max 200).
   */
  listConnections(params: ListToolProviderConnectionsParams): Promise<ListToolProviderConnectionsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('toolkit', params.toolkit);
    if (params.authorId) {
      searchParams.set('authorId', params.authorId);
    }
    if (params.page !== undefined && params.page !== null) {
      searchParams.set('page', String(params.page));
    }
    if (params.perPage !== undefined && params.perPage !== null) {
      searchParams.set('perPage', String(params.perPage));
    }
    if (params.scope) {
      searchParams.set('scope', params.scope);
    }
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/connections?${searchParams.toString()}`,
    );
  }

  /**
   * Lists provider-specific fields the picker should collect before
   * initiating a new connection (e.g. Confluence subdomain). Most toolkits
   * return an empty array.
   */
  listConnectionFields(
    params: ListToolProviderConnectionFieldsParams,
  ): Promise<ListToolProviderConnectionFieldsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('toolkit', params.toolkit);
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/connection-fields?${searchParams.toString()}`,
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
    params?: DisconnectToolProviderConnectionParams,
  ): Promise<DisconnectToolProviderConnectionResponse> {
    const searchParams = new URLSearchParams();
    if (params?.toolkit) {
      searchParams.set('toolkit', params.toolkit);
    }
    if (params?.force) {
      searchParams.set('force', 'true');
    }
    const queryString = searchParams.toString();
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/connections/${encodeURIComponent(connectionId)}${
        queryString ? `?${queryString}` : ''
      }`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Updates the persisted display label on a connection row. Pass `label: null`
   * (or an empty string) to clear the existing label. Only the connection owner
   * or an admin may rename, unless the row is `scope: 'shared'`.
   */
  updateConnection(
    connectionId: string,
    params: UpdateToolProviderConnectionParams,
  ): Promise<UpdateToolProviderConnectionResponse> {
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/connections/${encodeURIComponent(connectionId)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Lists the agents that currently pin a given connection. Used by the
   * picker to warn the user before disconnecting a shared account.
   */
  getConnectionUsage(
    connectionId: string,
    params?: GetToolProviderConnectionUsageParams,
  ): Promise<GetToolProviderConnectionUsageResponse> {
    const searchParams = new URLSearchParams();
    if (params?.toolkit) {
      searchParams.set('toolkit', params.toolkit);
    }
    const queryString = searchParams.toString();
    return this.request(
      `/tool-providers/${encodeURIComponent(this.providerId)}/connections/${encodeURIComponent(connectionId)}/usage${
        queryString ? `?${queryString}` : ''
      }`,
    );
  }

  /**
   * Returns provider-level health (config, reachability, etc.).
   */
  getHealth(): Promise<ToolProviderHealthResponse> {
    return this.request(`/tool-providers/${encodeURIComponent(this.providerId)}/health`);
  }
}
