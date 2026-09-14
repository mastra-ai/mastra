import { randomUUID } from 'node:crypto';
import type { JSONSchema7 } from 'json-schema';
import type { ToolsInput } from '../agent';
import { MastraBase } from '../base';
import { MastraError } from '../error';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import type { RequestContext } from '../request-context';
import { standardSchemaToJSONSchema, toStandardSchema } from '../schema';
import type { MCPToolType, ToolAction } from '../tools';
import { createToolObserve } from '../tools/observe';
import { slugify } from '../utils/slugify';
import type { MCPToolExecutionContextV2 } from './request-v2';
import type { MCPServerConfig, MCPServerHTTPOptions, ServerDetailInfo, ServerInfo } from './types';
import type { MCPServerBase } from './index';

export type MCPServerRegistryEntry = MCPServerBase | MCPServerBaseV2;

/**
 * Outcome of running a catalogue tool: it either produced output or suspended
 * for input. `resumeSchema` is the tool's resume schema as JSON Schema so the
 * caller can ask for exactly that input.
 */
export type MCPToolExecutionResultV2 =
  | { status: 'completed'; output: unknown }
  | { status: 'suspended'; suspendPayload: unknown; resumeSchema?: JSONSchema7 };

export interface MCPToolExecutionOptionsV2 extends Partial<ObservabilityContext> {
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
  /**
   * Protocol request facilities plus the previous round's `resumeData` /
   * `suspendPayload` when continuing. The base supplies `suspend` itself and
   * reports a call to it as a `suspended` result. When omitted (for example
   * the Studio/REST execute route) the tool runs with no-op log/progress.
   */
  mcpv2?: Omit<MCPToolExecutionContextV2, 'suspend'>;
}

export interface MCPToolInfoV2 {
  /** Catalogue key the tool is registered and executed under. */
  id: string;
  name: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  toolType?: MCPToolType;
  _meta?: Record<string, unknown>;
}

type ExecutableTool = ToolAction<any, any, any, any, any> & {
  execute: NonNullable<ToolAction<any, any, any, any, any>['execute']>;
};

function isExecutableTool(tool: unknown): tool is ExecutableTool {
  return !!tool && typeof tool === 'object' && 'execute' in tool && typeof tool.execute === 'function';
}

/**
 * Base class for a 2026-07-28 MCP server. Same registry contract and metadata
 * as `MCPServerBase`; differs only where the protocol does: no standalone SSE
 * transport, tools run through `executeTool` with suspend/resume instead of a
 * push-style `context.mcp`, and `mcpVersion` tells the two families apart.
 */
export abstract class MCPServerBaseV2<TId extends string = string> extends MastraBase {
  readonly mcpVersion = 2;
  /** Tracks if the server ID has been definitively set. */
  private idWasSet = false;
  /** The display name of the MCP server. */
  public readonly name: string;
  /** The semantic version of the MCP server. */
  public readonly version: string;
  /** Internal storage for the server's unique ID. */
  private _id: TId;
  /** A description of what the MCP server does. */
  public readonly description?: string;
  /** Optional instructions describing how to use the server and its features. */
  public readonly instructions?: string;
  /** Repository information for the server's source code. */
  public readonly repository?: MCPServerConfig['repository'];
  /** The release date of this server version (ISO 8601 string). */
  public readonly releaseDate: string;
  /** Indicates if this version is the latest available. */
  public readonly isLatest: boolean;
  /** The canonical packaging format (e.g., "npm", "docker"), if applicable. */
  public readonly packageCanonical?: MCPServerConfig['packageCanonical'];
  /** Information about installable packages for this server. */
  public readonly packages?: MCPServerConfig['packages'];
  /** Information about remote access points for this server. */
  public readonly remotes?: MCPServerConfig['remotes'];
  /** Reference to the Mastra instance if this server is registered with one. */
  public mastra: Mastra | undefined;
  /** Agents to be exposed as tools. */
  protected readonly agents?: MCPServerConfig['agents'];
  /** Workflows to be exposed as tools. */
  protected readonly workflows?: MCPServerConfig['workflows'];
  /** The tools this server exposes, keyed by catalogue name. Mutable to support dynamic tool management. */
  protected readonly catalogue: ToolsInput;

