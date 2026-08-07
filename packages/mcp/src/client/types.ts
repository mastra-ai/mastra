import type { IOType } from 'node:child_process';
import type { RequestContext } from '@mastra/core/di';
import type {
  SSEClientTransportOptions,
  StreamableHTTPClientTransportOptions,
  ClientCapabilities,
  ElicitRequest,
  ElicitResult,
  LoggingLevel,
  ProgressNotification,
  ToolAnnotations,
  jsonSchemaValidator,
} from '@modelcontextprotocol/client';

// FetchLike is used internally when wrapping MastraFetchLike for transport compatibility
export type { FetchLike } from '@modelcontextprotocol/client';
// Re-export so consumers of @mastra/mcp can type their requireToolApproval callbacks
// without having to add @modelcontextprotocol/client as a direct dependency.
export type { ToolAnnotations } from '@modelcontextprotocol/client';
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

// Re-export the MCP LoggingLevel for convenience
export type { LoggingLevel } from '@modelcontextprotocol/client';

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
  /**
   * Tool annotations advertised by the MCP server in `tools/list` (title,
   * readOnlyHint, destructiveHint, idempotentHint, openWorldHint).
   *
   * Use these to drive declarative, server-agnostic approval policies
   * instead of hardcoding tool name lists.
   *
   * SECURITY (per MCP spec): annotations are **hints**, not guarantees.
   * Clients MUST consider them untrusted unless they come from a trusted
   * server. Do not use annotations alone as a security boundary — gate
   * dangerous behaviour with `requireToolApproval: true` (or a server-name
   * allowlist) for any server you do not control.
   *
   * Spec defaults when a hint is omitted: `readOnlyHint: false`,
   * `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`.
   * This field is `undefined` (not auto-defaulted) when the server omits
   * annotations entirely, so policies can distinguish "no annotations" from
   * "annotated as safe".
   *
   * @see https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-annotations
   */
  annotations?: ToolAnnotations;
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
   * Whether instructions returned by this MCP server during initialization should
   * be forwarded to agents that use the server's tools.
   *
   * Disabled by default: forwarded instructions are injected into the agent's
   * system prompt, so only enable this for servers you trust.
   *
   * @default false
   */
  forwardInstructions?: boolean;
  /**
   * Maximum number of characters of this server's instructions to forward into
   * an agent system prompt.
   *
   * @default 512
   */
  instructionsMaxLength?: number;
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
   *
   * // Declarative, server-agnostic approval driven by MCP tool annotations.
   * // NOTE: only sound for trusted servers — annotations are hints, not
   * // guarantees, per the MCP spec.
   * requireToolApproval: ({ annotations }) => {
   *   // No annotations? Assume the worst (spec default: destructive).
   *   if (!annotations) return true;
   *   if (annotations.readOnlyHint) return false;
   *   if (annotations.destructiveHint) return true;
   *   return false;
   * }
   * ```
   */
  requireToolApproval?: RequireToolApproval;
  /**
   * How to handle MCP tool *execution* failures, which a spec-compliant server
   * reports in-band by returning a normal `CallToolResult` with `isError: true`
   * and the failure details in `content`.
   *
   * - `'throw'` (default): surface the failure on Mastra's failed-tool-call path
   *   by throwing a `MastraError` that carries the server's `content` text. Tool
   *   spans, stream chunks, scorers, and persisted message parts then reflect the
   *   failure, and the model sees the error text so it can self-correct.
   * - `'return'`: preserve the legacy behaviour and resolve successfully with the
   *   raw result (or `structuredContent`), ignoring `isError`.
   *
   * @default 'throw'
   */
  onToolError?: 'throw' | 'return';
  /**
   * Optional custom JSON Schema validator forwarded to the underlying MCP
   * client. Use this to opt into a non-default validator implementation.
   *
   * Pass `CfWorkerJsonSchemaValidator` (from
   * `@modelcontextprotocol/client/validators/cf-worker`) when running in
   * Cloudflare Workers / V8 isolates: the default `AjvJsonSchemaValidator`
   * compiles validators with `new Function(...)`, which workerd refuses to
   * evaluate when a tool advertises an `outputSchema`.
   *
   * @example
   * ```typescript
   * import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/client/validators/cf-worker';
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
  /**
   * Opt-in MCP protocol version negotiation.
   *
   * - Omitted (default): the plain legacy (2025-era) connect sequence,
   *   byte-identical to a client without this option.
   * - `'auto'`: probe the server with `server/discover` at connect time and use
   *   the stateless `2026-07-28` revision when the server supports it, with a
   *   conservative fallback to the legacy `initialize` handshake.
   * - `'2026-07-28'`: pin to that revision exactly. Connecting to a server that
   *   does not offer it fails loudly with a typed error — no fallback.
   *
   * Note: elicitation handlers currently only fire on legacy connections; on a
   * negotiated `2026-07-28` connection, server-side input requests use the
   * multi-round-trip mechanism, which this client does not drive yet.
   *
   * @example
   * ```typescript
   * const mcp = new MCPClient({
   *   servers: {
   *     weather: {
   *       url: new URL('https://example/mcp'),
   *       protocolVersion: 'auto',
   *     },
   *   },
   * });
   * ```
   */
  protocolVersion?: 'auto' | '2026-07-28';
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
   * Whether the subprocess environment starts from the MCP SDK's default
   * inherited environment. Defaults to `true`.
   *
   * The default is NOT the full `process.env`: the SDK's
   * `getDefaultEnvironment()` inherits only a curated platform whitelist —
   * on POSIX: `HOME`, `LOGNAME`, `PATH`, `SHELL`, `TERM`, `USER`; on Windows:
   * `APPDATA`, `HOMEDRIVE`, `HOMEPATH`, `LOCALAPPDATA`, `PATH`,
   * `PROCESSOR_ARCHITECTURE`, `SYSTEMDRIVE`, `SYSTEMROOT`, `TEMP`, `USERNAME`,
   * `USERPROFILE` — and skips functions and variables starting with `()`.
   *
   * When `false`, the subprocess environment base is empty (`{}`) and only the
   * variables explicitly listed in `env` are passed to the subprocess. Note
   * that a subprocess without `PATH` may fail to spawn commands that are not
   * absolute paths.
   */
  inheritDefaultEnv?: boolean;
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
  allowedHosts?: never;
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
  inheritDefaultEnv?: never;
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
  /**
   * Optional allowlist of hosts this server's HTTP requests may target.
   *
   * When set, every outgoing request made on behalf of this server (initial
   * connect, Streamable HTTP POSTs, the SSE fallback and its event stream,
   * OAuth discovery/token requests routed through the transport fetch, and
   * every redirect hop) is checked against this list. When unset, no
   * restriction applies (current behavior).
   *
   * Matching semantics:
   * - Entries are host values matched against `URL.host` — the hostname plus
   *   the port when the URL carries a non-default port. WHATWG URL elides
   *   default ports, so `https://x.com:443` has host `x.com` and matches the
   *   entry `'x.com'`, not `'x.com:443'`. Examples: `'api.example.com'`,
   *   `'localhost:8080'`.
   * - Matching is exact and case-insensitive on the hostname. No wildcards.
   * - The URL scheme is NOT checked — matching is host-only, so `http://` and
   *   `https://` URLs to an allowed host both pass. The `Authorization` header
   *   is still dropped on any cross-origin redirect hop (scheme, host, or port
   *   change), so a same-host scheme downgrade never re-sends credentials.
   * - An empty array (`allowedHosts: []`) denies all hosts.
   *
   * Enforcement strength varies by path:
   * - On the default path (no custom `fetch`), requests to disallowed hosts —
   *   including redirect hops, via manual redirect following — are blocked
   *   BEFORE being sent.
   * - When a custom `fetch` (or a caller-supplied `eventSourceInit.fetch`) is
   *   in play, the initial URL is checked before the request, but redirect
   *   hops are validated post-hoc via `response.url`: the outbound hop may
   *   occur, but the response never reaches the caller or the model. A
   *   hand-built `Response` with an empty `response.url` skips the post-hoc
   *   check (documented limitation — custom fetches legitimately construct
   *   such responses).
   *
   * OAuth note: the SDK routes OAuth discovery and token requests through the
   * transport's fetch, so when using an `authProvider` whose authorization
   * server lives on a different host, that host must also be allowlisted.
   */
  allowedHosts?: string[];
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

