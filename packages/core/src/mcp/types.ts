import type * as http from 'node:http';
import type { JSONSchema7 } from 'json-schema';
import type { ToolsInput, Agent } from '../agent';
import type { MastraFGAPermissionInput } from '../auth/ee/interfaces/permissions.generated';
import type { RequestContext } from '../request-context';
import type { Workflow } from '../workflows';

export interface HonoContextLike {
  req: {
    header(name: string): string | undefined;
    query(name: string): string | undefined;
    json(): Promise<unknown>;
  };
  text(text: string, status?: number, headers?: Record<string, string>): Response;
}

interface MCPServerSSEOptionsBase {
  /**
   * Parsed URL of the incoming request
   */
  url: URL;

  /**
   * Path for establishing the SSE connection (e.g. '/sse')
   */
  ssePath: string;

  /**
   * Path for POSTing client messages (e.g. '/message')
   */
  messagePath: string;
}

/**
 * Options for starting an MCP server with SSE transport
 * @deprecated The standalone HTTP+SSE transport only exists in `@mastra/mcp` 1.x; removed in the next core major.
 */
export interface MCPServerSSEOptions extends MCPServerSSEOptionsBase {
  /**
   * Incoming HTTP request
   */
  req: http.IncomingMessage;

  /**
   * HTTP response (must support .write/.end)
   */
  res: http.ServerResponse<http.IncomingMessage>;
}

/**
 * Options for starting an MCP server with Hono SSE transport
 * @deprecated The standalone HTTP+SSE transport only exists in `@mastra/mcp` 1.x; removed in the next core major.
 */
export interface MCPServerHonoSSEOptions extends MCPServerSSEOptionsBase {
  /**
   * Incoming Hono context
   */
  context: HonoContextLike;

  /**
   * Auth info for this request, surfaced to tool and agent execution as
   * `extra.authInfo`. Streamable HTTP carries this on `req.auth`; the Hono SSE
   * transport has no Node request, so adapters pass it explicitly.
   */
  authInfo?: unknown;
}

export interface MCPServerHTTPOptions {
  /**
   * Parsed URL of the incoming request
   */
  url: URL;

  /**
   * Path for establishing the HTTP connection (e.g. '/mcp')
   */
  httpPath: string;

  /**
   * Incoming HTTP request
   */
  req: http.IncomingMessage;

  /**
   * HTTP response (must support .write/.end)
   */
  res: http.ServerResponse<http.IncomingMessage>;

  /**
   * Optional options to pass to the transport (e.g. sessionIdGenerator)
   * @deprecated Only `@mastra/mcp` 1.x reads this; MCP 2026-07-28 has no sessions. Removed in the next core major.
   */
  options?: any; // Consider typing StreamableHTTPServerTransportOptions from @modelcontextprotocol/node if possible
}

// +++ MCP Registry API Spec Types +++
/** Describes a source code repository. */
export interface Repository {
  /** The URL of the repository (e.g., a GitHub URL). */
  url: string;
  /** The source control platform (e.g., 'github', 'gitlab'). */
  source: 'github' | 'gitlab' | string;
  /** A unique identifier for the repository at the source. */
  id: string;
}

/** Provides details about a specific version of an MCP server. */
export interface VersionDetail {
  /** The semantic version string (e.g., "1.0.2"). */
  version: string;
  /** The ISO 8601 date-time string when this version was released or registered. */
  release_date: string;
  /** Indicates if this version is the latest available. */
  is_latest: boolean;
}

/** Base interface for command-line arguments. */
export interface ArgumentInfo {
  /** The name of the argument. */
  name: string;
  /** A description of what the argument is for. */
  description: string;
  /** Whether the argument is required. */
  is_required: boolean;
  /** Whether the argument can be specified multiple times. */
  is_repeatable?: boolean;
  /** Whether the argument's value can be edited by the user (e.g., in a UI). */
  is_editable?: boolean;
  /** A list of predefined choices for the argument's value. */
  choices?: string[];
  /** The default value for the argument if not specified. */
  default_value?: string | number | boolean;
}

