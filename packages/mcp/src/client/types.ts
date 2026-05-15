import type { IOType } from 'node:child_process';
import type { RequestContext } from '@mastra/core/di';
import type { SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse.js';
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// FetchLike is used internally when wrapping MastraFetchLike for transport compatibility
export type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  ClientCapabilities,
  ElicitRequest,
  ElicitResult,
  LoggingLevel,
  ProgressNotification,
} from '@modelcontextprotocol/sdk/types.js';
import type { jsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/types.js';

/**
 * Extended fetch function type that receives the current request context as a third argument.
 *
 * This allows custom fetch implementations to access request-scoped data (e.g., authentication
 * cookies, bearer tokens) from the incoming request and forward them to the MCP server.
 *
 * The `requestContext` parameter is `null` when no context is available (e.g., during
 * initial connection or when a tool is called without a request context).
 *
 * @example
 * ```typescript
 * const mcp = new MCPClient({
 *   servers: {
 *     myServer: {
 *       url: new URL('https://api.example.com/mcp'),
 *       fetch: (url, init, requestContext) => {
 *         const headers = new Headers(init?.headers);
 *         const cookie = requestContext?.get('cookie');
 *         if (cookie) {
 *           headers.set('cookie', cookie);
 *         }
 *         return fetch(url, { ...init, headers });
 *       },
 *     },
 *   },
 * });
 * ```
 */
export type MastraFetchLike = (
  url: string | URL,
  init?: RequestInit,
  requestContext?: RequestContext | null,
) => Promise<Response>;

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
 * Represents a filesystem root that the client exposes to MCP servers.
 *
 * Per MCP spec (https://modelcontextprotocol.io/specification/2025-11-25/client/roots):
 * Roots define the boundaries of where servers can operate within the filesystem,
 * allowing them to understand which directories and files they have access to.
 *
 * @example
 * ```typescript
 * const root: Root = {
 *   uri: 'file:///home/user/projects/myproject',
 *   name: 'My Project'
 * };
 * ```
 */
export interface Root {
  /** Unique identifier for the root. Must be a file:// URI. */
  uri: string;
  /** Optional human-readable name for display purposes. */
  name?: string;
}

/**
 * Context passed to `requireToolApproval` when it's a function.
 * Provides information about the tool call and the current execution environment.
 */
export interface RequireToolApprovalContext {
  /** Name of the tool being called */
  toolName: string;
  /** Arguments the LLM is passing to the tool */
  args: Record<string, unknown>;
  /** Request-scoped context (e.g., user info, auth data) as a plain object */
  requestContext?: Record<string, unknown>;
}

/**
 * Function type for dynamic tool approval logic.
 * Return `true` to require approval, `false` to allow execution.
 */
export type RequireToolApprovalFn = (ctx: RequireToolApprovalContext) => boolean | Promise<boolean>;

/**
 * Whether tools from this server require explicit user approval before execution.
 *
 * - `true`: All tools from this server require approval.
 * - `false` or omitted: No approval required (default).
 * - Function: Called per tool invocation to dynamically decide.
 */
export type RequireToolApproval = boolean | RequireToolApprovalFn;

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
  /**
   * Whether tools from this server require explicit user approval before execution.
   *
   * - `true`: All tools require approval before running.
   * - `false` or omitted: Tools run without approval (default).
   * - Function: Called per tool invocation with context to dynamically decide.
   *
   * @example
   * ```typescript
   * // Require approval for all tools
   * requireToolApproval: true
   *
   * // Dynamic approval based on tool name or args
   * requireToolApproval: ({ toolName, args }) => {
   *   if (toolName === 'list_repos') return false;
   *   if (toolName === 'delete_repo') return true;
   *   return false;
   * }
   * ```
   */
  requireToolApproval?: RequireToolApproval;
  /**
   * Optional custom JSON Schema validator forwarded to the underlying MCP SDK
   * client. Use this to opt into a non-default validator implementation.
   *
   * Pass `CfWorkerJsonSchemaValidator` (from
   * `@modelcontextprotocol/sdk/validation/cfworker`) when running in
   * Cloudflare Workers / V8 isolates: the default `AjvJsonSchemaValidator`
   * compiles validators with `new Function(...)`, which workerd refuses to
   * evaluate when a tool advertises an `outputSchema`.
   *
   * @example
   * ```typescript
   * import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';
   *
   * const mcp = new MCPClient({
   *   servers: {
   *     upstream: {
   *       url: new URL('https://example/mcp'),
   *       jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
   *     },
   *   },
   * });
   * ```
   */
  jsonSchemaValidator?: jsonSchemaValidator;
  /**
   * List of filesystem roots to expose to the MCP server.
   *
   * Per MCP spec (https://modelcontextprotocol.io/specification/2025-11-25/client/roots):
   * Roots define the boundaries of where servers can operate within the filesystem.
   *
   * When configured, the client will:
   * 1. Automatically advertise the `roots` capability to the server
   * 2. Respond to `roots/list` requests with these roots
   * 3. Send `notifications/roots/list_changed` when roots are updated via `setRoots()`
   *
   * @example
   * ```typescript
   * {
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
   *   roots: [
   *     { uri: 'file:///tmp', name: 'Temp Directory' }
   *   ]
   * }
   * ```
   */
  roots?: Root[];
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
  /**
   * How to handle stderr of the child process. Matches the semantics of Node's `child_process.spawn`.
   *
   * - `"inherit"` (default): stderr is printed to the parent process's stderr
   * - `"pipe"`: stderr is captured and available via `StdioClientTransport.stderr`
   * - `"ignore"`: stderr is discarded
   */
  stderr?: IOType;
  /**
   * The working directory to use when spawning the subprocess.
   *
   * If not specified, the current working directory will be inherited.
   */
  cwd?: string;

  url?: never;
  requestInit?: never;
  eventSourceInit?: never;
  authProvider?: never;
  reconnectionOptions?: never;
  sessionId?: never;
  connectTimeout?: never;
  fetch?: never;
};

/**
 * Configuration for MCP servers using HTTP-based transport (Streamable HTTP or SSE fallback).
 *
 * Used when connecting to remote MCP servers over HTTP. The client will attempt Streamable HTTP
 * transport first and fall back to SSE if that fails.
 *
 * When `fetch` is provided, all other HTTP-related options (`requestInit`, `eventSourceInit`, `authProvider`)
 * become optional, as the custom fetch function can handle authentication and request customization.
 */
export type HttpServerDefinition = BaseServerOptions & {
  /** URL of the MCP server endpoint */
  url: URL;

  command?: never;
  args?: never;
  env?: never;
  stderr?: never;
  cwd?: never;

  /**
   * Custom fetch implementation used for all network requests.
   *
   * When provided, this function will be used for all HTTP requests, allowing you to:
   * - Add dynamic authentication headers (e.g., refreshing bearer tokens)
   * - Forward request-scoped data (cookies, tokens) from the incoming request to the MCP server
   * - Customize request behavior per-request
   * - Intercept and modify requests/responses
   *
   * The third `requestContext` parameter provides access to request-scoped data set by middleware
   * or passed during agent/tool execution. It is `null` when no context is available (e.g.,
   * during the initial connection handshake).
   *
   * When `fetch` is provided, `requestInit`, `eventSourceInit`, and `authProvider` become optional,
   * as you can handle these concerns within your custom fetch function.
   *
   * @example
   * ```typescript
   * {
   *   url: new URL('https://api.example.com/mcp'),
   *   fetch: async (url, init, requestContext) => {
   *     const headers = new Headers(init?.headers);
   *     // Forward auth cookie from the incoming request
   *     const cookie = requestContext?.get('cookie');
   *     if (cookie) {
   *       headers.set('cookie', cookie);
   *     }
   *     return fetch(url, { ...init, headers });
   *   },
   * }
   * ```
   */
  fetch?: MastraFetchLike;
  /** Optional request configuration for HTTP requests (optional when `fetch` is provided) */
  requestInit?: StreamableHTTPClientTransportOptions['requestInit'];
  /** Optional configuration for SSE fallback (required when using custom headers with SSE, optional when `fetch` is provided) */
  eventSourceInit?: SSEClientTransportOptions['eventSourceInit'];
  /** Optional authentication provider for HTTP requests (optional when `fetch` is provided) */
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
 * // HTTP server with static headers
 * const httpServer: MastraMCPServerDefinition = {
 *   url: new URL('http://localhost:8080/mcp'),
 *   requestInit: {
 *     headers: { Authorization: 'Bearer token' }
 *   }
 * };
 *
 * // HTTP server with custom fetch for dynamic auth
 * const httpServerWithFetch: MastraMCPServerDefinition = {
 *   url: new URL('http://localhost:8080/mcp'),
 *   fetch: async (url, init) => {
 *     const token = await getAuthToken(); // Refresh token on each request
 *     return fetch(url, {
 *       ...init,
 *       headers: {
 *         ...init?.headers,
 *         Authorization: `Bearer ${token}`,
 *       },
 *     });
 *   },
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
  /** Optional client capabilities to advertise to the server */
  capabilities?: ClientCapabilities;
  /** Optional client version */
  version?: string;
  /** Optional timeout in milliseconds */
  timeout?: number;
};
