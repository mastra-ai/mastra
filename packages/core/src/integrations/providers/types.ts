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
export type IntegrationProviderType = 'composio' | 'arcade' | 'mcp' | 'smithery';

// =============================================================================
// Provider Metadata Types (Discriminated Union)
// =============================================================================

/**
 * Base metadata fields shared by all provider types.
 * The index signature allows these types to be compatible with Record<string, unknown>.
 */
interface BaseProviderMetadata {
  /** Provider type discriminant */
  provider: IntegrationProviderType;
  /** Allow additional properties for API compatibility */
  [key: string]: unknown;
}

/**
 * Composio-specific integration metadata
 */
export interface ComposioMetadata extends BaseProviderMetadata {
  provider: 'composio';
  /** Connected account ID for the user's OAuth connection */
  connectedAccountId?: string;
  /**
   * User ID for Composio (used as entity_id in API calls).
   * This is the preferred field name used by the frontend.
   */
  userId?: string;
  /**
   * User/entity ID for Composio (used as entity_id in API calls).
   * @deprecated Use `userId` instead. This field is kept for backward compatibility.
   */
  entityId?: string;
  /** Auth config ID used for this integration */
  authConfigId?: string;
  /** Cached auth scheme information */
  authScheme?: 'oauth2' | 'oauth1' | 'api_key' | 'basic' | 'bearer_token' | 'no_auth';
}

/**
 * Arcade-specific integration metadata
 */
export interface ArcadeMetadata extends BaseProviderMetadata {
  provider: 'arcade';
  /** User ID for Arcade auth context */
  userId?: string;
  /** Authorization ID from pending auth flow */
  pendingAuthorizationId?: string;
  /** OAuth provider ID from toolkit requirements */
  oauthProviderId?: string;
  /** Required scopes for OAuth */
  requiredScopes?: string[];
}

/**
 * MCP-specific integration metadata
 *
 * Stored in StorageIntegrationConfig.metadata for MCP integrations.
 * Supports two transport types:
 * - HTTP/SSE: Remote MCP servers accessed via URL
 * - Stdio: Local MCP servers spawned as subprocesses
 */
export interface MCPMetadata extends BaseProviderMetadata {
  provider: 'mcp';
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
 * Smithery-specific integration metadata
 *
 * Contains the Smithery server identifier plus MCP connection details.
 */
export interface SmitheryMetadata extends BaseProviderMetadata {
  provider: 'smithery';
  /** Smithery server qualified name (e.g., "@anthropics/mcp-server-filesystem") */
  smitheryQualifiedName: string;
  /** Display name from Smithery registry */
  smitheryDisplayName?: string;
  /** Whether the server is verified on Smithery */
  verified?: boolean;

  /** MCP connection details (derived from Smithery server info) */
  transport: 'http' | 'stdio';

  // HTTP transport config
  url?: string;
  headers?: Record<string, string>;

  // Stdio transport config
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  /** Server info cached after successful connection */
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

/**
 * Discriminated union of all provider metadata types.
 * Use the `provider` field as the discriminant.
 *
 * @example
 * ```typescript
 * function handleMetadata(metadata: ProviderMetadata) {
 *   if (metadata.provider === 'composio') {
 *     // TypeScript knows metadata is ComposioMetadata here
 *     console.log(metadata.connectedAccountId);
 *   }
 * }
 * ```
 */
export type ProviderMetadata = ComposioMetadata | ArcadeMetadata | MCPMetadata | SmitheryMetadata;

// Type guards for provider metadata
export function isComposioMetadata(metadata: ProviderMetadata): metadata is ComposioMetadata {
  return metadata.provider === 'composio';
}

export function isArcadeMetadata(metadata: ProviderMetadata): metadata is ArcadeMetadata {
  return metadata.provider === 'arcade';
}

export function isMCPMetadata(metadata: ProviderMetadata): metadata is MCPMetadata {
  return metadata.provider === 'mcp';
}

export function isSmitheryMetadata(metadata: ProviderMetadata): metadata is SmitheryMetadata {
  return metadata.provider === 'smithery';
}

/**
 * Check if metadata is MCP-like (MCP or Smithery).
 * Useful for shared MCP transport handling.
 */
export function isMCPLikeMetadata(metadata: ProviderMetadata): metadata is MCPMetadata | SmitheryMetadata {
  return metadata.provider === 'mcp' || metadata.provider === 'smithery';
}

/**
 * @deprecated Use MCPMetadata instead. Kept for backward compatibility.
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
 * @deprecated Use SmitheryMetadata instead. Kept for backward compatibility.
 */
export interface SmitheryIntegrationMetadata {
  /** Smithery server qualified name (e.g., "@anthropics/mcp-server-filesystem") */
  smitheryQualifiedName: string;
  /** Display name from Smithery registry */
  smitheryDisplayName?: string;
  /** Whether the server is verified on Smithery */
  verified?: boolean;

