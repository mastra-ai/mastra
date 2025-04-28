import { MastraBase } from '@mastra/core/base';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import equal from 'fast-deep-equal';
import { v5 as uuidv5 } from 'uuid';
import { InternalMastraMCPClient } from './client';
import type { MastraMCPServerDefinition } from './client';

const mcpClientInstances = new Map<string, InstanceType<typeof MCPClient>>();

export interface MCPClientOptions {
  id?: string;
  servers: Record<string, MastraMCPServerDefinition>;
  timeout?: number; // Optional global timeout
}

export class MCPClient extends MastraBase {
  private serverConfigs: Record<string, MastraMCPServerDefinition> = {};
  private id: string;
  private defaultTimeout: number;
  private mcpClientsById = new Map<string, InternalMastraMCPClient>();
  private disconnectPromise: Promise<void> | null = null;

  constructor(args: MCPClientOptions) {
    super({ name: 'MCPClient' });
    this.defaultTimeout = args.timeout ?? DEFAULT_REQUEST_TIMEOUT_MSEC;
    this.serverConfigs = args.servers;
    this.id = args.id ?? this.makeId();

    if (args.id) {
      this.id = args.id;
      const cached = mcpClientInstances.get(this.id);

      if (cached && !equal(cached.serverConfigs, args.servers)) {
        const existingInstance = mcpClientInstances.get(this.id);
        if (existingInstance) {
          void existingInstance.disconnect();
        }
      }
    } else {
      this.id = this.makeId();
    }

    // to prevent memory leaks return the same MCP server instance when configured the same way multiple times
    const existingInstance = mcpClientInstances.get(this.id);
    if (existingInstance) {
      if (!args.id) {
        throw new Error(`MCPClient was initialized multiple times with the same configuration options.

This error is intended to prevent memory leaks.

To fix this you have three different options:
1. If you need multiple MCPClient class instances with identical server configurations, set an id when configuring: new MCPClient({ id: "my-unique-id" })
2. Call "await client.disconnect()" after you're done using the client and before you recreate another instance with the same options. If the identical MCPClient instance is already closed at the time of re-creating it, you will not see this error.
3. If you only need one instance of MCPClient in your app, refactor your code so it's only created one time (ex. move it out of a loop into a higher scope code block)
`);
      }
      return existingInstance;
    }

    mcpClientInstances.set(this.id, this);
    this.addToInstanceCache();
    return this;
  }

  private addToInstanceCache() {
    if (!mcpClientInstances.has(this.id)) {
      mcpClientInstances.set(this.id, this);
    }
  }

  private makeId() {
    const text = JSON.stringify(this.serverConfigs).normalize('NFKC');
    const idNamespace = uuidv5(`MCPClient`, uuidv5.DNS);

    return uuidv5(text, idNamespace);
  }

  public async disconnect() {
    // Helps to prevent race condition
    // If there is already a disconnect ongoing, return the existing promise.
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    this.disconnectPromise = (async () => {
      try {
        mcpClientInstances.delete(this.id);

        // Disconnect all clients in the cache
        await Promise.all(Array.from(this.mcpClientsById.values()).map(client => client.disconnect()));
        this.mcpClientsById.clear();
      } finally {
        this.disconnectPromise = null;
      }
    })();

    return this.disconnectPromise;
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

  /**
   * Get the current session IDs for all connected MCP clients using the Streamable HTTP transport.
   * Returns an object mapping server names to their session IDs.
   */
  get sessionIds(): Record<string, string> {
    const sessionIds: Record<string, string> = {};
    for (const [serverName, client] of this.mcpClientsById.entries()) {
      if (client.sessionId) {
        sessionIds[serverName] = client.sessionId;
      }
    }
    return sessionIds;
  }

  private async getConnectedClient(name: string, config: MastraMCPServerDefinition) {
    // Helps to prevent race condition.
    // If we want to call connect() we need to wait for the disconnect to complete first if any is ongoing.
    if (this.disconnectPromise) {
      await this.disconnectPromise;
    }

    const exists = this.mcpClientsById.has(name);
    const existingClient = this.mcpClientsById.get(name);

    if (exists) {
      // This is just to satisfy Typescript since technically you could have this.mcpClientsById.set('someKey', undefined);
      // Should never reach this point basically we always create a new MastraMCPClient instance when we add to the Map.
      if (!existingClient) {
        throw new Error(`Client ${name} exists but is undefined`);
      }
      await existingClient.connect();
      return existingClient;
    }

    this.logger.debug(`Connecting to ${name} MCP server`);

    // Create client with server configuration including log handler
    const mcpClient = new InternalMastraMCPClient({
      name,
      server: config,
      timeout: config.timeout ?? this.defaultTimeout,
    });

    this.mcpClientsById.set(name, mcpClient);

    try {
      await mcpClient.connect();
    } catch (e) {
      this.mcpClientsById.delete(name);
      this.logger.error(`MCPClient errored connecting to MCP server ${name}`, {
        error: e instanceof Error ? e.message : String(e),
      });
      throw new Error(
        `Failed to connect to MCP server ${name}: ${e instanceof Error ? e.stack || e.message : String(e)}`,
      );
    }

    this.logger.debug(`Connected to ${name} MCP server`);

    return mcpClient;
  }

  private async eachClientTools(
    cb: (input: {
      serverName: string;
      tools: Record<string, any>; // <- any because we don't have proper tool schemas
      client: InstanceType<typeof InternalMastraMCPClient>;
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

/**
 * @deprecated MCPConfigurationOptions is deprecated and will be removed in a future release. Use MCPClientOptions instead.
 */
export interface MCPConfigurationOptions {
  id?: string;
  servers: Record<string, MastraMCPServerDefinition>;
  timeout?: number; // Optional global timeout
}

/**
 * @deprecated MCPConfiguration is deprecated and will be removed in a future release. Use MCPClient instead.
 */
export class MCPConfiguration extends MCPClient {
  constructor(args: MCPClientOptions) {
    super(args);
    this.logger.warn(
      `MCPConfiguration has been renamed to MCPClient and MCPConfiguration is deprecated. The API is identical but the MCPConfiguration export will be removed in the future. Update your imports now to prevent future errors.`,
    );
  }
}
