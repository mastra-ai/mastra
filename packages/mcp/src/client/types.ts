import type { RequestContext } from '@mastra/core/di';
import type { SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse.js';
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  ClientCapabilities,
  ElicitRequest,
  ElicitResult,
  LoggingLevel,
  ProgressNotification,
} from '@modelcontextprotocol/sdk/types.js';

// Re-export MCP SDK LoggingLevel for convenience
export type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

/**
 * Log message structure for MCP client logging.
 */
export interface LogMessage {
  /** Logging level (debug, info, warning, error, etc.) */
  level: LoggingLevel;
  /** Log message content */
  message: string;
  /** Timestamp when the log was created */
  timestamp: Date;
  /** Name of the MCP server that generated the log */
  serverName: string;
  /** Optional additional details */
  details?: Record<string, any>;
  requestContext?: RequestContext | null;
}

/**
 * Handler function for processing log messages from MCP servers.
 */
export type LogHandler = (logMessage: LogMessage) => void;

/**
 * Handler function for processing elicitation requests from MCP servers.
 *
 * @param request - The elicitation request parameters including message and schema
 * @returns Promise resolving to the user's response (accept/decline/cancel with optional content)
 */
export type ElicitationHandler = (request: ElicitRequest['params']) => Promise<ElicitResult>;

/**
 * Handler function for processing progress notifications from MCP servers.
 *
 * @param params - The progress notification parameters including message and status
 */
export type ProgressHandler = (params: ProgressNotification['params']) => void;

/**
 * Base options common to all MCP server definitions.
 */
export type BaseServerOptions = {
  /** Optional handler for server log messages */
  logger?: LogHandler;
  /** Optional timeout in milliseconds for server operations */
  timeout?: number;
  /** Optional client capabilities to advertise to the server */
  capabilities?: ClientCapabilities;
  /** Whether to enable server log forwarding (default: true) */
  enableServerLogs?: boolean;
  /** Whether to enable progress tracking (default: false) */
  enableProgressTracking?: boolean;
};

/**
 * Configuration for MCP servers using stdio (subprocess) transport.
 *
 * Used when the MCP server is spawned as a subprocess that communicates via stdin/stdout.
 */
export type StdioServerDefinition = BaseServerOptions & {
  /** Command to execute (e.g., 'node', 'python', 'npx') */
  command: string;
  /** Optional arguments to pass to the command */
  args?: string[];
  /** Optional environment variables for the subprocess */
  env?: Record<string, string>;

  url?: never;
  requestInit?: never;
  eventSourceInit?: never;
  authProvider?: never;
  reconnectionOptions?: never;
  sessionId?: never;
  connectTimeout?: never;
};

/**
 * Configuration for MCP servers using HTTP-based transport (Streamable HTTP or SSE fallback).
 *
 * Used when connecting to remote MCP servers over HTTP. The client will attempt Streamable HTTP
 * transport first and fall back to SSE if that fails.
 */
export type HttpServerDefinition = BaseServerOptions & {
  /** URL of the MCP server endpoint */
  url: URL;

  command?: never;
  args?: never;
  env?: never;

  /** Optional request configuration for HTTP requests */
  requestInit?: StreamableHTTPClientTransportOptions['requestInit'];
  /** Optional configuration for SSE fallback (required when using custom headers with SSE) */
  eventSourceInit?: SSEClientTransportOptions['eventSourceInit'];
  /** Optional authentication provider for HTTP requests */
  authProvider?: StreamableHTTPClientTransportOptions['authProvider'];
  /** Optional reconnection configuration for Streamable HTTP */
  reconnectionOptions?: StreamableHTTPClientTransportOptions['reconnectionOptions'];
  /** Optional session ID for Streamable HTTP */
  sessionId?: StreamableHTTPClientTransportOptions['sessionId'];
  /** Optional timeout in milliseconds for the connection phase (default: 3000ms).
   * This timeout allows the system to switch MCP streaming protocols during the setup phase.
   * The default is set to 3s because the long default timeout would be extremely slow for SSE backwards compat (60s).
   */
  connectTimeout?: number;
};

/**
 * Configuration for connecting to an MCP server.
 *
 * Either stdio-based (subprocess) or HTTP-based (remote server). The transport type is
 * automatically detected based on whether `command` or `url` is provided.
 *
 * @example
 * ```typescript
 * // Stdio server
 * const stdioServer: MastraMCPServerDefinition = {
 *   command: 'npx',
 *   args: ['tsx', 'server.ts'],
 *   env: { API_KEY: 'secret' }
 * };
 *
 * // HTTP server
 * const httpServer: MastraMCPServerDefinition = {
 *   url: new URL('http://localhost:8080/mcp'),
 *   requestInit: {
 *     headers: { Authorization: 'Bearer token' }
 *   }
 * };
 * ```
 */
export type MastraMCPServerDefinition = StdioServerDefinition | HttpServerDefinition;

/**
 * Options for creating an internal MCP client instance.
 *
 * @internal
 */
export type InternalMastraMCPClientOptions = {
  /** Name identifier for this client */
  name: string;
  /** Server connection configuration */
  server: MastraMCPServerDefinition;
  /** Optional client capabilities */
  capabilities?: ClientCapabilities;
  /** Optional client version */
  version?: string;
  /** Optional timeout in milliseconds */
  timeout?: number;
};

