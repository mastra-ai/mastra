/**
 * Types for external tool provider integrations
 *
 * This module defines the abstraction layer for integrating with external
 * tool providers like Composio and Arcade.dev. The ToolProvider interface
 * enables dynamic discovery and execution of tools from these providers.
 */

/**
 * Supported integration provider types
 */
export type IntegrationProviderType = 'composio' | 'arcade' | 'mcp';

/**
 * MCP-specific integration metadata
 *
 * Stored in StorageIntegrationConfig.metadata for MCP integrations.
 * Supports two transport types:
 * - HTTP/SSE: Remote MCP servers accessed via URL
 * - Stdio: Local MCP servers spawned as subprocesses
 */
export interface MCPIntegrationMetadata {
  /** Transport type: 'http' for remote servers, 'stdio' for local subprocess */
  transport: 'http' | 'stdio';

  // HTTP transport config (when transport === 'http')
  /** MCP server URL (HTTP/SSE endpoint) - required for HTTP transport */
  url?: string;
  /** Optional authentication headers for HTTP transport */
  headers?: Record<string, string>;

  // Stdio transport config (when transport === 'stdio')
  /** Command to execute (e.g., 'npx', 'node', 'python') - required for stdio transport */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the subprocess */
  env?: Record<string, string>;

  /** Server info cached after successful connection */
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

/**
 * Provider connection status information
 *
 * Used to communicate whether a provider is available based on
 * environment configuration (API keys, etc.)
 */
export interface ProviderStatus {
  /** Provider identifier */
  provider: IntegrationProviderType;
  /** Whether the provider has valid credentials configured */
  connected: boolean;
  /** Display name of the provider */
  name: string;
  /** Brief description of what the provider offers */
  description: string;
  /** Icon URL or path for UI display */
  icon?: string;
}

/**
 * A toolkit/app grouping of related tools
 *
 * Providers often organize tools into toolkits or applications.
 * For example, Composio has "GitHub", "Gmail", etc.
 */
export interface ProviderToolkit {
  /** Unique identifier for the toolkit */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of what the toolkit provides */
  description: string;
  /** Icon URL or path for UI display */
  icon?: string;
  /** Category/tag for organization */
  category?: string;
  /** Number of tools available in this toolkit */
  toolCount?: number;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A single tool definition from a provider
 *
 * Represents a tool that can be executed through the provider's API.
 * The schema format should be compatible with JSON Schema / Zod.
 */
export interface ProviderTool {
  /** Unique identifier for the tool */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema or Zod-compatible input schema */
  inputSchema: Record<string, unknown>;
  /** JSON Schema or Zod-compatible output schema */
  outputSchema?: Record<string, unknown>;
  /** Toolkit this tool belongs to */
  toolkit?: string;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for listing toolkits from a provider
 */
export interface ListToolkitsOptions {
  /** Search query to filter toolkits by name/description */
  search?: string;
  /** Filter by category */
  category?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination (cursor-based pagination) */
  cursor?: string;
}

/**
 * Options for listing tools from a provider
 */
export interface ListToolsOptions {
  /** Filter tools by toolkit slug */
  toolkitSlug?: string;
  /** Filter tools by multiple toolkit slugs */
  toolkitSlugs?: string[];
  /** Search query to filter tools by name/description */
  search?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination (cursor-based pagination) */
  cursor?: string;
}

/**
 * Paginated response for toolkit listings
 */
export interface ListToolkitsResponse {
  /** Array of toolkits */
  toolkits: ProviderToolkit[];
  /** Next cursor for pagination, if available */
  nextCursor?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Paginated response for tool listings
 */
export interface ListToolsResponse {
  /** Array of tools */
  tools: ProviderTool[];
  /** Next cursor for pagination, if available */
  nextCursor?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Abstract interface for external tool providers
 *
 * Implementations of this interface provide access to external tool
 * platforms like Composio and Arcade.dev. The interface handles:
 *
 * - Listing available toolkits and tools
 * - Fetching tool definitions with schemas
 * - Checking provider connection status
 *
 * Tool execution is handled separately by the tool executor layer.
 */
export interface ToolProvider {
  /** Provider identifier */
  readonly name: IntegrationProviderType;

  /**
   * Check if the provider has valid credentials configured
   *
   * @returns Provider status including connection state
   */
  getStatus(): Promise<ProviderStatus> | ProviderStatus;

  /**
   * List available toolkits from the provider
   *
   * @param options - Filtering and pagination options
   * @returns Paginated list of toolkits
   */
  listToolkits(options?: ListToolkitsOptions): Promise<ListToolkitsResponse>;

  /**
   * List available tools from the provider
   *
   * @param options - Filtering and pagination options (e.g., by toolkit)
   * @returns Paginated list of tools
   */
  listTools(options?: ListToolsOptions): Promise<ListToolsResponse>;

  /**
   * Get detailed information about a specific tool
   *
   * @param slug - The tool's unique identifier
   * @returns Tool definition with complete schema information
   */
  getTool(slug: string): Promise<ProviderTool>;
}
