import type * as http from 'node:http';
import type { Context } from 'hono';
import type { ToolsInput, Agent } from '../agent';
import type { Workflow } from '../workflows';

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
 */
export interface MCPServerHonoSSEOptions extends MCPServerSSEOptionsBase {
  /**
   * Incoming Hono context
   */
  context: Context;
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
   */
  options?: any; // Consider typing StreamableHTTPServerTransportOptions from @modelcontextprotocol/sdk if possible
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
  /** Optional instructions describing how to use the server and its features. */
  instructions?: string;
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
  /** Whether this server is defined in code or stored via the CMS editor. */
  source?: 'code' | 'stored';
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