  /** MCP connection details (derived from Smithery server info) */
  transport: 'http' | 'stdio';

  // HTTP transport config
  url?: string;
  headers?: Record<string, string>;

  // Stdio transport config
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  /** Server info cached after successful connection */
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

/**
 * Smithery server information from the registry API
 */
export interface SmitheryServer {
  /** Unique qualified name (e.g., "@anthropics/mcp-server-filesystem") */
  qualifiedName: string;
  /** Human-readable display name */
  displayName: string;
  /** Server description */
  description?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Whether the server is verified */
  verified?: boolean;
  /** Usage count */
  useCount?: number;
  /** Whether this is a remote (HTTP) server */
  remote?: boolean;
  /** Repository URL */
  homepage?: string;
  /** Security information */
  security?: {
    scanPassed?: boolean;
  };
  /** Connection information (available after fetching full server details) */
  connections?: SmitheryConnectionInfo[];
  /** Deployment URL for remote servers */
  deploymentUrl?: string;
}

/**
 * Connection info from Smithery API
 */
export interface SmitheryConnectionInfo {
  /** Connection type */
  type: 'stdio' | 'http' | 'sse' | 'websocket';
  /** URL for remote connections */
  url?: string;
  /** Deployment URL for remote connections (Smithery specific) */
  deploymentUrl?: string;
  /** Configuration schema */
  configSchema?: Record<string, unknown>;
  /** Command for stdio connections */
  command?: string;
  /** Arguments for stdio connections */
  args?: string[];
  /** Environment variables for stdio connections */
  env?: Record<string, string>;
}

/**
 * Smithery server connection details (normalized for MCP transport)
 *
 * Note: Smithery API returns 'sse' or 'websocket' types which are
 * normalized to 'http' since they're all URL-based connections.
 */
export interface SmitheryServerConnection {
  /** Transport type (normalized: sse/websocket -> http) */
  type: 'http' | 'stdio';

  // HTTP transport (includes SSE/WebSocket)
  url?: string;
  configSchema?: Record<string, unknown>;

  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
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

// =============================================================================
// Authorization Interface (Unified OAuth/Auth Handling)
// =============================================================================

/**
 * Authorization status values
 */
export type AuthorizationStatus = 'pending' | 'completed' | 'failed' | 'not_required';

/**
 * Result of initiating authorization
 */
export interface AuthorizationResult {
  /** Current status of authorization */
  status: AuthorizationStatus;
  /** ID to track this authorization flow */
  authorizationId?: string;
  /** URL to redirect user for OAuth flow */
  authorizationUrl?: string;
  /** OAuth scopes being requested */
  scopes?: string[];
  /** Error message if authorization failed immediately */
  error?: string;
}

/**
 * Result of checking authorization status
 */
export interface AuthorizationStatusResult {
  /** Current status of authorization */
  status: AuthorizationStatus;
  /** Whether authorization is complete and ready to use */
  completed: boolean;
  /** Error message if authorization failed */
  error?: string;
  /** Additional provider-specific data */
  metadata?: Record<string, unknown>;
}

/**
 * Credentials retrieved after successful authorization
 */
export interface ProviderCredentials {
  /** Type of credential */
  type: 'oauth_token' | 'api_key' | 'connected_account';
  /** Credential identifier (account ID, token ID, etc.) */
  credentialId: string;
  /** When the credential expires (if applicable) */
  expiresAt?: Date;
  /** Provider-specific credential data */
  data?: Record<string, unknown>;
}

/**
 * Interface for providers that support OAuth or other authorization flows
 *
 * Providers implementing this interface can authorize users to access
 * third-party services through OAuth, API keys, or other mechanisms.
 *
 * @example
 * ```typescript
 * if (isAuthorizableProvider(provider)) {
 *   const result = await provider.authorize('github', 'user-123');
 *   if (result.authorizationUrl) {
 *     // Redirect user to OAuth flow
 *     window.location.href = result.authorizationUrl;
 *   }
 * }
 * ```
 */
export interface AuthorizableProvider {
  /**
   * Initiate authorization for a toolkit/service
   *
   * @param toolkitSlug - The toolkit or service to authorize
   * @param userId - User identifier for the authorization context
   * @param options - Additional authorization options
   * @returns Authorization result with URL or completion status
   */
  authorize(
    toolkitSlug: string,
    userId: string,
    options?: {
      callbackUrl?: string;
      scopes?: string[];
    },
  ): Promise<AuthorizationResult>;