/** Describes a positional argument for a command. */
export interface PositionalArgumentInfo extends ArgumentInfo {
  /** The 0-indexed position of the argument. */
  position: number;
}

/** Describes a named argument (flag) for a command. */
export interface NamedArgumentInfo extends ArgumentInfo {
  /** The short flag for the argument (e.g., "-y"). */
  short_flag?: string;
  /** The long flag for the argument (e.g., "--yes"). */
  long_flag?: string;
  /** Whether the flag requires a value (e.g., `--config <value>`) or is a boolean flag. */
  requires_value?: boolean;
}

/** Describes a subcommand for a command-line tool. */
export interface SubcommandInfo {
  /** The name of the subcommand (e.g., "run", "list"). */
  name: string;
  /** A description of what the subcommand does. */
  description: string;
  /** Whether this subcommand is required if its parent command is used. */
  is_required?: boolean;
  /** Nested subcommands. */
  subcommands?: SubcommandInfo[];
  /** Positional arguments for this subcommand. */
  positional_arguments?: PositionalArgumentInfo[];
  /** Named arguments (flags) for this subcommand. */
  named_arguments?: NamedArgumentInfo[];
}

/** Describes a command to run an MCP server package. */
export interface CommandInfo {
  /** The primary command executable (e.g., "npx", "docker"). */
  name: 'npx' | 'docker' | 'pypi' | 'uvx' | string;
  /** Subcommands to append to the primary command. */
  subcommands?: SubcommandInfo[];
  /** Positional arguments for the command. */
  positional_arguments?: PositionalArgumentInfo[];
  /** Named arguments (flags) for the command. */
  named_arguments?: NamedArgumentInfo[];
}

/** Describes an environment variable required or used by an MCP server package. */
export interface EnvironmentVariableInfo {
  /** The name of the environment variable (e.g., "API_KEY"). */
  name: string;
  /** A description of what the environment variable is for. */
  description: string;
  /** Whether the environment variable is required. */
  required?: boolean;
  /** The default value for the environment variable if not set. */
  default_value?: string;
}

/** Describes an installable package for an MCP server. */
export interface PackageInfo {
  /** The name of the package registry (e.g., "npm", "docker"). */
  registry_name: 'npm' | 'docker' | 'pypi' | 'homebrew' | string;
  /** The name of the package. */
  name: string;
  /** The version of the package. */
  version: string;
  /** The command structure to run this package as an MCP server. */
  command?: CommandInfo;
  /** Environment variables relevant to this package. */
  environment_variables?: EnvironmentVariableInfo[];
}

/** Describes a remote endpoint for accessing an MCP server. */
export interface RemoteInfo {
  /** The transport type for the remote connection (e.g., "sse", "streamable"). */
  transport_type: 'streamable' | 'sse' | string;
  /** The URL of the remote endpoint. */
  url: string;
}

export type MCPAuthInfoToUserMapper<TUser = unknown> = (args: {
  /**
   * Authentication data provided by the MCP SDK request handler `extra.authInfo`.
   */
  authInfo: unknown;
  /**
   * Full MCP SDK request handler extra object when available.
   */
  extra: Record<string, unknown>;
  /**
   * RequestContext that will be used for the MCP tool list or execution.
   * The mapper may read or set additional request-scoped values on it.
   */
  requestContext: RequestContext;
}) => TUser | null | undefined | Promise<TUser | null | undefined>;

export interface MCPServerFGAResourceMappingEntry {
  /** The FGA resource type to authorize MCP tool checks against. */
  fgaResourceType: string;
  /**
   * Derive the FGA resource ID from the MCP request/user context.
   * Return `undefined` to fall back to the MCP tool resource ID.
   */
  deriveId?: (ctx: { user: unknown; resourceId?: string; requestContext?: RequestContext }) => string | undefined;
}

export type MCPServerFGAPermissionMapping = Partial<Record<MastraFGAPermissionInput, string>> & Record<string, string>;

