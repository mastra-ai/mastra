import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { Tool } from '@mastra/core/tools';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ElicitRequest,
  ElicitResult,
  ProgressNotification,
  Prompt,
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';
import equal from 'fast-deep-equal';
import { v5 as uuidv5 } from 'uuid';
import { InternalMastraMCPClient } from './client';
import type { MastraMCPServerDefinition } from './client';

const mcpClientInstances = new Map<string, InstanceType<typeof MCPClient>>();

/**
 * Configuration options for creating an MCPClient instance.
 */
export interface MCPClientOptions {
  /** Optional unique identifier to prevent memory leaks when creating multiple instances with identical configurations */
  id?: string;
  /** Map of server names to their connection configurations (stdio or HTTP-based) */
  servers: Record<string, MastraMCPServerDefinition>;
  /** Optional global timeout in milliseconds for all servers (default: 60000ms) */
  timeout?: number;
}

/**
 * MCPClient manages multiple MCP server connections and their tools in a Mastra application.
 *
 * This class handles connection lifecycle, tool namespacing, and provides access to tools,
 * resources, prompts, and elicitation across all configured servers.
 *
 * @example
 * ```typescript
 * import { MCPClient } from '@mastra/mcp';
 * import { Agent } from '@mastra/core/agent';
 *
 * const mcp = new MCPClient({
 *   servers: {
 *     weather: {
 *       url: new URL('http://localhost:8080/sse'),
 *     },
 *     stockPrice: {
 *       command: 'npx',
 *       args: ['tsx', 'stock-price.ts'],
 *       env: { API_KEY: 'your-api-key' },
 *     },
 *   },
 *   timeout: 30000,
 * });
 *
 * const agent = new Agent({
 *   id: 'multi-tool-agent',
 *   name: 'Multi-tool Agent',
 *   instructions: 'You have access to multiple tools.',
 *   model: 'openai/gpt-4o',
 *   tools: await mcp.listTools(),
 * });
 * ```
 */
export class MCPClient extends MastraBase {
  private serverConfigs: Record<string, MastraMCPServerDefinition> = {};
  private id: string;
  private defaultTimeout: number;
  private mcpClientsById = new Map<string, InternalMastraMCPClient>();
  private disconnectPromise: Promise<void> | null = null;

  /**
   * Creates a new MCPClient instance for managing MCP server connections.
   *
   * The client automatically manages connection lifecycle and prevents memory leaks by
   * caching instances with identical configurations.
   *
   * @param args - Configuration options
   * @param args.id - Optional unique identifier to allow multiple instances with same config
   * @param args.servers - Map of server names to server configurations
   * @param args.timeout - Optional global timeout in milliseconds (default: 60000)
   *
   * @throws {Error} If multiple instances with identical config are created without an ID
   *
   * @example
   * ```typescript
   * const mcp = new MCPClient({
   *   servers: {
   *     weatherServer: {
   *       url: new URL('http://localhost:8080/sse'),
   *       requestInit: {
   *         headers: { Authorization: 'Bearer token' }
   *       }
   *     }
   *   },
   *   timeout: 30000
   * });
   * ```
   */
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