  /**
   * Check the status of an ongoing authorization
   *
   * @param authorizationId - ID from the authorize() call
   * @returns Current authorization status
   */
  checkAuthorizationStatus(authorizationId: string): Promise<AuthorizationStatusResult>;

  /**
   * Get credentials for a completed authorization
   *
   * @param toolkitSlug - The toolkit to get credentials for
   * @param userId - User identifier
   * @returns Credentials if authorization is complete, null otherwise
   */
  getCredentials(toolkitSlug: string, userId: string): Promise<ProviderCredentials | null>;

  /**
   * Check if a toolkit requires authorization
   *
   * @param toolkitSlug - The toolkit to check
   * @returns Authorization requirement information
   */
  getAuthorizationRequirements?(toolkitSlug: string): Promise<{
    required: boolean;
    type: 'oauth' | 'api_key' | 'none';
    scopes?: string[];
  }>;
}

/**
 * Type guard to check if a provider supports authorization
 */
export function isAuthorizableProvider(provider: ToolProvider): provider is ToolProvider & AuthorizableProvider {
  return (
    'authorize' in provider &&
    'checkAuthorizationStatus' in provider &&
    'getCredentials' in provider &&
    typeof (provider as AuthorizableProvider).authorize === 'function' &&
    typeof (provider as AuthorizableProvider).checkAuthorizationStatus === 'function' &&
    typeof (provider as AuthorizableProvider).getCredentials === 'function'
  );
}

// =============================================================================
// MCP Provider Interface (Abstract for Core/Server Split)
// =============================================================================

/**
 * Configuration for MCP transport
 */
export type MCPTransportConfig =
  | {
      transport: 'http';
      url: string;
      headers?: Record<string, string>;
      connectTimeout?: number;
    }
  | {
      transport: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };

/**
 * Result from validating an MCP connection
 */
export interface MCPConnectionValidation {
  valid: boolean;
  toolCount: number;
  serverInfo?: {
    name?: string;
    version?: string;
  };
  error?: string;
}

/**
 * Result from executing an MCP tool
 */
export interface MCPExecutionResult {
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
  };
}

/**
 * Abstract interface for MCP providers
 *
 * This interface defines the contract for MCP tool providers.
 * The core package provides a placeholder, while the server
 * package provides the real implementation using @mastra/mcp.
 */
export interface MCPToolProviderInterface extends ToolProvider {
  readonly name: 'mcp';

  /**
   * Validate connection to the MCP server.
   * Tests connectivity and returns available tool count.
   */
  validateConnection(): Promise<MCPConnectionValidation>;

  /**
   * Execute a tool on the MCP server
   *
   * @param toolSlug - Tool identifier
   * @param input - Tool input parameters
   * @returns Execution result
   */
  executeTool(toolSlug: string, input: Record<string, unknown>): Promise<MCPExecutionResult>;

  /**
   * Disconnect from the MCP server.
   * Should be called when done using the provider.
   */
  disconnect(): Promise<void>;

  /**
   * Get the transport configuration for this provider
   */
  getTransportConfig(): MCPTransportConfig;
}

/**
 * Factory function type for creating MCP providers.
 * Implemented in @mastra/server.
 */
export type MCPProviderFactory = (config: MCPTransportConfig) => MCPToolProviderInterface;