  constructor(config: MCPServerConfig<TId>) {
    super({ component: RegisteredLogger.MCP_SERVER, name: config.name });
    this.name = config.name;
    this.version = config.version;

    // If user does not provide an ID, we will use the key from the Mastra config, but if user does not pass MCPServer
    // to Mastra, we will generate a random UUID as a backup.
    if (config.id) {
      this._id = slugify(config.id) as TId;
      this.idWasSet = true;
    } else {
      this._id = randomUUID() as TId;
    }

    this.description = config.description;
    this.instructions = config.instructions;
    this.repository = config.repository;
    this.releaseDate = config.releaseDate || new Date().toISOString();
    this.isLatest = config.isLatest === undefined ? true : config.isLatest;
    this.packageCanonical = config.packageCanonical;
    this.packages = config.packages;
    this.remotes = config.remotes;
    this.agents = config.agents;
    this.workflows = config.workflows;
    this.catalogue = { ...config.tools };
  }

  /**
   * Public getter for the server's unique ID.
   * The ID is set at construction or by Mastra and is read-only afterwards.
   */
  public get id(): TId {
    return this._id;
  }

  /**
   * Sets the server's unique ID. This method is typically called by Mastra when
   * registering the server, using the key provided in the Mastra configuration.
   * It ensures the ID is set only once.
   * If an ID was already provided in the config, this method will be a no-op.
   */
  setId(id: TId) {
    if (this.idWasSet) {
      return;
    }
    this._id = id;
    this.idWasSet = true;
  }

  /** Gets a read-only view of the registered tools. */
  tools(): Readonly<ToolsInput> {
    return this.catalogue;
  }

  /**
   * Internal method used by Mastra to register itself with the server.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;

    // Auto-register tools with the Mastra instance
    Object.entries(this.catalogue).forEach(([key, tool]) => {
      this.registerBusinessTool(mastra, key, tool);
    });

    // Auto-register agents with the Mastra instance
    if (this.agents && typeof this.agents === 'object') {
      Object.entries(this.agents).forEach(([key, agent]) => {
        try {
          mastra.addAgent(agent, key);
        } catch (error) {
          // Agent might already be registered, that's okay
          if (!(error instanceof MastraError) || error.id !== 'MASTRA_ADD_AGENT_DUPLICATE_KEY') {
            throw error;
          }
        }
      });
    }

    // Auto-register workflows with the Mastra instance
    if (this.workflows && typeof this.workflows === 'object') {
      Object.entries(this.workflows).forEach(([key, workflow]) => {
        try {
          mastra.addWorkflow(workflow, key);
        } catch (error) {
          // Workflow might already be registered, that's okay
          if (!(error instanceof MastraError) || error.id !== 'MASTRA_ADD_WORKFLOW_DUPLICATE_KEY') {
            throw error;
          }
        }
      });
    }
  }

  /** Registers a catalogue entry as a Mastra business tool when it is a Mastra tool (has an id). */
  private registerBusinessTool(mastra: Mastra, key: string, tool: ToolsInput[string]): void {
    if (!tool || typeof tool !== 'object' || !('id' in tool)) return;
    // Use tool's intrinsic ID to avoid collisions across MCP servers
    const toolKey = typeof tool.id === 'string' ? tool.id : key;
    try {
      mastra.addTool(tool as ToolAction<any, any, any, any>, toolKey);
    } catch (error) {
      // Tool might already be registered, that's okay
      if (!(error instanceof MastraError) || error.id !== 'MASTRA_ADD_TOOL_DUPLICATE_KEY') {
        throw error;
      }
    }
  }

  private businessToolKey(key: string, tool: ToolsInput[string]): string | undefined {
    if (!tool || typeof tool !== 'object' || !('id' in tool)) return undefined;
    return typeof tool.id === 'string' ? tool.id : key;
  }

  /** Adds tools to the catalogue at runtime, keeping the Mastra business registry in sync. */
  protected addTools(tools: ToolsInput): void {
    for (const [key, tool] of Object.entries(tools)) {
      const previous = this.catalogue[key];
      if (previous) {
        this.logger.warn(`Tool '${key}' already exists and will be replaced.`);
        // Mastra.addTool keeps an existing registration, so drop the old business tool first.
        const previousKey = this.businessToolKey(key, previous);
        if (this.mastra && previousKey) this.mastra.removeTool(previousKey);
      }
      this.catalogue[key] = tool;
      if (this.mastra) this.registerBusinessTool(this.mastra, key, tool);
    }
  }

