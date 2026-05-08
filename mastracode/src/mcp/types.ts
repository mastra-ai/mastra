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
}