  /**
   * Provides access to progress-related operations for tracking long-running operations.
   *
   * Progress tracking allows MCP servers to send updates about the status of ongoing operations,
   * providing real-time feedback to users about task completion and current state.
   *
   * @example
   * ```typescript
   * // Set up handler for progress updates from a server
   * await mcp.progress.onUpdate('serverName', (params) => {
   *   console.log(`Progress: ${params.progress}%`);
   *   console.log(`Status: ${params.message}`);
   *
   *   if (params.total) {
   *     console.log(`Completed ${params.progress} of ${params.total} items`);
   *   }
   * });
   * ```
   */
  public get progress() {
    this.addToInstanceCache();
    return {
      onUpdate: async (serverName: string, handler: (params: ProgressNotification['params']) => void) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.progress.onUpdate(handler);
        } catch (err) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_ON_UPDATE_PROGRESS_FAILED',
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

  /**
   * Provides access to elicitation-related operations for interactive user input collection.
   *
   * Elicitation allows MCP servers to request structured information from users during tool execution.
   *
   * @example
   * ```typescript
   * // Set up handler for elicitation requests from a server
   * await mcp.elicitation.onRequest('serverName', async (request) => {
   *   console.log(`Server requests: ${request.message}`);
   *   console.log('Schema:', request.requestedSchema);
   *
   *   // Collect user input and return response
   *   return {
   *     action: 'accept',
   *     content: { name: 'John Doe', email: 'john@example.com' }
   *   };
   * });
   * ```
   */
  public get elicitation() {
    this.addToInstanceCache();
    return {
      /**
       * Sets up a handler function for elicitation requests from a specific server.
       *
       * The handler receives requests for user input and must return a response with
       * action ('accept', 'decline', or 'cancel') and optional content.
       *
       * @param serverName - Name of the server to handle elicitation requests for
       * @param handler - Function to handle elicitation requests
       * @throws {MastraError} If setting up the handler fails
       *
       * @example
       * ```typescript
       * await mcp.elicitation.onRequest('weatherServer', async (request) => {
       *   // Prompt user for input
       *   const userInput = await promptUser(request.requestedSchema);
       *   return { action: 'accept', content: userInput };
       * });
       * ```
       */
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

  /**
   * Provides access to resource-related operations across all configured servers.
   *
   * Resources represent data exposed by MCP servers (files, database records, API responses, etc.).
   *
   * @example
   * ```typescript
   * // List all resources from all servers
   * const allResources = await mcp.resources.list();
   * Object.entries(allResources).forEach(([serverName, resources]) => {
   *   console.log(`${serverName}: ${resources.length} resources`);
   * });
   *
   * // Read a specific resource
   * const content = await mcp.resources.read('weatherServer', 'file://data.json');
   *
   * // Subscribe to resource updates
   * await mcp.resources.subscribe('weatherServer', 'file://data.json');
   * await mcp.resources.onUpdated('weatherServer', async (params) => {
   *   console.log(`Resource updated: ${params.uri}`);
   * });
   * ```
   */
  public get resources() {
    this.addToInstanceCache();
    return {
      /**
       * Lists all available resources from all configured servers.
       *
       * Returns a map of server names to their resource arrays. Errors for individual
       * servers are logged but don't throw - failed servers return empty arrays.
       *
       * @returns Promise resolving to object mapping server names to resource arrays
       *
       * @example
       * ```typescript
       * const resources = await mcp.resources.list();
       * console.log(resources.weatherServer); // Array of resources
       * ```
       */
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
      /**
       * Lists all available resource templates from all configured servers.
       *
       * Resource templates are URI templates (RFC 6570) describing dynamic resources.
       * Errors for individual servers are logged but don't throw.
       *
       * @returns Promise resolving to object mapping server names to template arrays
       *
       * @example
       * ```typescript
       * const templates = await mcp.resources.templates();
       * console.log(templates.weatherServer); // Array of resource templates
       * ```
       */
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
      /**
       * Reads the content of a specific resource from a server.
       *
       * @param serverName - Name of the server to read from
       * @param uri - URI of the resource to read
       * @returns Promise resolving to the resource content
       * @throws {MastraError} If reading the resource fails
       *
       * @example
       * ```typescript
       * const content = await mcp.resources.read('weatherServer', 'file://config.json');
       * console.log(content.contents[0].text);
       * ```
       */
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
      /**
       * Subscribes to updates for a specific resource on a server.
       *
       * @param serverName - Name of the server
       * @param uri - URI of the resource to subscribe to
       * @returns Promise resolving when subscription is established
       * @throws {MastraError} If subscription fails
       *
       * @example
       * ```typescript
       * await mcp.resources.subscribe('weatherServer', 'file://config.json');
       * ```
       */
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
      /**
       * Unsubscribes from updates for a specific resource on a server.
       *
       * @param serverName - Name of the server
       * @param uri - URI of the resource to unsubscribe from
       * @returns Promise resolving when unsubscription is complete
       * @throws {MastraError} If unsubscription fails
       *
       * @example
       * ```typescript
       * await mcp.resources.unsubscribe('weatherServer', 'file://config.json');
       * ```
       */
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
      /**
       * Sets a notification handler for when subscribed resources are updated on a server.
       *
       * @param serverName - Name of the server to monitor
       * @param handler - Callback function receiving the updated resource URI
       * @returns Promise resolving when handler is registered
       * @throws {MastraError} If setting up the handler fails
       *
       * @example
       * ```typescript
       * await mcp.resources.onUpdated('weatherServer', async (params) => {
       *   console.log(`Resource updated: ${params.uri}`);
       *   const content = await mcp.resources.read('weatherServer', params.uri);
       * });
       * ```
       */
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
      /**
       * Sets a notification handler for when the resource list changes on a server.
       *
       * @param serverName - Name of the server to monitor
       * @param handler - Callback function invoked when resources are added/removed
       * @returns Promise resolving when handler is registered
       * @throws {MastraError} If setting up the handler fails
       *
       * @example
       * ```typescript
       * await mcp.resources.onListChanged('weatherServer', async () => {
       *   console.log('Resource list changed, re-fetching...');
       *   const resources = await mcp.resources.list();
       * });
       * ```
       */
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

  /**
   * Provides access to prompt-related operations across all configured servers.
   *
   * Prompts are reusable message templates exposed by MCP servers that can be parameterized
   * and used for AI interactions.
   *
   * @example
   * ```typescript
   * // List all prompts from all servers
   * const allPrompts = await mcp.prompts.list();
   * Object.entries(allPrompts).forEach(([serverName, prompts]) => {
   *   console.log(`${serverName}: ${prompts.map(p => p.name).join(', ')}`);
   * });
   *
   * // Get a specific prompt with arguments
   * const prompt = await mcp.prompts.get({
   *   serverName: 'weatherServer',
   *   name: 'forecast-template',
   *   args: { city: 'London', days: 7 }
   * });
   * ```
   */
  public get prompts() {
    this.addToInstanceCache();
    return {
      /**
       * Lists all available prompts from all configured servers.
       *
       * Returns a map of server names to their prompt arrays. Errors for individual
       * servers are logged but don't throw - failed servers return empty arrays.
       *
       * @returns Promise resolving to object mapping server names to prompt arrays
       *
       * @example
       * ```typescript
       * const prompts = await mcp.prompts.list();
       * console.log(prompts.weatherServer); // Array of prompts
       * ```
       */
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
      /**
       * Retrieves a specific prompt with its messages from a server.
       *
       * @param params - Parameters for the prompt request
       * @param params.serverName - Name of the server to retrieve from
       * @param params.name - Name of the prompt to retrieve
       * @param params.args - Optional arguments to populate the prompt template
       * @param params.version - Optional specific version of the prompt
       * @returns Promise resolving to the prompt result with messages
       * @throws {MastraError} If fetching the prompt fails
       *
       * @example
       * ```typescript
       * const prompt = await mcp.prompts.get({
       *   serverName: 'weatherServer',
       *   name: 'forecast',
       *   args: { city: 'London' },
       *   version: '1.0'
       * });
       * console.log(prompt.messages);
       * ```
       */
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
      /**
       * Sets a notification handler for when the prompt list changes on a server.
       *
       * @param serverName - Name of the server to monitor
       * @param handler - Callback function invoked when prompts are added/removed/modified
       * @returns Promise resolving when handler is registered
       * @throws {MastraError} If setting up the handler fails
       *
       * @example
       * ```typescript
       * await mcp.prompts.onListChanged('weatherServer', async () => {
       *   console.log('Prompt list changed, re-fetching...');
       *   const prompts = await mcp.prompts.list();
       * });
       * ```
       */
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

  /**
   * Disconnects from all MCP servers and cleans up resources.
   *
   * This method gracefully closes all server connections and clears internal caches.
   * Safe to call multiple times - subsequent calls will wait for the first disconnect to complete.
   *
   * @example
   * ```typescript
   * // Cleanup on application shutdown
   * process.on('SIGTERM', async () => {
   *   await mcp.disconnect();
   *   process.exit(0);
   * });
   * ```
   */
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
        await Promise.allSettled(Array.from(this.mcpClientsById.values()).map(client => client.disconnect()));
        this.mcpClientsById.clear();
      } finally {
        this.disconnectPromise = null;
      }
    })();

    return this.disconnectPromise;
  }

  /**
   * Retrieves all tools from all configured servers with namespaced names.
   *
   * Tool names are namespaced as `serverName_toolName` to prevent conflicts between servers.
   * This method is intended to be passed directly to an Agent definition.
   *
   * @returns Object mapping namespaced tool names to tool implementations.
   * Errors for individual servers are logged but don't throw - failed servers are skipped.
   *
   * @example
   * ```typescript
   * const agent = new Agent({
   *   id: 'multi-tool-agent',
   *   name: 'Multi-tool Agent',
   *   instructions: 'You have access to weather and stock tools.',
   *   model: 'openai/gpt-4',
   *   tools: await mcp.listTools(), // weather_getWeather, stockPrice_getPrice
   * });
   * ```
   */
  public async listTools(): Promise<Record<string, Tool<any, any, any, any>>> {
    this.addToInstanceCache();
    const connectedTools: Record<string, Tool<any, any, any, any>> = {};

    for (const serverName of Object.keys(this.serverConfigs)) {
      try {
        const client = await this.getConnectedClientForServer(serverName);
        const tools = await client.tools();
        for (const [toolName, toolConfig] of Object.entries(tools)) {
          connectedTools[`${serverName}_${toolName}`] = toolConfig;
        }
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: 'MCP_CLIENT_GET_TOOLS_FAILED',
            domain: ErrorDomain.MCP,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              serverName,
            },
          },
          error,
        );
        this.logger.trackException(mastraError);
        this.logger.error('Failed to list tools from server:', { error: mastraError.toString() });
      }
    }

    return connectedTools;
  }

