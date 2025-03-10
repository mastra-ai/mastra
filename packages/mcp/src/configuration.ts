import { MastraBase } from '@mastra/core/base';
import { v5 as uuidv5 } from 'uuid';
import { MastraMCPClient } from './client';
import type { MastraMCPServerDefinition } from './client';

const mastraMCPConfigurationInstances = new Map<string, InstanceType<typeof MCPConfiguration>>();

export class MCPConfiguration extends MastraBase {
  private serverConfigs: Record<string, MastraMCPServerDefinition> = {};
  private id: string;

  constructor(args: { id?: string; servers: Record<string, MastraMCPServerDefinition> }) {
    super({ name: 'MCPConfiguration' });
    this.serverConfigs = args.servers;
    this.id = args.id ?? this.makeId();

    // to prevent memory leaks return the same MCP server instance when configured the same way multiple times
    const existingInstance = mastraMCPConfigurationInstances.get(this.id);
    if (existingInstance) {
      if (!args.id) {
        throw new Error(`MCPConfiguration was initialized multiple times with the same configuration options.

This error is intended to prevent memory leaks.

To fix this you have three different options:
1. If you need multiple MCPConfiguration class instances with identical server configurations, set an id when configuring: new MCPConfiguration({ id: "my-unique-id" })
2. Call "await configuration.disconnect()" after you're done using the configuration and before you recreate another instance with the same options. If the identical MCPConfiguration instance is already closed at the time of re-creating it, you will not see this error.
3. If you only need one instance of MCPConfiguration in your app, refactor your code so it's only created one time (ex. move it out of a loop into a higher scope code block)
`);
      }
      return existingInstance;
    }
    this.addToInstanceCache();
    return this;
  }

  private addToInstanceCache() {
    if (!mastraMCPConfigurationInstances.has(this.id)) {
      mastraMCPConfigurationInstances.set(this.id, this);
    }
  }

  private makeId() {
    const text = JSON.stringify(this.serverConfigs).normalize('NFKC');
    const idNamespace = uuidv5(`MCPConfiguration`, uuidv5.DNS);

    return uuidv5(text, idNamespace);
  }

  public async disconnect() {
    mastraMCPConfigurationInstances.delete(this.id);

    for (const serverName of Object.keys(this.serverConfigs)) {
      const client = this.mcpClientsById.get(serverName);
      if (client) {
        await client.disconnect();
      }
    }
  }

  public async getConnectedTools() {
    this.addToInstanceCache();
    const connectedTools: Record<string, any> = {}; // <- any because we don't have proper tool schemas

    await this.eachClientTools(async ({ serverName, tools }) => {
      for (const [toolName, toolConfig] of Object.entries(tools)) {
        connectedTools[`${serverName}_${toolName}`] = toolConfig; // namespace tool to prevent tool name conflicts between servers
      }
    });

    return connectedTools;
  }

  public async getConnectedToolsets() {
    this.addToInstanceCache();
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
      client: InstanceType<typeof MastraMCPClient>;
    }) => Promise<void>,
  ) {
    for (const [serverName, serverConfig] of Object.entries(this.serverConfigs)) {
      const client = await this.getConnectedClient(serverName, serverConfig);
      const tools = await client.tools();
      await cb({
        serverName,
        tools,
        client,
      });
    }
  }
}
