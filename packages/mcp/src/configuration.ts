import { MastraBase } from '@mastra/core/base';
import type { ToolAction } from '@mastra/core/tools';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import equal from 'fast-deep-equal';
import { v5 as uuidv5 } from 'uuid';
import type { MastraMCPServerDefinition } from './client';
import { MastraMCPClient } from './client';

export interface MCPConfigurationOptions {
  id?: string;
  servers: Record<string, MastraMCPServerDefinition>;
  timeout?: number; // Optional global timeout
}

export class MCPConfiguration extends MastraBase {
  private static readonly instances = new Map<string, InstanceType<typeof MCPConfiguration>>();
  private static readonly serverConfigCache = new Map<
    string,
    {
      servers: Record<string, MastraMCPServerDefinition>;
      id: string;
    }
  >();

  private serverConfigs: Record<string, MastraMCPServerDefinition> = {};
  private id: string;
  private defaultTimeout: number;

  constructor(args: MCPConfigurationOptions) {
    super({ name: 'MCPConfiguration' });
    this.defaultTimeout = args.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC;
    this.serverConfigs = args.servers;

    // If an ID is provided, use it directly
    if (args.id) {
      this.id = args.id;
      const cached = (this.constructor as typeof MCPConfiguration).serverConfigCache.get(this.id);

      // If we have a cache hit but servers don't match, disconnect the old configuration
      if (cached && !equal(cached.servers, args.servers)) {
        const existingInstance = (this.constructor as typeof MCPConfiguration).instances.get(this.id);
        if (existingInstance) {
          void existingInstance.disconnect(); // void to explicitly ignore the Promise
        }
      }
    } else {
      // Generate a new ID based on server configs
      this.id = this.makeId();
    }

    // Update cache with current configuration
    (this.constructor as typeof MCPConfiguration).serverConfigCache.set(this.id, {
      servers: args.servers,
      id: this.id,
    });

    // Check for existing instance with same ID
    const existingInstance = (this.constructor as typeof MCPConfiguration).instances.get(this.id);
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
      Object.assign(this, existingInstance);
    } else {
      this.addToInstanceCache();
    }
  }

  private addToInstanceCache() {
    if (!(this.constructor as typeof MCPConfiguration).instances.has(this.id)) {
      (this.constructor as typeof MCPConfiguration).instances.set(this.id, this);
    }
  }

  private makeId() {
    const text = JSON.stringify(this.serverConfigs).normalize('NFKC');
    const idNamespace = uuidv5(`MCPConfiguration`, uuidv5.DNS);

    return uuidv5(text, idNamespace);
  }

  public async disconnect() {
    (this.constructor as typeof MCPConfiguration).instances.delete(this.id);

    await Promise.all(Array.from(this.mcpClientsById.values()).map(client => client.disconnect()));
    this.mcpClientsById.clear();
  }

  public async getTools() {
    this.addToInstanceCache();
    const connectedTools: Record<string, ToolAction> = {};

    await this.eachClientTools(async ({ serverName, tools }) => {
      for (const [toolName, toolConfig] of Object.entries(tools)) {
        connectedTools[`${serverName}_${toolName}`] = toolConfig;
      }
    });

    return connectedTools;
  }

  public async getToolsets() {
    this.addToInstanceCache();
    const connectedToolsets: Record<string, Record<string, ToolAction>> = {};

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
      const mcpClient = this.mcpClientsById.get(name);
      if (!mcpClient) {
        throw new Error(`Client ${name} exists but is undefined`);
      }
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
      tools: Record<string, ToolAction>;
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
