import { randomUUID } from 'node:crypto';
import type { JSONSchema7 } from 'json-schema';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import type { RequestContext } from '../request-context';
import { standardSchemaToJSONSchema, toStandardSchema } from '../schema';
import type { MCPToolType, Tool } from '../tools';
import { createToolObserve } from '../tools/observe';
import type { MCPToolExecutionContextV2 } from './request-v2';
import type { MCPServerConfig, MCPServerHTTPOptions, ServerDetailInfo, ServerInfo } from './types';
import type { MCPServerBase } from './index';

export type MCPServerRegistryEntry = MCPServerBase | MCPServerBaseV2;
export type MCPServerHTTPOptionsV2 = Pick<MCPServerHTTPOptions, 'url' | 'httpPath' | 'req' | 'res'>;
export type MCPServerToolV2 = Tool<any, any, any, any, any, any, any>;
export type MCPServerToolsV2 = Record<string, MCPServerToolV2>;

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

export interface MCPServerConfigV2 extends Pick<
  MCPServerConfig,
  | 'description'
  | 'instructions'
  | 'repository'
  | 'releaseDate'
  | 'isLatest'
  | 'packageCanonical'
  | 'packages'
  | 'remotes'
> {
  id?: string;
  name: string;
  version: string;
  tools: MCPServerToolsV2;
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

/** Independent native base; legacy transports and push contexts are not inherited. */
export abstract class MCPServerBaseV2 extends MastraBase {
  readonly mcpVersion = 2;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly repository?: MCPServerConfigV2['repository'];
  readonly releaseDate: string;
  readonly isLatest: boolean;
  readonly packageCanonical?: MCPServerConfigV2['packageCanonical'];
  readonly packages?: MCPServerConfigV2['packages'];
  readonly remotes?: MCPServerConfigV2['remotes'];
  protected mastra?: Mastra;
  private serverId: string;
  private idWasSet: boolean;
  private readonly catalogue: MCPServerToolsV2;

  constructor(config: MCPServerConfigV2) {
    super({ component: RegisteredLogger.MCP_SERVER, name: config.name });
    this.name = config.name;
    this.version = config.version;
    this.description = config.description;
    this.instructions = config.instructions;
    this.repository = config.repository;
    this.releaseDate = config.releaseDate ?? new Date().toISOString();
    this.isLatest = config.isLatest ?? true;
    this.packageCanonical = config.packageCanonical;
    this.packages = config.packages;
    this.remotes = config.remotes;
    this.serverId = config.id ?? randomUUID();
    this.idWasSet = config.id !== undefined;
    this.catalogue = { ...config.tools };
  }

  get id(): string {
    return this.serverId;
  }

  setId(id: string): void {
    if (this.idWasSet) return;
    this.serverId = id;
    this.idWasSet = true;
  }

  tools(): Readonly<MCPServerToolsV2> {
    return this.catalogue;
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
    for (const [key, tool] of Object.entries(this.catalogue)) {
      mastra.addTool(tool, tool.id ?? key);
    }
  }

  /** Adds tools to the catalogue at runtime, keeping the Mastra business registry in sync. */
  protected addTools(tools: MCPServerToolsV2): void {
    for (const [key, tool] of Object.entries(tools)) {
      const previous = this.catalogue[key];
      if (previous) {
        this.logger.warn(`Tool '${key}' already exists and will be replaced.`);
        // Mastra.addTool keeps an existing registration, so drop the old business tool first.
        if (this.mastra) this.mastra.removeTool(previous.id ?? key);
      }
      this.catalogue[key] = tool;
      if (this.mastra) this.mastra.addTool(tool, tool.id ?? key);
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
      if (this.mastra) this.mastra.removeTool(tool.id ?? key);
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
    if (!tool.execute) throw new Error(`Tool ${toolId} has no execute handler`);

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

  abstract startStdio(): Promise<void>;
  abstract startHTTP(options: MCPServerHTTPOptionsV2): Promise<void>;
  abstract close(): Promise<void>;
  abstract getServerInfo(): ServerInfo;
  abstract getServerDetail(): ServerDetailInfo;
  abstract getToolListInfo(
    requestContext?: RequestContext,
  ): { tools: MCPToolInfoV2[] } | Promise<{ tools: MCPToolInfoV2[] }>;
  abstract getToolInfo(toolId: string): MCPToolInfoV2 | undefined | Promise<MCPToolInfoV2 | undefined>;
  abstract readResource(uri: string): ReturnType<MCPServerBase['readResource']>;
  abstract listResources(): ReturnType<MCPServerBase['listResources']>;
}

export function isMCPServerV2(server: MCPServerRegistryEntry): server is MCPServerBaseV2 {
  return 'mcpVersion' in server && server.mcpVersion === 2;
}
