import { MastraBase } from '@mastra/core/base';
import { MastraMCPClient } from './client';
import type { MastraMCPServerDefinition } from './client';

export class MCPConfiguration extends MastraBase {
  private serverConfigs: Record<string, MastraMCPServerDefinition> = {};

  constructor(args: { servers: Record<string, MastraMCPServerDefinition> }) {
    super({ name: 'MCPConfiguration' });
    this.serverConfigs = args.servers;
  }

  public async getConnectedTools() {
    const connectedTools: Record<string, any> = {}; // <- any because we don't have proper tool schemas

    await this.eachClientTools(async ({ serverName, tools }) => {
      for (const [toolName, toolConfig] of Object.entries(tools)) {
        connectedTools[`${serverName}_${toolName}`] = toolConfig; // namespace tool to prevent tool name conflicts between servers
      }
    });

    return connectedTools;
  }

  public async getConnectedToolsets() {
    const connectedToolsets: Record<string, Record<string, any>> = {}; // <- any because we don't have proper tool schemas

    await this.eachClientTools(async ({ serverName, tools }) => {
      if (tools) {
        connectedToolsets[serverName] = tools;
      }
    });

    return connectedToolsets;
  }

  private mcpClientsById = new Map<string, MastraMCPClient>();
  private async getConnectedClient(name: string, config: MastraMCPServerDefinition) {
    const exists = this.mcpClientsById.has(name);

    if (exists) {
      const mcpClient = this.mcpClientsById.get(name)!;
      await mcpClient.connect();

      return mcpClient;
    }

    this.logger.debug(`Connecting to ${name} MCP server`);

    const mcpClient = new MastraMCPClient({
      name,
      server: config,
    });

    this.mcpClientsById.set(name, mcpClient);
    try {
      await mcpClient.connect();
    } catch (e) {
      this.mcpClientsById.delete(name);
      this.logger.error(`MCPConfiguraiton errored connecting to MCP server ${name}`);
      throw e;
    }

    this.logger.debug(`Connected to ${name} MCP server`);

    return mcpClient;
  }

  private async eachClientTools(
    cb: (input: {
      serverName: string;
      tools: Record<string, any>; // <- any because we don't have proper tool schemas
    }) => Promise<void>,
  ) {
    for (const [serverName, serverConfig] of Object.entries(this.serverConfigs)) {
      const client = await this.getConnectedClient(serverName, serverConfig);
      const tools = await client.tools();
      await cb({
        serverName,
        tools,
      });
    }
  }
}
