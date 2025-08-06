import { randomUUID } from 'node:crypto';
import slugify from '@sindresorhus/slugify';
import type { ToolsInput } from '../agent';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type {
  ConvertedTool,
  MCPServerConfig,
  MCPServerHonoSSEOptions,
  MCPServerHTTPOptions,
  MCPServerSSEOptions,
  MCPToolType,
  PackageInfo,
  RemoteInfo,
  Repository,
  ServerDetailInfo,
  ServerInfo,
} from './types';
export * from './types';

/**
 * Abstract base class for MCP server implementations.
 * This provides a common interface and shared functionality for all MCP servers
 * that can be registered with Mastra, including handling of server metadata.
 */
export abstract class MCPServerBase extends MastraBase {
  /** Tracks if the server ID has been definitively set. */
  private idWasSet = false;
  /** The display name of the MCP server. */
  public readonly name: string;
  /** The semantic version of the MCP server. */
  public readonly version: string;
  /** Internal storage for the server's unique ID. */
  private _id: string;
  /** A description of what the MCP server does. */
  public readonly description?: string;
  /** Repository information for the server's source code. */
  public readonly repository?: Repository;
  /** The release date of this server version (ISO 8601 string). */
  public readonly releaseDate: string;
  /** Indicates if this version is the latest available. */
  public readonly isLatest: boolean;
  /** The canonical packaging format (e.g., "npm", "docker"), if applicable. */
  public readonly packageCanonical?: MCPServerConfig['packageCanonical'];
  /** Information about installable packages for this server. */
  public readonly packages?: PackageInfo[];
  /** Information about remote access points for this server. */
  public readonly remotes?: RemoteInfo[];
  /** The tools registered with and converted by this MCP server. */
  public readonly convertedTools: Record<string, ConvertedTool>;
  /** Reference to the Mastra instance if this server is registered with one. */
  public mastra: Mastra | undefined;
  /** Agents to be exposed as tools. */
  protected readonly agents?: MCPServerConfig['agents'];
  /** Workflows to be exposed as tools. */
  protected readonly workflows?: MCPServerConfig['workflows'];

  /**
   * Public getter for the server's unique ID.
   * The ID is set at construction or by Mastra and is read-only afterwards.
   */
  public get id(): string {
    return this._id;
  }

  /**
   * Gets a read-only view of the registered tools.
   * @returns A readonly record of converted tools.
   */
  tools(): Readonly<Record<string, ConvertedTool>> {
    return this.convertedTools;
  }

  /**
   * Sets the server's unique ID. This method is typically called by Mastra when
   * registering the server, using the key provided in the Mastra configuration.
   * It ensures the ID is set only once.
   * If an ID was already provided in the MCPServerConfig, this method will be a no-op.
   * @param id The unique ID to assign to the server.
   */
  setId(id: string) {
    if (this.idWasSet) {
      return;
    }
    this._id = id;
    this.idWasSet = true;
  }

  /**
   * Abstract method to convert and validate tool definitions provided to the server.
   * This method will also handle agents passed in the config.
   * @param tools Tool definitions to convert.
   * @param agents Agent definitions to convert to tools.
   * @param workflows Workflow definitions to convert to tools.
   * @returns A record of converted and validated tools.
   */
  public abstract convertTools(
    tools: ToolsInput,
    agents?: MCPServerConfig['agents'],
    workflows?: MCPServerConfig['workflows'],
  ): Record<string, ConvertedTool>;

  /**
   * Internal method used by Mastra to register itself with the server.
   * @param mastra The Mastra instance.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  /**
   * Constructor for the MCPServerBase.
   * @param config Configuration options for the MCP server, including metadata.
   */
  constructor(config: MCPServerConfig) {
    super({ component: RegisteredLogger.MCP_SERVER, name: config.name });
    this.name = config.name;
    this.version = config.version;

    // If user does not provide an ID, we will use the key from the Mastra config, but if user does not pass MCPServer
    // to Mastra, we will generate a random UUID as a backup.
    if (config.id) {
      this._id = slugify(config.id);
      this.idWasSet = true;
    } else {
      this._id = this.mastra?.generateId() || randomUUID();
    }

    this.description = config.description;
    this.repository = config.repository;
    this.releaseDate = config.releaseDate || new Date().toISOString();
    this.isLatest = config.isLatest === undefined ? true : config.isLatest;
    this.packageCanonical = config.packageCanonical;
    this.packages = config.packages;
    this.remotes = config.remotes;
    this.agents = config.agents;
    this.workflows = config.workflows;
    this.convertedTools = this.convertTools(config.tools, config.agents, config.workflows);
  }

  /**
   * Start the MCP server using stdio transport
   * This is typically used for Windsurf integration
   */
  public abstract startStdio(): Promise<void>;

  /**
   * Start the MCP server using SSE transport
   * This is typically used for web integration
   * @param options Options for the SSE transport
   */
  public abstract startSSE(options: MCPServerSSEOptions): Promise<void>;

  /**
   * Start the MCP server using Hono SSE transport
   * Used for Hono servers
   * @param options Options for the SSE transport
   */
  public abstract startHonoSSE(options: MCPServerHonoSSEOptions): Promise<Response | undefined>;

  /**
   * Start the MCP server using HTTP transport
   * @param options Options for the HTTP transport
   */
  public abstract startHTTP(options: MCPServerHTTPOptions): Promise<void>;

  /**
   * Close the MCP server and all its connections
   */
  public abstract close(): Promise<void>;

  /**
   * Gets the basic information about the server, conforming to the MCP Registry 'Server' schema.
   * This information is suitable for listing multiple servers.
   * @returns ServerInfo object containing basic server metadata.
   */
  public abstract getServerInfo(): ServerInfo;

  /**
   * Gets detailed information about the server, conforming to the MCP Registry 'ServerDetail' schema.
   * This includes all information from `getServerInfo` plus package and remote details.
   * @returns ServerDetailInfo object containing comprehensive server metadata.
   */
  public abstract getServerDetail(): ServerDetailInfo;

  /**
   * Gets a list of tools provided by this MCP server, including their schemas.
   * @returns An object containing an array of tool information.
   */
  public abstract getToolListInfo(): {
    tools: Array<{ name: string; description?: string; inputSchema: any; outputSchema?: any; toolType?: MCPToolType }>;
  };

  /**
   * Gets information for a specific tool provided by this MCP server.
   * @param toolId The ID/name of the tool to retrieve.
   * @returns Tool information (name, description, inputSchema) or undefined if not found.
   */
  public abstract getToolInfo(
    toolId: string,
  ): { name: string; description?: string; inputSchema: any; outputSchema?: any; toolType?: MCPToolType } | undefined;

  /**
   * Executes a specific tool provided by this MCP server.
   * @param toolId The ID/name of the tool to execute.
   * @param args The arguments to pass to the tool's execute function.
   * @param executionContext Optional context for the tool execution (e.g., messages, toolCallId).
   * @returns A promise that resolves to the result of the tool execution.
   * @throws Error if the tool is not found, or if execution fails.
   */
  public abstract executeTool(
    toolId: string,
    args: any,
    executionContext?: { messages?: any[]; toolCallId?: string },
  ): Promise<any>;
}
