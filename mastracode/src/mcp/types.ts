/**
 * Type definitions for the MCP server system.
 * Servers provide external tools via Model Context Protocol.
 */

/**
 * Stdio-based MCP server (launched as a subprocess).
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
 * HTTP-based MCP server (remote, via Streamable HTTP or SSE).
 */
export interface McpHttpServerConfig {
  /** URL of the remote MCP server endpoint */
  url: string;
}

/**
 * A single MCP server configuration entry.
 * Either stdio (command) or HTTP (url) based.
 */
export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

/**
 * The top-level config object from mcp.json or settings.local.json.
 * Maps server names to their config.
 */
export interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

/**
 * Runtime status of a connected MCP server.
 */
export interface McpServerStatus {
  /** Server name (from config key) */
  name: string;
  /** Whether the server is currently connected */
  connected: boolean;
  /** Number of tools provided by this server */
  toolCount: number;
  /** List of tool names provided */
  toolNames: string[];
  /** Error message if connection failed */
  error?: string;
}
