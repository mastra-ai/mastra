/**
 * MCP (Model Context Protocol) integration provider types and placeholder
 *
 * The actual MCPToolProvider implementation lives in @mastra/server
 * to avoid circular dependency with @mastra/mcp.
 */

import type {
  IntegrationProviderType,
  ListToolkitsResponse,
  ListToolsResponse,
  ProviderStatus,
  ProviderTool,
  ToolProvider,
} from './types';

/**
 * Configuration for MCP provider
 *
 * Supports two transport types:
 * - HTTP: Remote MCP servers accessed via URL
 * - Stdio: Local MCP servers spawned as subprocesses
 */
export interface MCPProviderConfig {
  /** Transport type: 'http' for remote servers, 'stdio' for local subprocess */
  transport?: 'http' | 'stdio';

  // HTTP transport config
  /** MCP server URL (HTTP/SSE endpoint) - required for HTTP transport */
  url?: string;
  /** Optional authentication headers for HTTP transport */
  headers?: Record<string, string>;

  // Stdio transport config
  /** Command to execute (e.g., 'npx', 'node', 'python') - required for stdio transport */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the subprocess */
  env?: Record<string, string>;

  // Common config
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Operation timeout in milliseconds */
  timeout?: number;
}

/**
 * Placeholder MCP provider for the registry
 *
 * This provider is registered globally and always reports as available.
 * Actual MCP connections are made dynamically with MCPToolProvider instances
 * created in the server package.
 */
export class MCPPlaceholderProvider implements ToolProvider {
  readonly name: IntegrationProviderType = 'mcp';

  getStatus(): ProviderStatus {
    return {
      provider: 'mcp',
      connected: true, // Always true - actual connection happens when URL is provided
      name: 'MCP Server',
      description: 'Connect to any MCP-compatible server by entering its URL',
      icon: '/icons/mcp.svg',
    };
  }

  async listToolkits(): Promise<ListToolkitsResponse> {
    // Placeholder - actual toolkits come from MCPToolProvider instances
    return {
      toolkits: [],
      hasMore: false,
    };
  }

  async listTools(): Promise<ListToolsResponse> {
    // Placeholder - actual tools come from MCPToolProvider instances
    return {
      tools: [],
      hasMore: false,
    };
  }

  async getTool(_slug: string): Promise<ProviderTool> {
    throw new Error('MCP tools must be accessed through a configured MCPToolProvider instance');
  }
}
