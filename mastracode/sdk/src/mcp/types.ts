/**
 * Type definitions for the MCP server system.
 * Servers provide external tools via Model Context Protocol.
 */

/**
 * A stdio-based MCP server configuration entry.
 * Launches a local process that communicates via stdin/stdout.
 */
export interface McpStdioServerConfig {
  /** The command to launch the MCP server process */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables to set for the server process */
  env?: Record<string, string>;
}

/**
 * An HTTP-based MCP server configuration entry.
 * Connects to a remote server via Streamable HTTP or SSE.
 */
export interface McpHttpServerConfig {
  /** The URL of the remote MCP server endpoint */
  url: string;
  /** Optional HTTP headers (e.g. for authentication) */
  headers?: Record<string, string>;
  /** Optional OAuth configuration for protected HTTP MCP servers */
  oauth?: McpHttpOAuthConfig;
}

/**
 * OAuth client configuration for an HTTP MCP server.
 */
export interface McpHttpOAuthConfig {
  /** Redirect URL for OAuth callbacks. Defaults to DEFAULT_OAUTH_REDIRECT_URL when omitted. */
  redirectUrl?: string;
  /**
   * Shorthand for a loopback redirect URL: synthesizes
   * `http://localhost:<callbackPort>/callback`, matching the convention
   * Claude Code and Codex use. Config files reject entries that set both
   * `callbackPort` and `redirectUrl`; for programmatically registered
   * servers, `callbackPort` takes precedence over `redirectUrl`.
   */
  callbackPort?: number;
  /** Human-readable OAuth client name */
  clientName?: string;
  /** Optional scopes requested during OAuth */
  scopes?: string[];
  /** Optional pre-registered OAuth client ID */
  clientId?: string;
  /** Optional pre-registered OAuth client secret */
  clientSecret?: string;
}

/**
 * A single MCP server configuration entry.
 * Detected by the presence of `command` (stdio) or `url` (http).
 */
export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

/**
 * An MCP server entry that was skipped during config loading.
 */
export interface McpSkippedServer {
  /** Server name (from config key) */
  name: string;
  /** Human-readable reason the server was skipped */
  reason: string;
}

/**
 * The top-level config object from mcp.json or settings.local.json.
 * Maps server names to their config.
 */
export interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
  skippedServers?: McpSkippedServer[];
}

/**
 * Runtime status of a connected MCP server.
 */
export interface McpServerStatus {
  /** Server name (from config key) */
  name: string;
  /** Whether the server is currently connected */
  connected: boolean;
  /** Whether the server is currently connecting */
  connecting?: boolean;
  /** Number of tools provided by this server */
  toolCount: number;
  /** List of tool names provided */
  toolNames: string[];
  /** Transport type used by the server */
  transport: 'stdio' | 'http';
  /** Error message if connection failed */
  error?: string;
  /** Whether the server rejected the connection pending OAuth authorization */
  needsAuth?: boolean;
  /**
   * Whether an OAuth authorization flow is currently in flight for this server.
   * Owned by the manager so the state survives a selector being closed/reopened;
   * the UI uses it to keep offering "Cancel authentication" while auth is pending.
   */
  authenticating?: boolean;
  /**
   * Whether this failed status is the result of the caller deliberately
   * cancelling an in-flight authentication (rather than a genuine failure).
   * The UI uses it to suppress a misleading "Failed to authenticate" message.
   */
  cancelled?: boolean;
}
