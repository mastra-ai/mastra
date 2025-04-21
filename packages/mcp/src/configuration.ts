import { MastraBase } from '@mastra/core/base';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { v5 as uuidv5 } from 'uuid';
import { MastraMCPClient } from './client';
import type { MastraMCPServerDefinition } from './client';

const mastraMCPConfigurationInstances = new Map<string, InstanceType<typeof MCPConfiguration>>();

export interface MCPConfigurationOptions {
  id?: string;
  servers: Record<string, MastraMCPServerDefinition>;
  timeout?: number; // Optional global timeout
}

export class MCPConfiguration extends MastraBase {
  private serverConfigs: Record<string, MastraMCPServerDefinition> = {};
  private id: string;
  private defaultTimeout: number;

  constructor(args: MCPConfigurationOptions) {
    super({ name: 'MCPConfiguration' });
    this.defaultTimeout = args.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC;
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

    await Promise.all(Array.from(this.mcpClientsById.values()).map(client => client.disconnect()));
    this.mcpClientsById.clear();
  }

  public async getTools() {
    this.addToInstanceCache();
    const connectedTools: Record<string, any> = {}; // <- any because we don't have proper tool schemas

    await this.eachClientTools(async ({ serverName, tools }) => {
      for (const [toolName, toolConfig] of Object.entries(tools)) {
        connectedTools[`${serverName}_${toolName}`] = toolConfig; // namespace tool to prevent tool name conflicts between servers
      }
    });

    return connectedTools;
  }

  public async getToolsets() {
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

    // Create client with server configuration including log handler
    const mcpClient = new MastraMCPClient({
      name,
      server: config,
      timeout: config.timeout ?? this.defaultTimeout,
    });

    this.mcpClientsById.set(name, mcpClient);
    try {
      await mcpClient.connect();
    } catch (e) {
      this.mcpClientsById.delete(name);
      this.logger.error(`MCPConfiguration errored connecting to MCP server ${name}`, {
        error: e instanceof Error ? e.message : String(e),
      });
      throw new Error(`Failed to connect to MCP server ${name}: ${e instanceof Error ? e.message : String(e)}`);
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
    await Promise.all(
      Object.entries(this.serverConfigs).map(async ([serverName, serverConfig]) => {
        const client = await this.getConnectedClient(serverName, serverConfig);
        const tools = await client.tools();
        await cb({ serverName, tools, client });
      }),
    );
  }
}
