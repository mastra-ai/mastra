import type { ToolsInput } from '@mastra/core/agent';
import { MCPServerBase } from '@mastra/core/mcp';
import type {
  MCPServerConfig,
  MCPServerHonoSSEOptions,
  MCPServerHTTPOptions,
  MCPServerSSEOptions,
  MCPToolType,
  ServerDetailInfo,
  ServerInfo,
} from '@mastra/core/mcp';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/core/schema';

import type { InternalMastraMCPClient } from './client';

type ToolListResult = {
  tools: Array<{
    id?: string;
    name: string;
    description?: string;
    inputSchema: any;
    outputSchema?: any;
    toolType?: MCPToolType;
    _meta?: Record<string, unknown>;
  }>;
};

/**
 * A lightweight proxy that wraps a single MCPClient server connection as an
 * MCPServerBase instance.  This allows external (non-Mastra) MCP servers
 * connected through MCPClient to be registered in Mastra's `mcpServers`
 * config and appear in Studio alongside native MCPServer instances.
 *
 * Tool and resource operations are delegated lazily to the underlying
 * InternalMastraMCPClient connection.
 */
export class MCPClientServerProxy extends MCPServerBase {
  private clientGetter: () => Promise<InternalMastraMCPClient>;
  private cachedClient: InternalMastraMCPClient | null = null;
  private _cachedToolList: ToolListResult | null = null;

  constructor(
    config: {
      name: string;
      version?: string;
      id?: string;
      description?: string;
    },
    clientGetter: () => Promise<InternalMastraMCPClient>,
  ) {
    const serverConfig: MCPServerConfig = {
      name: config.name,
      version: config.version ?? '1.0.0',
      id: config.id,
      description: config.description,
      tools: {},
    };
    super(serverConfig);
    this.clientGetter = clientGetter;
  }

  private async getClient(): Promise<InternalMastraMCPClient> {
    if (!this.cachedClient) {
      this.cachedClient = await this.clientGetter();
    }
    return this.cachedClient;
  }

  private convertSchema(schema: any) {
    if (isStandardSchemaWithJSON(schema)) {
      return standardSchemaToJSONSchema(schema);
    }
    return schema?.jsonSchema || schema;
  }

  private async fetchToolList(): Promise<ToolListResult> {
    if (this._cachedToolList) return this._cachedToolList;
    const client = await this.getClient();
    const tools = await client.tools();
    this._cachedToolList = {
      tools: Object.entries(tools).map(([toolName, tool]) => ({
        id: toolName,
        name: tool.id || toolName,
        description: tool.description,
        inputSchema: this.convertSchema(tool.inputSchema),
        outputSchema: this.convertSchema(tool.outputSchema),
        toolType: tool.mcp?.toolType,
        _meta: tool.mcp?._meta as Record<string, unknown> | undefined,
      })),
    };
    this.convertedTools = tools as any;
    return this._cachedToolList;
  }

  // ---------- MCPServerBase abstract implementations ----------

  public convertTools(
    _tools: ToolsInput,
    _agents?: MCPServerConfig['agents'],
    _workflows?: MCPServerConfig['workflows'],
  ): Record<string, any> {
    return {};
  }

  /**
   * Returns the cached tool list synchronously, or triggers an async fetch.
   * The Studio API handlers are async and will auto-await a returned Promise.
   */
  public getToolListInfo(): ToolListResult | Promise<ToolListResult> {
    if (this._cachedToolList) return this._cachedToolList;
    return this.fetchToolList();
  }

  public getToolInfo(toolId: string):
    | {
        name: string;
        description?: string;
        inputSchema: any;
        outputSchema?: any;
        toolType?: MCPToolType;
        _meta?: Record<string, unknown>;
      }
    | undefined
    | Promise<
        | {
            name: string;
            description?: string;
            inputSchema: any;
            outputSchema?: any;
            toolType?: MCPToolType;
            _meta?: Record<string, unknown>;
          }
        | undefined
      > {
    if (this._cachedToolList) {
      return this._cachedToolList.tools.find(t => t.id === toolId || t.name === toolId);
    }
    return this.fetchToolList().then(list => list.tools.find(t => t.id === toolId || t.name === toolId));
  }

  public async executeTool(
    toolId: string,
    args: any,
    _executionContext?: { messages?: any[]; toolCallId?: string },
  ): Promise<any> {
    const client = await this.getClient();
    const tools = await client.tools();
    const tool = tools[toolId];
    if (!tool) {
      throw new Error(`Tool '${toolId}' not found on remote MCP server '${this.name}'`);
    }
    if (!tool.execute) {
      throw new Error(`Tool '${toolId}' on remote MCP server '${this.name}' has no execute method`);
    }
    return tool.execute(args, _executionContext as any);
  }

  public async listResources(): Promise<{
    resources: Array<{
      uri: string;
      name: string;
      description?: string;
      mimeType?: string;
      _meta?: Record<string, unknown>;
    }>;
  }> {
    const client = await this.getClient();
    const resources = await client.resources.list();
    return {
      resources: resources.map((r: any) => ({
        uri: r.uri,
        name: r.name ?? r.uri,
        description: r.description,
        mimeType: r.mimeType,
        _meta: r._meta,
      })),
    };
  }

  public async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string }> }> {
    const client = await this.getClient();
    const result = await client.resources.read(uri);
    return {
      contents: (result.contents ?? []).map((c: any) => ({
        uri: c.uri ?? uri,
        ...(c.text !== undefined ? { text: c.text } : {}),
        ...(c.blob !== undefined ? { blob: c.blob } : {}),
      })),
    };
  }

  // Transport methods — not applicable for client proxies
  public async startStdio(): Promise<void> {
    throw new Error('MCPClientServerProxy does not support stdio transport');
  }
  public async startSSE(_options: MCPServerSSEOptions): Promise<void> {
    throw new Error('MCPClientServerProxy does not support SSE transport');
  }
  public async startHonoSSE(_options: MCPServerHonoSSEOptions): Promise<Response | undefined> {
    throw new Error('MCPClientServerProxy does not support Hono SSE transport');
  }
  public async startHTTP(_options: MCPServerHTTPOptions): Promise<void> {
    throw new Error('MCPClientServerProxy does not support HTTP transport');
  }
  public async close(): Promise<void> {
    this.cachedClient = null;
  }

  public getServerInfo(): ServerInfo {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }

  public getServerDetail(): ServerDetailInfo {
    return {
      ...this.getServerInfo(),
      packages: this.packages ?? [],
      remotes: this.remotes ?? [],
    };
  }
}
