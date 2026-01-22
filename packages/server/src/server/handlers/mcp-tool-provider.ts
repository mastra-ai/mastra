/**
 * MCP Tool Provider Implementation
 *
 * This module provides the MCPToolProvider class for connecting to MCP
 * (Model Context Protocol) servers and fetching their available tools.
 *
 * Supports two transport types:
 * - HTTP/SSE: Remote servers accessed via URL
 * - Stdio: Local servers spawned as subprocesses
 *
 * This implementation lives in @mastra/server to avoid circular dependency
 * with @mastra/mcp in the core package.
 */

import type {
  MCPProviderConfig,
  MCPIntegrationMetadata,
  ToolProvider,
  IntegrationProviderType,
  ProviderStatus,
  ListToolkitsOptions,
  ListToolkitsResponse,
  ListToolsOptions,
  ListToolsResponse,
  ProviderTool,
} from '@mastra/core/integrations';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { MCPClient } from '@mastra/mcp';
import type { z } from 'zod';

/**
 * Validation result from MCP connection test
 */
export interface MCPValidationResult {
  valid: boolean;
  toolCount: number;
  error?: string;
}

/**
 * MCP Tool Provider for connecting to MCP servers
 *
 * This provider connects to MCP servers via HTTP/SSE (remote) or Stdio (local)
 * and provides access to their tools. Unlike Composio/Arcade which are
 * configured via API keys, MCP providers are created dynamically with
 * a server URL or command.
 *
 * @example HTTP Transport
 * ```typescript
 * const provider = new MCPToolProvider({
 *   transport: 'http',
 *   url: 'https://mcp.example.com/sse',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * ```
 *
 * @example Stdio Transport
 * ```typescript
 * const provider = new MCPToolProvider({
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['@modelcontextprotocol/server-filesystem', '/tmp']
 * });
 * ```
 */
export class MCPToolProvider implements ToolProvider {
  readonly name: IntegrationProviderType = 'mcp';
  private transport: 'http' | 'stdio';

  // HTTP transport config
  private serverUrl?: string;
  private headers?: Record<string, string>;

  // Stdio transport config
  private command?: string;
  private args?: string[];
  private env?: Record<string, string>;

  // Common config
  private connectTimeout: number;
  private timeout: number;
  private client: MCPClient | null = null;

  constructor(config: MCPProviderConfig) {
    // Determine transport type from config
    this.transport = config.transport || (config.url ? 'http' : 'stdio');

    if (this.transport === 'http') {
      if (!config.url) {
        throw new Error('URL is required for HTTP transport');
      }
      this.serverUrl = config.url;
      this.headers = config.headers;
    } else {
      if (!config.command) {
        throw new Error('Command is required for Stdio transport');
      }
      this.command = config.command;
      this.args = config.args;
      this.env = config.env;
    }

    this.connectTimeout = config.connectTimeout ?? 10000;
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Get a unique identifier for this provider instance
   */
  private getProviderId(): string {
    if (this.transport === 'http') {
      return this.serverUrl!;
    }
    return `${this.command}${this.args?.length ? '_' + this.args.join('_') : ''}`;
  }

  /**
   * Get or create the MCP client connection
   */
  private async getClient(): Promise<MCPClient> {
    if (!this.client) {
      const serverConfig =
        this.transport === 'http'
          ? {
              url: new URL(this.serverUrl!),
              requestInit: this.headers ? { headers: this.headers } : undefined,
              connectTimeout: this.connectTimeout,
            }
          : {
              command: this.command!,
              args: this.args,
              env: this.env,
            };

      this.client = new MCPClient({
        id: `mcp-provider-${this.getProviderId()}`,
        servers: { server: serverConfig },
        timeout: this.timeout,
      });
    }
    return this.client;
  }

  /**
   * Get provider status
   *
   * For MCP, always returns connected=true since actual connection
   * validation happens through validateConnection()
   */
  getStatus(): ProviderStatus {
    const description =
      this.transport === 'http'
        ? `MCP server at ${this.serverUrl}`
        : `MCP server via ${this.command} ${this.args?.join(' ') || ''}`;

    return {
      provider: 'mcp',
      connected: true,
      name: 'MCP Server',
      description,
      icon: '/icons/mcp.svg',
    };
  }

  /**
   * Validate connection to the MCP server
   *
   * Attempts to connect and list tools from the server.
   * Returns validation result with tool count on success.
   */
  async validateConnection(): Promise<MCPValidationResult> {
    try {
      const client = await this.getClient();
      const tools = await client.listTools();
      const toolCount = Object.keys(tools).length;

      return {
        valid: true,
        toolCount,
      };
    } catch (error) {
      return {
        valid: false,
        toolCount: 0,
        error: error instanceof Error ? error.message : 'Failed to connect to MCP server',
      };
    }
  }

  /**
   * List toolkits from the MCP server
   *
   * MCP doesn't have a concept of toolkits, so we return a single
   * virtual toolkit representing all tools from the server.
   */
  async listToolkits(_options?: ListToolkitsOptions): Promise<ListToolkitsResponse> {
    // MCP doesn't have toolkits - return single "server" toolkit
    let toolCount = 0;

    try {
      const client = await this.getClient();
      const tools = await client.listTools();
      toolCount = Object.keys(tools).length;
    } catch {
      // If we can't connect, still return the placeholder toolkit
    }

    const description =
      this.transport === 'http'
        ? `Tools from ${this.serverUrl}`
        : `Tools from ${this.command} ${this.args?.join(' ') || ''}`;

    return {
      toolkits: [
        {
          slug: 'mcp-server',
          name: 'MCP Server Tools',
          description,
          toolCount,
        },
      ],
      hasMore: false,
    };
  }

  /**
   * Convert a Zod schema to JSON Schema, with fallback for non-Zod types
   */
  private zodToJsonSchemaForTool(schema: unknown): Record<string, unknown> {
    // Check if it's a Zod schema by looking for common Zod schema properties
    if (schema && typeof schema === 'object' && '_def' in schema) {
      try {
        return zodToJsonSchema(schema as z.ZodType) as Record<string, unknown>;
      } catch (e) {
        console.error('Failed to convert Zod schema to JSON Schema:', e);
        return {};
      }
    }
    // If it's already a plain object (JSON Schema), return as-is
    if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
      return schema as Record<string, unknown>;
    }
    return {};
  }

