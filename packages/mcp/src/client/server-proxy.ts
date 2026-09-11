import { MCPServerBaseV2 } from '@mastra/core/mcp';
import type { MCPToolInfoV2, ServerDetailInfo, ServerInfo } from '@mastra/core/mcp';
import type { RequestContext } from '@mastra/core/request-context';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/core/schema';
import { noopObserve } from '@mastra/core/tools';

import type { InternalMastraMCPClient } from './client';


/**
 * Wraps a single MCPClient server connection as an `MCPServerBaseV2` so external
 * (non-Mastra) MCP servers connected through MCPClient can be registered in Mastra's
 * `mcpServers` config and appear in Studio alongside local MCPServer instances.
 *
 * Tool and resource operations are delegated lazily to the underlying connection.
 * The proxy has no transport of its own: it is not served over stdio or HTTP.
 */
export class MCPClientServerProxy extends MCPServerBaseV2 {
  private clientGetter: () => Promise<InternalMastraMCPClient>;
  private cachedClient: InternalMastraMCPClient | null = null;
  private cachedToolList: { tools: MCPToolInfoV2[] } | null = null;

  constructor(
    config: { name: string; version?: string; id?: string; description?: string },
    clientGetter: () => Promise<InternalMastraMCPClient>,
  ) {
    super({
      name: config.name,
      version: config.version ?? '1.0.0',
      id: config.id,
      description: config.description,
      tools: {},
    });
    this.clientGetter = clientGetter;
  }

  private async getClient(): Promise<InternalMastraMCPClient> {
    if (!this.cachedClient) {
      this.cachedClient = await this.clientGetter();
    }
    return this.cachedClient;
  }

  private convertSchema(schema: unknown): unknown {
    if (isStandardSchemaWithJSON(schema)) {
      return standardSchemaToJSONSchema(schema);
    }
    return (schema as { jsonSchema?: unknown } | undefined)?.jsonSchema ?? schema;
  }

  private async fetchToolList(): Promise<{ tools: MCPToolInfoV2[] }> {
    if (this.cachedToolList) return this.cachedToolList;
    const client = await this.getClient();
    const tools = await client.tools();
    this.cachedToolList = {
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
    return this.cachedToolList;
  }

  public getToolListInfo(): { tools: MCPToolInfoV2[] } | Promise<{ tools: MCPToolInfoV2[] }> {
    if (this.cachedToolList) return this.cachedToolList;
    return this.fetchToolList();
  }

  public getToolInfo(toolId: string): MCPToolInfoV2 | undefined | Promise<MCPToolInfoV2 | undefined> {
    const find = (list: { tools: MCPToolInfoV2[] }) => list.tools.find(t => t.id === toolId || t.name === toolId);
    if (this.cachedToolList) return find(this.cachedToolList);
    return this.fetchToolList().then(find);
  }

  public override async executeTool(
    toolId: string,
    input: unknown,
    context?: { requestContext?: RequestContext; abortSignal?: AbortSignal },
  ): Promise<unknown> {
    const client = await this.getClient();
    const tools = await client.tools();
    const tool = tools[toolId];
    if (!tool) {
      throw new Error(`Tool '${toolId}' not found on remote MCP server '${this.name}'`);
    }
    if (!tool.execute) {
      throw new Error(`Tool '${toolId}' on remote MCP server '${this.name}' has no execute method`);
    }
    return tool.execute(input, {
      requestContext: context?.requestContext,
      abortSignal: context?.abortSignal,
      observe: noopObserve,
    });
  }

  public async listResources(): Promise<{
    resources: Array<{ uri: string; name: string; description?: string; mimeType?: string; _meta?: Record<string, unknown> }>;
  }> {
    const client = await this.getClient();
    const resources = await client.resources.list();
    return {
      resources: resources.map(r => ({
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
      contents: result.contents.map(c => ({
        uri: c.uri ?? uri,
        ...('text' in c && c.text !== undefined ? { text: c.text } : {}),
        ...('blob' in c && c.blob !== undefined ? { blob: c.blob } : {}),
      })),
    };
  }

  public async startStdio(): Promise<void> {
    throw new Error('MCPClientServerProxy does not serve a transport; it proxies a remote MCP server');
  }

  public async startHTTP(): Promise<void> {
    throw new Error('MCPClientServerProxy does not serve a transport; it proxies a remote MCP server');
  }

  public async close(): Promise<void> {
    this.cachedClient = null;
    this.cachedToolList = null;
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
