import { isAbsolute } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { createObservabilityContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';

export interface McpToolClient {
  listToolNames(): Promise<Set<string>>;
  call(toolName: string, input: unknown): Promise<unknown>;
  disconnect(): Promise<void>;
}

export class MastraMcpToolClient implements McpToolClient {
  constructor(
    private readonly client: MCPClient,
    private readonly serverName: string,
    private readonly allowedTools: ReadonlySet<string>,
  ) {}
  private getTools() {
    return this.client.listTools();
  }
  async listToolNames() {
    const prefix = `${this.serverName}_`;
    return new Set(
      Object.keys(await this.getTools()).map(name => (name.startsWith(prefix) ? name.slice(prefix.length) : name)),
    );
  }
  async call(toolName: string, input: unknown) {
    if (!this.allowedTools.has(toolName)) throw new Error(`MCP tool not allowed: ${toolName}`);
    const tool = (await this.getTools())[`${this.serverName}_${toolName}`];
    if (!tool?.execute) throw new Error(`MCP tool unavailable: ${toolName}`);
    return tool.execute(input, {
      ...createObservabilityContext(),
      observe: noopObserve,
      requestContext: new RequestContext(),
    });
  }
  disconnect() {
    return this.client.disconnect();
  }
}

const requiredPath = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value || !isAbsolute(value) || !existsSync(value) || !statSync(value).isFile())
    throw new Error(`${name} must be an existing absolute file path`);
  return value;
};

export function createQuickBooksMcpToolClient(options: { enablePosting?: boolean } = {}): McpToolClient {
  const serverPath = requiredPath('QBO_MCP_SERVER_PATH'),
    tokenStorePath = requiredPath('QBO_MCP_TOKEN_STORE_PATH');
  const allowedTools = new Set([
    'search_vendors',
    'search_purchase_orders',
    'search_bills',
    ...(options.enablePosting ? ['create-bill'] : []),
  ]);
  const client = new MCPClient({
    id: 'quickbooks-accounting',
    timeout: 30_000,
    servers: {
      quickbooks: {
        command: process.execPath,
        args: [serverPath],
        env: {
          QUICKBOOKS_TOKEN_STORE_PATH: tokenStorePath,
          QUICKBOOKS_DISABLE_WRITE: options.enablePosting ? 'false' : 'true',
          QUICKBOOKS_DISABLE_UPDATE: 'true',
          QUICKBOOKS_DISABLE_DELETE: 'true',
        },
      },
    },
  });
  return new MastraMcpToolClient(client, 'quickbooks', allowedTools);
}