  /** Removes tools from the catalogue by key and returns the keys actually removed. */
  protected removeTools(keys: string[]): string[] {
    const removed: string[] = [];
    for (const key of keys) {
      const tool = this.catalogue[key];
      if (!tool) {
        this.logger.warn(`Cannot remove tool '${key}': tool not found.`);
        continue;
      }
      delete this.catalogue[key];
      const businessKey = this.businessToolKey(key, tool);
      if (this.mastra && businessKey) this.mastra.removeTool(businessKey);
      removed.push(key);
    }
    return removed;
  }

  /**
   * Runs a catalogue tool. A tool that calls `context.mcpv2.suspend(payload)`
   * returns `void`; that is reported as a `suspended` result carrying the
   * payload and the tool's `resumeSchema` so the caller can ask for input.
   */
  async executeTool(
    toolId: string,
    input: unknown,
    options: MCPToolExecutionOptionsV2 = {},
  ): Promise<MCPToolExecutionResultV2> {
    const tool = this.catalogue[toolId];
    if (!tool) throw new Error(`Tool ${toolId} not found`);
    if (!isExecutableTool(tool)) throw new Error(`Tool ${toolId} has no execute handler`);

    let suspended = false;
    let suspendPayload: unknown;
    const abortSignal = options.abortSignal ?? options.mcpv2?.signal;
    const mcpv2: MCPToolExecutionContextV2 = {
      ...(options.mcpv2 ?? {
        protocolVersion: '2026-07-28',
        requestId: randomUUID(),
        signal: abortSignal ?? new AbortController().signal,
        metadata: {},
        log: async () => {},
        progress: async () => {},
      }),
      suspend: async payload => {
        suspended = true;
        suspendPayload = payload;
      },
    };

    const output = await tool.execute(input, {
      requestContext: options.requestContext,
      abortSignal,
      tracingContext: options.tracingContext,
      observe: createToolObserve(options.tracingContext?.currentSpan),
      mastra: this.mastra,
      mcpv2,
    });

    if (suspended) {
      return {
        status: 'suspended',
        suspendPayload,
        resumeSchema: tool.resumeSchema
          ? standardSchemaToJSONSchema(toStandardSchema(tool.resumeSchema), { io: 'input' })
          : undefined,
      };
    }
    return { status: 'completed', output };
  }

  /** Start the MCP server using stdio transport. */
  public abstract startStdio(): Promise<void>;

  /**
   * Serve one Streamable HTTP request. Accepts the same shape as a 1.x server so
   * shared HTTP adapters call both families identically; the legacy transport
   * `options` bag has no meaning on a 2026-07-28 server and is ignored.
   */
  public abstract startHTTP(options: MCPServerHTTPOptions): Promise<void>;

  /** Close the MCP server and all its connections. */
  public abstract close(): Promise<void>;

  /** Basic server information, conforming to the MCP Registry 'Server' schema. */
  public abstract getServerInfo(): ServerInfo;

  /** Detailed server information, conforming to the MCP Registry 'ServerDetail' schema. */
  public abstract getServerDetail(): ServerDetailInfo;

  /** Lists the tools provided by this server, including their schemas. */
  public abstract getToolListInfo(
    requestContext?: RequestContext,
  ): { tools: MCPToolInfoV2[] } | Promise<{ tools: MCPToolInfoV2[] }>;

  /** Information for a specific tool, or undefined if not found. */
  public abstract getToolInfo(toolId: string): MCPToolInfoV2 | undefined | Promise<MCPToolInfoV2 | undefined>;

  /** Reads the content of a resource by URI. */
  public abstract readResource(uri: string): ReturnType<MCPServerBase['readResource']>;

  /** Lists all resources available on this server. */
  public abstract listResources(): ReturnType<MCPServerBase['listResources']>;
}

export function isMCPServerV2(server: MCPServerRegistryEntry): server is MCPServerBaseV2 {
  return 'mcpVersion' in server && server.mcpVersion === 2;
}