export interface MCPServerFGAConfig {
  /**
   * Map MCP server tool authorization resources independently from the Mastra
   * instance's global `tool` resource mapping.
   */
  resourceMapping?: Partial<Record<'tool' | 'tools', MCPServerFGAResourceMappingEntry>>;
  /**
   * Map MCP server tool authorization permissions independently from the Mastra
   * instance's global permission mapping.
   */
  permissionMapping?: MCPServerFGAPermissionMapping;
}

/** An icon an MCP client can display for a server (the MCP `Icon` type). */
export interface MCPServerIcon {
  /** URI of the icon: an `https:` URL or a `data:` URI. */
  src: string;
  /** Optional MIME type, such as `image/png` or `image/svg+xml`. */
  mimeType?: string;
  /** Optional sizes the icon is available in, such as `['48x48']` or `['any']` for scalable formats. */
  sizes?: string[];
  /** Optional theme the icon is designed for. */
  theme?: 'light' | 'dark';
}

// +++ Authoritative MCPServerConfig +++
/** Configuration options for creating an MCPServer instance. */
export interface MCPServerConfig<TId extends string = string> {
  /** The display name of the MCP server. */
  name: string;
  /** The semantic version of the MCP server. */
  version: string;
  /** The tools that this MCP server will expose. */
  tools: ToolsInput;
  /**
   * Optional Agent instances to be exposed as tools.
   * Each agent will be converted into a tool named 'ask_<agentName>'.
   */
  agents?: Record<string, Agent>;
  /**
   * Optional Workflow instances to be exposed as tools.
   * Each workflow will be converted into a tool named 'run_<workflowKey>'.
   */
  workflows?: Record<string, Workflow>;
  /**
   * Optional unique identifier for the server.
   * If not provided, a UUID will be generated.
   * If provided, this ID is considered final and cannot be changed by Mastra.
   */
  id?: TId;
  /** Optional description of the MCP server. */
  description?: string;
  /** Optional human-readable display title, announced to MCP clients. Clients fall back to `name` when absent. */
  title?: string;
  /** Optional URL of the server's website, announced to MCP clients. */
  websiteUrl?: string;
  /** Optional icons clients can display for the server, announced to MCP clients. */
  icons?: MCPServerIcon[];
  /** Optional instructions describing how to use the server and its features. */
  instructions?: string;
  /**
   * Maps MCP transport auth information into the user object used by Mastra FGA.
   *
   * Self-hosted OAuth MCP transports pass authenticated identity to request
   * handlers as `extra.authInfo`; Mastra FGA checks read the authenticated user
   * from `requestContext.get('user')`. Provide this hook when the MCP server is
   * registered on an FGA-enabled Mastra instance and the transport does not
   * already put a `user` value in the request context.
   */
  mapAuthInfoToUser?: MCPAuthInfoToUserMapper;
  /**
   * Optional FGA mapping overrides for this MCP server's `tools/list` and
   * `tools/call` checks. These mappings are applied before delegating to the
   * Mastra instance FGA provider and do not affect internal agent/workflow tool
   * execution.
   */
  fga?: MCPServerFGAConfig;
  /** Optional repository information for the server's source code. */
  repository?: Repository;
  /**
   * Optional release date of this server version (ISO 8601 string).
   * Defaults to the time of instantiation if not provided.
   */
  releaseDate?: string;
  /**
   * Optional flag indicating if this is the latest version.
   * Defaults to true if not provided.
   */
  isLatest?: boolean;
  /**
   * Optional canonical packaging format if the server is distributed as a package
   * (e.g., "npm", "docker").
   */
  packageCanonical?: 'npm' | 'docker' | 'pypi' | 'crates' | string;
  /** Optional list of installable packages for this server. */
  packages?: PackageInfo[];
  /** Optional list of remote access points for this server. */
  remotes?: RemoteInfo[];
}