  /**
   * List tools from the MCP server
   */
  async listTools(options?: ListToolsOptions): Promise<ListToolsResponse> {
    const client = await this.getClient();
    const mcpTools = await client.listTools();

    let tools: ProviderTool[] = Object.entries(mcpTools).map(([name, tool]) => ({
      // Remove server prefix if present (e.g., "server_toolName" -> "toolName")
      slug: name.replace(/^server_/, ''),
      name: name.replace(/^server_/, ''),
      description: tool.description || '',
      // MCP tools have Zod schemas from client.listTools() - convert to JSON Schema for storage
      inputSchema: this.zodToJsonSchemaForTool(tool.inputSchema),
      // outputSchema from MCP is a Zod schema, but ProviderTool expects Record<string, unknown>
      // We omit it since MCP tools generally don't provide JSON schema output definitions
      outputSchema: undefined,
      toolkit: 'mcp-server',
      metadata: {
        mcpToolId: name,
        transport: this.transport,
        ...(this.transport === 'http' ? { serverUrl: this.serverUrl } : { command: this.command, args: this.args }),
      },
    }));

    // Apply search filter if provided
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      tools = tools.filter(
        tool => tool.name.toLowerCase().includes(searchLower) || tool.description?.toLowerCase().includes(searchLower),
      );
    }

    // Apply limit if provided
    if (options?.limit && tools.length > options.limit) {
      tools = tools.slice(0, options.limit);
    }

    return {
      tools,
      hasMore: false,
    };
  }

  /**
   * Get a specific tool by slug
   */
  async getTool(slug: string): Promise<ProviderTool> {
    const { tools } = await this.listTools();
    const tool = tools.find(t => t.slug === slug);

    if (!tool) {
      throw new Error(`Tool not found: ${slug}`);
    }

    return tool;
  }

  /**
   * Disconnect from the MCP server
   *
   * Should be called when done using the provider to clean up resources.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}

/**
 * Create an MCP provider instance for a specific server
 *
 * @param config - MCP server configuration
 * @returns Configured MCPToolProvider instance
 */
export function createMCPProvider(config: MCPProviderConfig): MCPToolProvider {
  return new MCPToolProvider(config);
}

/**
 * Create an MCP provider from integration metadata
 *
 * @param metadata - MCP integration metadata from storage
 * @returns Configured MCPToolProvider instance
 */
