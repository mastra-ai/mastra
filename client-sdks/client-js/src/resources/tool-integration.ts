import type {
  AuthorizeToolIntegrationParams,
  AuthorizeToolIntegrationResponse,
  ClientOptions,
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
   * Lists existing provider connections for the caller, scoped to a tool service.
   *
   * The connection owner is resolved server-side from the request's auth
   * context — clients cannot pass a userId. Use this to surface
   * already-authorized accounts so authors can pin them onto an agent
   * without re-running OAuth.
   */
  listConnections(params: ListToolIntegrationConnectionsParams): Promise<ListToolIntegrationConnectionsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('toolService', params.toolService);
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
   * Returns integration-level health (config, reachability, etc.).
   */
  getHealth(): Promise<ToolIntegrationHealthResponse> {
    return this.request(`/tool-integrations/${encodeURIComponent(this.integrationId)}/health`);
  }
}