// +++ Server Information Structures for return types +++
/** Basic information about an MCP server, conforming to the MCP Registry 'Server' schema. */
export interface ServerInfo {
  /** The unique ID of the server. */
  id: string;
  /** The name of the server. */
  name: string;
  /** A description of the server. */
  description?: string;
  /** Repository information for the server. */
  repository?: Repository;
  /** Detailed version information. */
  version_detail: VersionDetail;
}

/** Detailed information about an MCP server, conforming to the MCP Registry 'ServerDetail' schema. */
export interface ServerDetailInfo extends ServerInfo {
  /** The canonical packaging format, if applicable. */
  package_canonical?: MCPServerConfig['packageCanonical'];
  /** Information about installable packages for this server. */
  packages?: PackageInfo[];
  /** Information about remote access points for this server. */
  remotes?: RemoteInfo[];
}

/**
 * What `executeTool` resolves to on a server with `mcpVersion === 2`. A tool that
 * calls `context.suspend(payload)` is reported as `suspended` together with the
 * payload and its `resumeSchema` (as JSON Schema) so the caller can ask for
 * exactly that input; otherwise the tool's output is returned as `completed`. There is
 * no failure variant: a tool that throws, or input/resume data that fails the declared
 * schemas, rejects the `executeTool` promise instead (core reports schema failures as a
 * `ValidationError` output, which a 2.x server must not pass through as `completed`).
 */
export type MCPToolExecutionResultV2 =
  | { status: 'completed'; output: unknown }
  | { status: 'suspended'; suspendPayload: unknown; resumeSchema?: JSONSchema7 };

/**
 * How a client can receive an MCP server event type.
 * @experimental
 */
export type MCPServerEventDeliveryMode = 'push' | 'poll' | 'webhook';

/**
 * An event type a server declares, as shown in Studio. Mirrors the `events/list`
 * descriptor plus `emittable`.
 * @experimental
 */
export interface MCPServerEventInfo {
  name: string;
  description?: string;
  delivery: MCPServerEventDeliveryMode[];
  inputSchema?: Record<string, unknown>;
  payloadSchema?: Record<string, unknown>;
  /** Fed by `server.events.emit()` rather than a `poll` source. */
  emittable: boolean;
}

/** @experimental */
export interface MCPServerEventOccurrenceInfo {
  eventId: string;
  name: string;
  timestamp: string;
  data: Record<string, unknown>;
  cursor?: string | null;
  _meta?: Record<string, unknown>;
}

/** @experimental */
export interface MCPServerEventPollInfo {
  events: MCPServerEventOccurrenceInfo[];
  cursor: string | null;
  hasMore?: boolean;
  truncated?: boolean;
  nextPollMs?: number;
}

/**
 * A frame of a local event stream. `error` is recoverable and carries a generic message.
 * @experimental
 */
export type MCPServerEventStreamFrame =
  | { type: 'active'; cursor: string | null; truncated: boolean }
  | { type: 'event'; occurrence: MCPServerEventOccurrenceInfo }
  | { type: 'heartbeat'; cursor: string | null }
  | { type: 'error'; message: string }
  | { type: 'terminated' };

/**
 * Error ids an {@link MCPServerEventsInspector} throws as `MastraError`s.
 * @experimental
 */
export const MCP_SERVER_EVENT_ERROR_IDS = {
  unknownEvent: 'MCP_SERVER_UNKNOWN_EVENT',
  unsupportedDelivery: 'MCP_SERVER_EVENT_UNSUPPORTED_DELIVERY',
  invalidArguments: 'MCP_SERVER_EVENT_INVALID_ARGUMENTS',
  forbidden: 'MCP_SERVER_EVENT_FORBIDDEN',
  notEmittable: 'MCP_SERVER_EVENT_NOT_EMITTABLE',
  invalidPayload: 'MCP_SERVER_EVENT_INVALID_PAYLOAD',
  tooManyStreams: 'MCP_SERVER_EVENT_TOO_MANY_STREAMS',
} as const;

/**
 * Runs `events/poll` and `events/stream` in-process, through the same code path as
 * the MCP protocol handlers, and sends test events. Used by Studio.
 * @experimental
 */