export function createMCPProviderFromMetadata(metadata: MCPIntegrationMetadata): MCPToolProvider {
  if (metadata.transport === 'stdio') {
    return new MCPToolProvider({
      transport: 'stdio',
      command: metadata.command,
      args: metadata.args,
      env: metadata.env,
    });
  }

  return new MCPToolProvider({
    transport: 'http',
    url: metadata.url,
    headers: metadata.headers,
  });
}

/**
 * Result of MCP tool execution
 */
export interface MCPToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  metadata?: {
    executionId?: string;
    duration?: number;
    serverUrl?: string;
  };
}

/**
 * Parameters for executing an MCP tool
 */
export interface ExecuteMCPToolParams {
  /** Transport type */
  transport?: 'http' | 'stdio';

  // HTTP transport config
  /** MCP server URL - required for HTTP transport */
  url?: string;
  /** Optional authentication headers for HTTP transport */
  headers?: Record<string, string>;

  // Stdio transport config
  /** Command to execute - required for stdio transport */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the subprocess */
  env?: Record<string, string>;

  // Common config
  /** Tool slug/name */
  toolSlug: string;
  /** Input parameters for the tool */
  input: Record<string, unknown>;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Operation timeout in milliseconds */
  timeout?: number;
}

/**
 * Execute an MCP tool on an MCP server
 *
 * This function creates a temporary MCPClient connection to execute the tool
 * and then disconnects. For repeated executions, consider using MCPToolProvider
 * directly to maintain a connection.
 *
 * @param params - Execution parameters including transport config, tool slug, and input
 * @returns Tool execution result
 *
 * @example HTTP Transport
 * ```typescript
 * const result = await executeMCPTool({
 *   transport: 'http',
 *   url: 'https://mcp.example.com/sse',
 *   headers: { 'Authorization': 'Bearer token' },
 *   toolSlug: 'weather_get_current',
 *   input: { location: 'San Francisco' }
 * });
 * ```
 *
 * @example Stdio Transport
 * ```typescript
 * const result = await executeMCPTool({
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
 *   toolSlug: 'read_file',
 *   input: { path: '/tmp/test.txt' }
 * });
 * ```
 */
export async function executeMCPTool(params: ExecuteMCPToolParams): Promise<MCPToolExecutionResult> {
  const { url, headers, command, args, env, toolSlug, input, connectTimeout = 10000, timeout = 30000 } = params;

  // Determine transport from params
  const transport = params.transport || (url ? 'http' : 'stdio');

  const startTime = Date.now();

  try {
    // Build server config based on transport
    const serverConfig =
      transport === 'http'
        ? {
            url: new URL(url!),
            requestInit: headers ? { headers } : undefined,
            connectTimeout,
          }
        : {
            command: command!,
            args,
            env,
          };

    const client = new MCPClient({
      id: `mcp-executor-${Date.now()}`,
      servers: { server: serverConfig },
      timeout,
    });

    try {
      // Get available tools to find the full tool name (might have server prefix)
      const availableTools = await client.listTools();
      const toolEntries = Object.entries(availableTools);

      // Find the tool - it might be prefixed with 'server_'
      const toolEntry = toolEntries.find(
        ([name]) => name === toolSlug || name === `server_${toolSlug}` || name.endsWith(`_${toolSlug}`),
      );

      if (!toolEntry) {
        return {
          success: false,
          error: {
            message: `Tool not found: ${toolSlug}. Available tools: ${toolEntries.map(([n]) => n).join(', ')}`,
            code: 'TOOL_NOT_FOUND',
          },
        };
      }

      const [_fullToolName, tool] = toolEntry;

      // Check if tool has execute function
      if (!tool.execute) {
        return {
          success: false,
          error: {
            message: `Tool ${toolSlug} does not have an execute function`,
            code: 'TOOL_NOT_EXECUTABLE',
          },
        };
      }

      // Execute the tool with input and optional context
      const result = await tool.execute(input, {});

      return {
        success: true,
        output: result,
        metadata: {
          duration: Date.now() - startTime,
          ...(transport === 'http' ? { serverUrl: url } : { command }),
        },
      };
    } finally {
      await client.disconnect();
    }
  } catch (err) {
    return {
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error executing MCP tool',
        code: 'EXECUTION_ERROR',
        details: err,
      },
      metadata: {
        duration: Date.now() - startTime,
        ...(transport === 'http' ? { serverUrl: url } : { command }),
      },
    };
  }
}