/**
 * A fully serializable description of a single tool advertised by an MCP server.
 *
 * This is the data returned by the MCP `tools/list` response, plus the server metadata needed
 * to reconstruct the tool faithfully. It contains no functions, class instances or references
 * to a live client, so it survives `JSON.stringify` and can be cached in Redis, a database, or
 * a build artifact and reused by other processes.
 *
 * Obtain these via {@link MCPClient.listToolDefinitions} and turn them back into executable
 * tools with {@link MCPClient.toolFromDefinition}.
 */
export type SerializableMCPToolDefinition = {
  /** Tool name as advertised by the server, without any server namespace prefix. */
  name: string;
  /** Human readable description from the server, if it supplied one. */
  description?: string;
  /** Raw JSON Schema for the tool's arguments, exactly as sent by the server. */
  inputSchema: unknown;
  /** Raw JSON Schema for the tool's structured output, if the server declared one. */
  outputSchema?: unknown;
  /** Server-advertised annotations (title, readOnlyHint, destructiveHint, ...). */
  annotations?: ToolAnnotations;
  /** Server-supplied `_meta`, including `ui.resourceUri` for MCP Apps. */
  _meta?: Record<string, unknown>;
  /**
   * Metadata about the server that advertised this tool.
   *
   * Captured at discovery time because it is otherwise only available from a live connection.
   * Without it, hydrating a tool would silently drop the server version and instructions that
   * a normally discovered tool carries.
   */
  server: {
    /** The name this server is configured under. */
    name: string;
    /** Server version reported during the MCP handshake, if any. */
    version?: string;
    /** Instructions the server returned during initialization, if any. */
    instructions?: string;
  };
};

/**
 * A serializable catalog of MCP tool definitions, keyed by server name and then tool name.
 *
 * This is the shape returned by {@link MCPClient.listToolDefinitions}.
 */
export type SerializableMCPToolCatalog = Record<string, Record<string, SerializableMCPToolDefinition>>;