export interface MCPServerEventsInspector {
  poll(
    name: string,
    params: { arguments?: Record<string, unknown>; cursor?: string | null; maxEvents?: number },
    options?: { requestContext?: RequestContext; signal?: AbortSignal },
  ): Promise<MCPServerEventPollInfo>;
  /**
   * Validates and opens a stream. Resolves once the `active` frame is queued; `closed`
   * settles when the stream ends (terminated, server closed) or `signal` aborts.
   */
  stream(
    name: string,
    params: { arguments?: Record<string, unknown>; cursor?: string | null },
    options: {
      signal: AbortSignal;
      onFrame: (frame: MCPServerEventStreamFrame) => void;
      requestContext?: RequestContext;
    },
  ): Promise<{ closed: Promise<void> }>;
  /** Emits a test occurrence; its `eventId` is prefixed with `mastra-test-`. */
  emit(name: string, data: Record<string, unknown>): Promise<MCPServerEventOccurrenceInfo>;
}

/**
 * Status of an MCP task (SEP-2663 Tasks extension).
 * @experimental
 */
export type MCPServerTaskStatus = 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled';

/**
 * A tool, workflow or agent this server can run as an MCP task, as shown in Studio.
 * @experimental
 */
export interface MCPServerTaskSurfaceInfo {
  /** The exposed name, e.g. a tool name, `run_<workflow>` or `ask_<agent>`. */
  name: string;
  type: 'tool' | 'workflow' | 'agent';
  /** `always`: every call runs as a task. `auto`: only when the client asks for one. */
  mode: 'auto' | 'always';
  /** Whether an interrupted task is run again after a restart. */
  recover: boolean;
  /** Clients that don't declare the tasks extension are refused for this surface. */
  required: boolean;
  /** How long a task is kept from creation; `null` until the server closes. */
  ttlMs: number | null;
}

/**
 * How a server runs MCP tasks, as shown in Studio.
 * @experimental
 */
export interface MCPServerTasksInfo {
  enabled: boolean;
  /** Whether the task store can list tasks for {@link MCPServerTasksInspector}. */
  listable: boolean;
  surfaces: MCPServerTaskSurfaceInfo[];
}

/**
 * A task as shown in Studio. Never carries the task id or the principal: task ids are
 * bearer tokens and principals can identify users, so only their SHA-256 hashes appear.
 * @experimental
 */
export interface MCPServerTaskSummary {
  /** SHA-256 hash of the task id. Cannot be used on the MCP protocol. */
  taskKey: string;
  /** The exposed name of the tool, workflow or agent the task runs. */
  surface: string;
  status: MCPServerTaskStatus;
  statusMessage?: string;
  createdAt: string;
  lastUpdatedAt: string;
  /** When the task and its result are deleted, if it has a TTL. */
  expiresAt?: string;
  /** SHA-256 hash of the principal that created the task. */
  principalKey: string;
  /** Open input requests, keyed as on the wire. Only while `input_required`. */
  inputRequests?: Record<string, { method: string; params?: Record<string, unknown> }>;
  /** The `CallToolResult` of a completed task. */
  result?: Record<string, unknown>;
  /** The JSON-RPC error of a failed task. */
  error?: Record<string, unknown>;
}

/**
 * Lists, cancels and answers a server's MCP tasks in-process, for Studio. Cancel and answer
 * run through the same task-store code as `tasks/cancel` and `tasks/update`.
 * There is no MCP protocol equivalent of `list`.
 * @experimental
 */
export interface MCPServerTasksInspector {
  /** Most recently created first. */
  list(params?: { limit?: number }): Promise<{ tasks: MCPServerTaskSummary[] }>;
  /** Resolves `false` for an unknown, expired or already finished task. */
  cancel(taskKey: string): Promise<boolean>;
  /** Resolves `false` for an unknown or expired task, or one not waiting for these inputs. */
  answer(taskKey: string, inputResponses: Record<string, Record<string, unknown>>): Promise<boolean>;
}
