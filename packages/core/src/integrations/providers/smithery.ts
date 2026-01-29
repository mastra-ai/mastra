/**
 * Smithery Registry integration provider
 *
 * Smithery is a discovery layer for MCP servers. It provides a registry
 * of MCP servers that users can browse and connect to. The actual tool
 * execution happens through MCP protocol.
 *
 * API Documentation: https://smithery.ai/docs/concepts/registry
 */

import type {
  IntegrationProviderType,
  ListToolkitsOptions,
  ListToolkitsResponse,
  ListToolsOptions,
  ListToolsResponse,
  ProviderStatus,
  ProviderTool,
  ProviderToolkit,
  SmitheryServer,
  SmitheryServerConnection,
  ToolProvider,
} from './types';

const SMITHERY_API_BASE = 'https://registry.smithery.ai';

/**
 * Options for searching Smithery servers
 */
export interface SmitherySearchOptions {
  /** Search query */
  query?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Results per page */
  pageSize?: number;
}

/**
 * Response from Smithery server search
 */
export interface SmitherySearchResponse {
  servers: SmitheryServer[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

/**
 * Smithery Registry provider
 *
 * This provider enables browsing MCP servers from the Smithery Registry.
 * It presents MCP servers as "toolkits" that users can select, then
 * connects to the actual MCP server to fetch available tools.
 */
export class SmitheryProvider implements ToolProvider {
  readonly name: IntegrationProviderType = 'smithery';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  getStatus(): ProviderStatus {
    return {
      provider: 'smithery',
      connected: true, // Public registry, always available
      name: 'Smithery',
      description: 'Browse MCP servers from the Smithery Registry',
      icon: '/icons/smithery.svg',
    };
  }

  /**
   * List MCP servers from Smithery as toolkits
   *
   * Each MCP server is presented as a toolkit that users can select.
   */
  async listToolkits(options?: ListToolkitsOptions): Promise<ListToolkitsResponse> {
    const searchOptions: SmitherySearchOptions = {
      query: options?.search,
      page: options?.cursor ? parseInt(options.cursor, 10) : 1,
      pageSize: options?.limit ?? 20,
    };

    const response = await this.searchServers(searchOptions);

    const toolkits: ProviderToolkit[] = response.servers.map(server => ({
      slug: server.qualifiedName,
      name: server.displayName,
      description: server.description ?? '',
      icon: server.iconUrl,
      category: server.verified ? 'verified' : 'community',
      metadata: {
        verified: server.verified,
        useCount: server.useCount,
        remote: server.remote,
        homepage: server.homepage,
        security: server.security,
      },
    }));

    const hasMore = response.pagination.currentPage < response.pagination.totalPages;
    const nextCursor = hasMore ? String(response.pagination.currentPage + 1) : undefined;

    return {
      toolkits,
      nextCursor,
      hasMore,
    };
  }

  /**
   * List tools is not directly supported by Smithery
   *
   * Tools are discovered by connecting to the actual MCP server.
   * Use getServerConnection() to get connection details, then
   * connect with MCPToolProvider to list tools.
   */
  async listTools(_options?: ListToolsOptions): Promise<ListToolsResponse> {
    // Tools are fetched from the MCP server, not from Smithery registry
    return {
      tools: [],
      hasMore: false,
    };
  }

  /**
   * Get tool is not directly supported by Smithery
   */
  async getTool(_slug: string): Promise<ProviderTool> {
    throw new Error('Tools must be accessed through the MCP server. Use getServerConnection() to connect.');
  }

  /**
   * Search for MCP servers in the Smithery registry
   */
  async searchServers(options?: SmitherySearchOptions): Promise<SmitherySearchResponse> {
    const params = new URLSearchParams();
    if (options?.query) {
      params.set('q', options.query);
    }
    if (options?.page) {
      params.set('page', String(options.page));
    }
    if (options?.pageSize) {
      params.set('pageSize', String(options.pageSize));
    }

    const url = `${SMITHERY_API_BASE}/servers?${params.toString()}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Smithery API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed information about a specific server
   */
  async getServer(qualifiedName: string): Promise<SmitheryServer> {
    const url = `${SMITHERY_API_BASE}/servers/${encodeURIComponent(qualifiedName)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Smithery API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get connection details for an MCP server
   *
   * This fetches the server's connection information (URL for remote,
   * command/args for local) that can be used to create an MCP connection.
   */
  async getServerConnection(qualifiedName: string): Promise<SmitheryServerConnection> {
    const url = `${SMITHERY_API_BASE}/servers/${encodeURIComponent(qualifiedName)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Smithery API error: ${response.status} ${response.statusText}`);
    }

    const server = await response.json();

    // Helper to extract URL from connection (Smithery uses deploymentUrl or url)
    const getConnectionUrl = (conn: Record<string, unknown>): string | undefined => {
      return (conn.deploymentUrl as string) || (conn.url as string);
    };

    // Helper to check if connection is URL-based (http, sse, websocket)
    const isUrlBasedConnection = (type: string): boolean => {
      return type === 'http' || type === 'sse' || type === 'websocket';
    };

    // Check for connections array from the API response
    if (server.connections && Array.isArray(server.connections) && server.connections.length > 0) {
      // Prefer URL-based connections (http, sse, websocket) over stdio
      const remoteConnection = server.connections.find((c: { type: string }) => isUrlBasedConnection(c.type));

      if (remoteConnection) {
        const url = getConnectionUrl(remoteConnection);
        if (url) {
          return {
            type: 'http',
            url,
            configSchema: remoteConnection.configSchema,
          };
        }
      }

      // Fall back to stdio if available
      const stdioConnection = server.connections.find((c: { type: string }) => c.type === 'stdio');

      if (stdioConnection) {
        return {
          type: 'stdio',
          command: stdioConnection.command,
          args: stdioConnection.args,
          env: stdioConnection.env,
          configSchema: stdioConnection.configSchema,
        };
      }

      // Use first connection if nothing else matches
      const firstConnection = server.connections[0];
      const isStdio = firstConnection.type === 'stdio';
      const url = getConnectionUrl(firstConnection);

      if (isStdio) {
        return {
          type: 'stdio',
          command: firstConnection.command,
          args: firstConnection.args,
          env: firstConnection.env,
          configSchema: firstConnection.configSchema,
        };
      }

      if (url) {
        return {
          type: 'http',
          url,
          configSchema: firstConnection.configSchema,
        };
      }
    }

    // Legacy: check for deploymentUrl on remote servers
    if (server.remote && server.deploymentUrl) {
      return {
        type: 'http',
        url: server.deploymentUrl,
        configSchema: server.configSchema,
      };
    }

    // Legacy: check for direct url property
    if (server.url) {
      return {
        type: 'http',
        url: server.url,
      };
    }

    throw new Error(`Unable to determine connection details for server: ${qualifiedName}`);
  }
}

/**
 * Placeholder Smithery provider for the registry
 *
 * This provider is registered globally and always reports as available.
 * Actual Smithery API calls are made with SmitheryProvider instances
 * created in the server package.
 */
export class SmitheryPlaceholderProvider implements ToolProvider {
  readonly name: IntegrationProviderType = 'smithery';

  getStatus(): ProviderStatus {
    return {
      provider: 'smithery',
      connected: true, // Public registry, always available
      name: 'Smithery',
      description: 'Browse MCP servers from the Smithery Registry',
      icon: '/icons/smithery.svg',
    };
  }

  async listToolkits(): Promise<ListToolkitsResponse> {
    // Placeholder - actual servers come from SmitheryProvider instances
    return {
      toolkits: [],
      hasMore: false,
    };
  }

  async listTools(): Promise<ListToolsResponse> {
    // Placeholder - tools come from MCP server connections
    return {
      tools: [],
      hasMore: false,
    };
  }

  async getTool(_slug: string): Promise<ProviderTool> {
    throw new Error('Tools must be accessed through the MCP server after selecting a Smithery registry entry');
  }
}
