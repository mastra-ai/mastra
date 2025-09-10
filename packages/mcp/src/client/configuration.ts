import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ElicitRequest,
  ElicitResult,
  Prompt,
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';
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
          mcpClientInstances.delete(this.id);
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
  public get elicitation() {
    this.addToInstanceCache();
    return {
      onRequest: async (serverName: string, handler: (request: ElicitRequest['params']) => Promise<ElicitResult>) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.elicitation.onRequest(handler);
        } catch (err) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_ON_REQUEST_ELICITATION_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
              },
            },
            err,
          );
        }
      },
    };
  }

  public get resources() {
    this.addToInstanceCache();
    return {
      list: async (): Promise<Record<string, Resource[]>> => {
        const allResources: Record<string, Resource[]> = {};
        for (const serverName of Object.keys(this.serverConfigs)) {
          try {
            const internalClient = await this.getConnectedClientForServer(serverName);
            allResources[serverName] = await internalClient.resources.list();
          } catch (error) {
            const mastraError = new MastraError(
              {
                id: 'MCP_CLIENT_LIST_RESOURCES_FAILED',
                domain: ErrorDomain.MCP,
                category: ErrorCategory.THIRD_PARTY,
                details: {
                  serverName,
                },
              },
              error,
            );
            this.logger.trackException(mastraError);
            this.logger.error('Failed to list resources from server:', { error: mastraError.toString() });
          }
        }
        return allResources;
      },
      templates: async (): Promise<Record<string, ResourceTemplate[]>> => {
        const allTemplates: Record<string, ResourceTemplate[]> = {};
        for (const serverName of Object.keys(this.serverConfigs)) {
          try {
            const internalClient = await this.getConnectedClientForServer(serverName);
            allTemplates[serverName] = await internalClient.resources.templates();
          } catch (error) {
            const mastraError = new MastraError(
              {
                id: 'MCP_CLIENT_LIST_RESOURCE_TEMPLATES_FAILED',
                domain: ErrorDomain.MCP,
                category: ErrorCategory.THIRD_PARTY,
                details: {
                  serverName,
                },
              },
              error,
            );
            this.logger.trackException(mastraError);
            this.logger.error('Failed to list resource templates from server:', { error: mastraError.toString() });
          }
        }
        return allTemplates;
      },
      read: async (serverName: string, uri: string) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.resources.read(uri);
        } catch (error) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_READ_RESOURCE_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
                uri,
              },
            },
            error,
          );
        }
      },
      subscribe: async (serverName: string, uri: string) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.resources.subscribe(uri);
        } catch (error) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_SUBSCRIBE_RESOURCE_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
                uri,
              },
            },
            error,
          );
        }
      },
      unsubscribe: async (serverName: string, uri: string) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.resources.unsubscribe(uri);
        } catch (err) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_UNSUBSCRIBE_RESOURCE_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
                uri,
              },
            },
            err,
          );
        }
      },
      onUpdated: async (serverName: string, handler: (params: { uri: string }) => void) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.resources.onUpdated(handler);
        } catch (err) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_ON_UPDATED_RESOURCE_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
              },
            },
            err,
          );
        }
      },
      onListChanged: async (serverName: string, handler: () => void) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.resources.onListChanged(handler);
        } catch (err) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_ON_LIST_CHANGED_RESOURCE_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
              },
            },
            err,
          );
        }
      },
    };
  }

  public get prompts() {
    this.addToInstanceCache();
    return {
      list: async (): Promise<Record<string, Prompt[]>> => {
        const allPrompts: Record<string, Prompt[]> = {};
        for (const serverName of Object.keys(this.serverConfigs)) {
          try {
            const internalClient = await this.getConnectedClientForServer(serverName);
            allPrompts[serverName] = await internalClient.prompts.list();
          } catch (error) {
            const mastraError = new MastraError(
              {
                id: 'MCP_CLIENT_LIST_PROMPTS_FAILED',
                domain: ErrorDomain.MCP,
                category: ErrorCategory.THIRD_PARTY,
                details: {
                  serverName,
                },
              },
              error,
            );
            this.logger.trackException(mastraError);
            this.logger.error('Failed to list prompts from server:', { error: mastraError.toString() });
          }
        }
        return allPrompts;
      },
      get: async ({
        serverName,
        name,
        args,
        version,
      }: {
        serverName: string;
        name: string;
        args?: Record<string, any>;
        version?: string;
      }) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.prompts.get({ name, args, version });
        } catch (error) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_GET_PROMPT_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
                name,
              },
            },
            error,
          );
        }
      },
      onListChanged: async (serverName: string, handler: () => void) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.prompts.onListChanged(handler);
        } catch (error) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_ON_LIST_CHANGED_PROMPT_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.THIRD_PARTY,
              details: {
                serverName,
              },
            },
            error,
          );
        }
      },
    };
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

    try {
      await this.eachClientTools(async ({ serverName, tools }) => {
        for (const [toolName, toolConfig] of Object.entries(tools)) {
          connectedTools[`${serverName}_${toolName}`] = toolConfig; // namespace tool to prevent tool name conflicts between servers
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MCP_CLIENT_GET_TOOLS_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    return connectedTools;
  }

  public async getToolsets() {
    this.addToInstanceCache();
    const connectedToolsets: Record<string, Record<string, any>> = {}; // <- any because we don't have proper tool schemas

    try {
      await this.eachClientTools(async ({ serverName, tools }) => {
        if (tools) {
          connectedToolsets[serverName] = tools;
        }
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MCP_CLIENT_GET_TOOLSETS_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    return connectedToolsets;
  }

  /**
   * @deprecated all resource actions have been moved to the this.resources object. Use this.resources.list() instead.
   */
  public async getResources() {
    return this.resources.list();
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

  private async getConnectedClient(name: string, config: MastraMCPServerDefinition): Promise<InternalMastraMCPClient> {
    if (this.disconnectPromise) {
      await this.disconnectPromise;
    }

    const exists = this.mcpClientsById.has(name);
    const existingClient = this.mcpClientsById.get(name);

    this.logger.debug(`getConnectedClient ${name} exists: ${exists}`);

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

    mcpClient.__setLogger(this.logger);

    this.mcpClientsById.set(name, mcpClient);

    try {
      await mcpClient.connect();
    } catch (e) {
      const mastraError = new MastraError(
        {
          id: 'MCP_CLIENT_CONNECT_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to connect to MCP server ${name}: ${e instanceof Error ? e.stack || e.message : String(e)}`,
          details: {
            name,
          },
        },
        e,
      );
      this.logger.trackException(mastraError);
      this.logger.error('MCPClient errored connecting to MCP server:', { error: mastraError.toString() });
      this.mcpClientsById.delete(name);
      throw mastraError;
    }
    this.logger.debug(`Connected to ${name} MCP server`);
    return mcpClient;
  }

  private async getConnectedClientForServer(serverName: string): Promise<InternalMastraMCPClient> {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server configuration not found for name: ${serverName}`);
    }
    return this.getConnectedClient(serverName, serverConfig);
  }

  private async eachClientTools(
    cb: (args: {
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
