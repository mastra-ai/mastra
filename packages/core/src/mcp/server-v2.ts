import { randomUUID } from 'node:crypto';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';
import type { MCPToolType, Tool } from '../tools';
import { createToolObserve } from '../tools/observe';
import { isMCPToolV2 } from './native-tool';
import type { MCPToolExecutionContextV2, MCPToolOutcomeV2, MCPToolV2 } from './native-tool';
import type { MCPServerConfig, MCPServerHTTPOptions, ServerDetailInfo, ServerInfo } from './types';
import type { MCPServerBase } from './index';

export type MCPServerRegistryEntry = MCPServerBase | MCPServerBaseV2;
export type MCPServerHTTPOptionsV2 = Pick<MCPServerHTTPOptions, 'url' | 'httpPath' | 'req' | 'res'>;
export type MCPServerToolsV2 = Record<string, Tool | MCPToolV2>;

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
      if (!isMCPToolV2(tool)) mastra.addTool(tool, tool.id ?? key);
    }
  }

  async invokeTool(
    toolId: string,
    input: unknown,
    context: MCPToolExecutionContextV2,
  ): Promise<MCPToolOutcomeV2<unknown>> {
    const tool = this.catalogue[toolId];
    if (!tool) throw new Error(`Tool ${toolId} not found`);
    if (isMCPToolV2(tool)) return tool.invoke(input, context);
    return {
      kind: 'completed',
      value: await this.executeTool(toolId, input, {
        requestContext: context.requestContext,
        abortSignal: context.request.signal,
        tracingContext: context.tracingContext,
      }),
    };
  }

  async executeTool(
    toolId: string,
    input: unknown,
    context?: { requestContext?: RequestContext; abortSignal?: AbortSignal } & Pick<
      MCPToolExecutionContextV2,
      'tracingContext'
    >,
  ): Promise<unknown> {
    const tool = this.catalogue[toolId];
    if (!tool) throw new Error(`Tool ${toolId} not found`);
    if (isMCPToolV2(tool)) throw new Error('Native MCP tools require a protocol request context; use invokeTool');
    if (!tool.execute) throw new Error(`Tool ${toolId} has no execute handler`);
    return tool.execute(input, {
      requestContext: context?.requestContext,
      abortSignal: context?.abortSignal,
      tracingContext: context?.tracingContext,
      observe: createToolObserve(context?.tracingContext?.currentSpan),
      mastra: this.mastra,
    });
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