  /**
   * Returns toolsets organized by server name for dynamic tool injection.
   *
   * Unlike listTools(), this returns tools grouped by server without namespacing.
   * This is intended to be passed dynamically to the generate() or stream() method.
   *
   * @returns Object mapping server names to their tool collections.
   * Errors for individual servers are logged but don't throw - failed servers are skipped.
   *
   * @example
   * ```typescript
   * const agent = new Agent({
   *   id: 'dynamic-agent',
   *   name: 'Dynamic Agent',
   *   instructions: 'You can use tools dynamically.',
   *   model: 'openai/gpt-4',
   * });
   *
   * const response = await agent.stream(prompt, {
   *   toolsets: await mcp.listToolsets(), // { weather: {...}, stockPrice: {...} }
   * });
   * ```
   */
  public async listToolsets(): Promise<Record<string, Record<string, Tool<any, any, any, any>>>> {
    this.addToInstanceCache();
    const connectedToolsets: Record<string, Record<string, Tool<any, any, any, any>>> = {};

    for (const serverName of Object.keys(this.serverConfigs)) {
      try {
        const client = await this.getConnectedClientForServer(serverName);
        const tools = await client.tools();
        if (tools) {
          connectedToolsets[serverName] = tools;
        }
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: 'MCP_CLIENT_GET_TOOLSETS_FAILED',
            domain: ErrorDomain.MCP,
            category: ErrorCategory.THIRD_PARTY,
            details: {
              serverName,
            },
          },
          error,
        );
        this.logger.trackException(mastraError);
        this.logger.error('Failed to list toolsets from server:', { error: mastraError.toString() });
      }
    }

    return connectedToolsets;
  }

  /**
   * Gets current session IDs for all connected MCP clients using Streamable HTTP transport.
   *
   * Returns an object mapping server names to their session IDs. Only includes servers
   * that are currently connected via Streamable HTTP transport.
   *
   * @returns Object mapping server names to session IDs
   *
   * @example
   * ```typescript
   * const sessions = mcp.sessionIds;
   * console.log(sessions);
   * // { weatherServer: 'abc-123', stockServer: 'def-456' }
   * ```
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
}
