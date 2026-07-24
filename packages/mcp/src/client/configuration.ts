import { createHash } from 'node:crypto';
import type { Stream } from 'node:stream';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MCPServerBase } from '@mastra/core/mcp';
import type { Tool } from '@mastra/core/tools';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/client';
import type {
  ElicitRequest,
  ElicitResult,
  ProgressNotification,
  Prompt,
  Resource,
  ResourceTemplateType,
} from '@modelcontextprotocol/client';
import equal from 'fast-deep-equal';
import type { OAuthClientInformationFull } from '../shared/oauth-types';
import { UnauthorizedError } from '../shared/oauth-types';
import { InternalMastraMCPClient } from './client';
import type { MastraMCPServerDefinition, MCPServerAuthState } from './client';
import { isReconnectableMCPError } from './error-utils';
import { createOAuthCallbackServer, getCallbackUrlCandidates } from './oauth-callback-server';
import type { OAuthCallbackServer } from './oauth-callback-server';
import { MCPOAuthClientProvider } from './oauth-provider';
import { MCPClientServerProxy } from './server-proxy';

const mcpClientInstances = new Map<string, InstanceType<typeof MCPClient>>();
const TOOL_DISCOVERY_MAX_ATTEMPTS = 2;

// Matches the entire 127.0.0.0/8 range in dotted-quad form. `URL` normalizes
// IPv4 hosts to four octets (so `127.1` becomes `127.0.0.1`), so anchoring the
// pattern is enough — and it rejects lookalikes like `127.evil.com` that a
// prefix check would wrongly accept and leak the authorization code to.
const LOOPBACK_IPV4 = /^127\.(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})$/;

// Whether a hostname is a loopback address authenticate() accepts for the
// provider's redirect URL (RFC 8252 loopback redirection). Kept in sync with the
// mastracode config parser, which accepts any 127.0.0.0/8 host, so a config that
// parses (e.g. 127.0.0.2) does not later fail here.
function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || hostname === '::1' || LOOPBACK_IPV4.test(hostname);
}

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
  private authFlowsByServer = new Map<string, Promise<void>>();
  private authCallbackServersByServer = new Map<string, OAuthCallbackServer>();
  /**
   * Per-server abort controllers for in-flight authorization flows. Created
   * synchronously at the start of {@link runAuthorizationFlow} — before the
   * callback server exists — so cancel/disconnect can interrupt the setup phase
   * (discovery, registration, port binding) and not just the waitForCode wait.
   */
  private authAbortControllersByServer = new Map<string, AbortController>();

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
          const internalClient = await this.getClientForServer(serverName);
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
      templates: async (): Promise<Record<string, ResourceTemplateType[]>> => {
        const allTemplates: Record<string, ResourceTemplateType[]> = {};
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
       * @returns Promise resolving to the prompt result with messages
       * @throws {MastraError} If fetching the prompt fails
       *
       * @example
       * ```typescript
       * const prompt = await mcp.prompts.get({
       *   serverName: 'weatherServer',
       *   name: 'forecast',
       *   args: { city: 'London' },
       * });
       * console.log(prompt.messages);
       * ```
       */
      get: async ({ serverName, name, args }: { serverName: string; name: string; args?: Record<string, any> }) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.prompts.get({ name, args });
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

  /**
   * Provides access to tool-related notification operations across all configured servers.
   *
   * To fetch tools, use `listTools()` or `listToolsets()`.
   *
   * @example
   * ```typescript
   * // React to tool list changes on a server
   * await mcp.tools.onListChanged('weatherServer', async () => {
   *   console.log('Tool list changed, re-fetching...');
   *   const tools = await mcp.listTools();
   * });
   * ```
   */
  public get tools() {
    this.addToInstanceCache();
    return {
      /**
       * Sets a notification handler for when the tool list changes on a server.
       *
       * @param serverName - Name of the server to monitor
       * @param handler - Callback function invoked when tools are added/removed/modified
       * @returns Promise resolving when handler is registered
       * @throws {MastraError} If setting up the handler fails
       *
       * @example
       * ```typescript
       * await mcp.tools.onListChanged('weatherServer', async () => {
       *   const tools = await mcp.listTools();
       * });
       * ```
       */
      onListChanged: async (serverName: string, handler: () => void) => {
        try {
          const internalClient = await this.getConnectedClientForServer(serverName);
          return internalClient.setToolListChangedNotificationHandler(handler);
        } catch (error) {
          throw new MastraError(
            {
              id: 'MCP_CLIENT_ON_LIST_CHANGED_TOOLS_FAILED',
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
    return createHash('sha256').update('MCPClient').update(text).digest('hex');
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

        // Tear down any in-flight authorization: each callback server owns a live
        // loopback HTTP port, and closing it rejects the flow's waitForCode. Await
        // the flow settlements so a disconnect during authentication does not leave
        // a bound port or a dangling promise keeping the process alive.
        const pendingFlows = Array.from(this.authFlowsByServer.values());
        // Abort first so flows still in their setup phase (no callback server
        // bound yet) unblock instead of parking on waitForCode and deadlocking
        // the awaited settlement below.
        for (const controller of this.authAbortControllersByServer.values()) {
          controller.abort();
        }
        await Promise.allSettled(Array.from(this.authCallbackServersByServer.values()).map(server => server.close()));
        await Promise.allSettled(pendingFlows);
        this.authAbortControllersByServer.clear();
        this.authCallbackServersByServer.clear();
        this.authFlowsByServer.clear();

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
   * Reconnects a single MCP server by name.
   *
   * If the server is already connected, it will be forcefully disconnected and reconnected.
   * If the server has never been connected, a new connection will be established.
   *
   * @param serverName - The name of the server to reconnect (must match a key in `servers`)
   * @throws {Error} If the server name is not found in the configuration
   *
   * @example
   * ```typescript
   * // Reconnect a specific server after it fails
   * await mcp.reconnectServer('weatherServer');
   * ```
   */
  public async reconnectServer(serverName: string): Promise<void> {
    const existingClient = this.mcpClientsById.get(serverName);
    if (existingClient) {
      await existingClient.forceReconnect();
    } else {
      await this.getConnectedClientForServer(serverName);
    }
  }

  /**
   * Runs the interactive OAuth authorization-code flow for a server.
   *
   * Requires the server to be configured with an MCPOAuthClientProvider whose
   * redirect URL points at a loopback address. The flow:
   *
   * 1. Starts a loopback callback server on the redirect URL's port (falling
   *    back to the next sequential ports when it is in use)
   * 2. Attempts a connection so the SDK runs discovery and dynamic client
   *    registration, delivering the authorization URL through the provider's
   *    `onRedirectToAuthorization` callback — the host directs the user there
   * 3. Waits for the browser to deliver the authorization code, validates the
   *    OAuth state, exchanges the code for tokens, and reconnects
   *
   * Concurrent calls for the same server join the pending flow (the joiner's
   * options are ignored — the pending flow keeps its own timeout); different
   * servers authenticate independently. Each server needs its own provider
   * instance: the flow pins session state on the provider, so sharing one
   * MCPOAuthClientProvider across servers is not supported. Hosts with custom
   * redirect handling (e.g. a web app with an HTTPS redirect URL) should
   * drive MCPOAuthClientProvider directly instead.
   *
   * @param serverName - The name of the server to authenticate (must match a key in `servers`)
   * @param options.timeoutMs - How long to wait for the browser callback (default 5 minutes)
   * @throws {Error} If the server has no MCPOAuthClientProvider or its redirect URL is not loopback
   *
   * @example
   * ```typescript
   * if (mcp.getServerAuthState('weatherServer') === 'needs-auth') {
   *   await mcp.authenticate('weatherServer');
   * }
   * ```
   */
  public async authenticate(serverName: string, options?: { timeoutMs?: number }): Promise<void> {
    // Wait for an in-flight disconnect to finish before starting. disconnect()
    // snapshots and then clears the auth-flow maps, so a flow registered during
    // that window would have its abort controller and callback server wiped
    // without being closed, orphaning the loopback port. Swallow a rejected
    // disconnect: it must not surface as an authenticate() failure.
    if (this.disconnectPromise) {
      await this.disconnectPromise.catch(() => {});
    }

    const pendingFlow = this.authFlowsByServer.get(serverName);
    if (pendingFlow) {
      return pendingFlow;
    }

    // Correctness contract: nothing between here and runAuthorizationFlow's
    // synchronous abort-controller registration may await. The disconnect-race
    // guard above relies on this flow's map entries landing in the same tick, so
    // that any disconnect() starting afterwards snapshots and tears them down.
    const flow = this.runAuthorizationFlow(serverName, options).finally(() => {
      this.authFlowsByServer.delete(serverName);
    });
    this.authFlowsByServer.set(serverName, flow);
    return flow;
  }

  /**
   * OAuth authorization state of a configured server.
   *
   * Returns `undefined` for servers without an authProvider and for servers
   * that have not attempted a connection yet.
   */
  public getServerAuthState(serverName: string): MCPServerAuthState | undefined {
    return this.mcpClientsById.get(serverName)?.authState;
  }

  private async runAuthorizationFlow(serverName: string, options?: { timeoutMs?: number }): Promise<void> {
    // Register the abort controller synchronously, before the first await, so a
    // cancel/disconnect during the setup phase (discovery, registration, port
    // binding) can interrupt the flow rather than letting it park on waitForCode.
    const abortController = new AbortController();
    this.authAbortControllersByServer.set(serverName, abortController);
    const throwIfAborted = () => {
      if (abortController.signal.aborted) {
        throw new Error(`Authentication for MCP server ${serverName} was cancelled.`);
      }
    };

    // Resources acquired during setup that must be released on every exit path.
    // Tracked here so the single outer finally can tear them down even if a
    // fallible setup step (session begin, port binding) throws.
    let provider: MCPOAuthClientProvider | undefined;
    let sessionStarted = false;
    let callbackServer: OAuthCallbackServer | undefined;

    // Installed before the first fallible step so the abort-controller entry,
    // provider session, and callback server never leak on an early throw.
    try {
      const config = this.getServerConfig(serverName);
      const candidateProvider = config.authProvider;
      if (!(candidateProvider instanceof MCPOAuthClientProvider)) {
        throw new Error(
          `Cannot authenticate MCP server ${serverName}: it is not configured with an MCPOAuthClientProvider.`,
        );
      }
      provider = candidateProvider;

      const redirectUrl = new URL(provider.redirectUrl.toString());
      if (redirectUrl.protocol !== 'http:' || !isLoopbackHostname(redirectUrl.hostname)) {
        throw new Error(
          `Cannot authenticate MCP server ${serverName}: the provider's redirect URL must be a loopback address, got ${redirectUrl.origin}.`,
        );
      }

      const state = await provider.beginAuthorizationSession();
      sessionStarted = true;
      // A cancel that arrived during beginAuthorizationSession() has no callback
      // server to close yet, so bail here before binding a port and parking.
      throwIfAborted();

      callbackServer = await createOAuthCallbackServer({ redirectUrl, state });
      // A cancel during port binding: bail before we ever wait for a code that
      // will never arrive. The outer finally closes the freshly-bound server.
      throwIfAborted();
      this.authCallbackServersByServer.set(serverName, callbackServer);

      // Point the authorization request at the callback URL that actually
      // bound, and register every fallback candidate during dynamic client
      // registration so a future fallback port still matches a registered URI.
      provider.applyResolvedRedirectUrl(callbackServer.url, getCallbackUrlCandidates(redirectUrl));

      // Discard a stored client registration that does not cover the bound
      // callback URL — the authorization server would reject its redirect_uri.
      const clientInfo = (await provider.clientInformation()) as Partial<OAuthClientInformationFull> | undefined;
      if (clientInfo?.redirect_uris && !clientInfo.redirect_uris.includes(callbackServer.url.toString())) {
        await provider.invalidateCredentials('client');
      }

      const client = await this.getClientForServer(serverName);
      try {
        // With valid stored tokens this simply connects; otherwise the SDK
        // delivers the authorization URL and throws UnauthorizedError.
        await client.connect();
        return;
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) {
          throw this.handleConnectError(serverName, error);
        }
      }

      const { code } = await callbackServer.waitForCode(options);
      await client.finishAuth(code);

      try {
        await client.connect();
      } catch (error) {
        throw error instanceof UnauthorizedError ? error : this.handleConnectError(serverName, error);
      }
    } finally {
      this.authCallbackServersByServer.delete(serverName);
      this.authAbortControllersByServer.delete(serverName);
      if (sessionStarted) {
        provider?.endAuthorizationSession();
      }
      await callbackServer?.close();
    }
  }

  /**
   * Cancels a pending {@link authenticate} flow for a server.
   *
   * Tears down the loopback callback server immediately — the pending
   * authenticate() call rejects. Useful when the user closed the browser
   * without completing consent, which the host cannot observe.
   *
   * The resulting auth state depends on how far the flow had progressed: a flow
   * cancelled after the server rejected the connection with a 401 stays in the
   * `needs-auth` state so it can be retried right away, while a flow cancelled
   * during the setup phase (before any connection was attempted) leaves the
   * state unchanged — typically `undefined`.
   *
   * @param serverName - The name of the server whose flow to cancel
   * @returns `true` if a pending flow was cancelled, `false` when no flow was pending
   */
  public async cancelAuthentication(serverName: string): Promise<boolean> {
    const pendingFlow = this.authFlowsByServer.get(serverName);
    if (!pendingFlow) {
      return false;
    }

    // Abort first so a flow still in its setup phase (no callback server bound
    // yet) is interrupted before it can park on waitForCode; then close the
    // callback server if one exists, which rejects an in-progress waitForCode.
    this.authAbortControllersByServer.get(serverName)?.abort();
    await this.authCallbackServersByServer.get(serverName)?.close();
    await pendingFlow.catch(() => undefined);
    return true;
  }

  /**
   * Returns instructions advertised by connected MCP servers during initialize.
   *
   * Servers that have not connected yet, or did not advertise instructions,
   * return `undefined`.
   */
  public getServerInstructions(): Record<string, string | undefined> {
    const instructions: Record<string, string | undefined> = {};

    for (const serverName of Object.keys(this.serverConfigs)) {
      instructions[serverName] = this.mcpClientsById.get(serverName)?.instructions;
    }

    return instructions;
  }

  /**
   * Retrieves all tools from all configured servers with namespaced names.
   *
   * Tool names are namespaced as `serverName_toolName` to prevent conflicts between servers.
   * This method is intended to be passed directly to an Agent definition.
   *
   * @returns Object mapping namespaced tool names to tool implementations.
   * Errors for individual servers are logged but don't throw - failed servers are skipped.
   * Transient connection failures are retried once after reconnecting the affected server.
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
    const result = await this.listToolsWithErrors();
    return result.tools;
  }

  /**
   * Retrieves all tools from all configured servers with namespaced names,
   * along with any per-server errors.
   *
   * Like listTools(), but also returns errors for servers that failed to connect
   * or list tools. This allows callers to report specific failure reasons per server.
   *
   * @returns Object with `tools` (successful tools) and `errors` (failed servers with error messages).
   * Transient connection failures are retried once after reconnecting the affected server.
   *
   * @example
   * ```typescript
   * const { tools, errors } = await mcp.listToolsWithErrors();
   * for (const [name, err] of Object.entries(errors)) {
   *   console.error(`Server ${name} failed: ${err}`);
   * }
   * ```
   */
  public async listToolsWithErrors(): Promise<{
    tools: Record<string, Tool<any, any, any, any>>;
    errors: Record<string, string>;
  }> {
    this.addToInstanceCache();
    const connectedTools: Record<string, Tool<any, any, any, any>> = {};
    const errors: Record<string, string> = {};

    for (const serverName of Object.keys(this.serverConfigs)) {
      try {
        const tools = await this.getToolsForServer(serverName);
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
        errors[serverName] = error instanceof Error ? error.message : String(error);
      }
    }

    return { tools: connectedTools, errors };
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
    const result = await this.listToolsetsWithErrors();
    return result.toolsets;
  }

  /**
   * Returns toolsets organized by server name, along with any per-server errors.
   *
   * Like listToolsets(), but also returns errors for servers that failed to connect
   * or list tools. This allows callers to report specific failure reasons per server.
   *
   * @returns Object with `toolsets` (successful servers) and `errors` (failed servers with error messages).
   * Transient connection failures are retried once after reconnecting the affected server.
   *
   * @example
   * ```typescript
   * const { toolsets, errors } = await mcp.listToolsetsWithErrors();
   * for (const [name, err] of Object.entries(errors)) {
   *   console.error(`Server ${name} failed: ${err}`);
   * }
   * ```
   */
  public async listToolsetsWithErrors(): Promise<{
    toolsets: Record<string, Record<string, Tool<any, any, any, any>>>;
    errors: Record<string, string>;
  }> {
    this.addToInstanceCache();
    const connectedToolsets: Record<string, Record<string, Tool<any, any, any, any>>> = {};
    const errors: Record<string, string> = {};

    for (const serverName of Object.keys(this.serverConfigs)) {
      try {
        const tools = await this.getToolsForServer(serverName);
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
        errors[serverName] = error instanceof Error ? error.message : String(error);
      }
    }

    return { toolsets: connectedToolsets, errors };
  }

  /**
   * Creates MCPServerBase-compatible proxy objects for each server connection
   * in this MCPClient.  The returned record can be spread directly into
   * Mastra's `mcpServers` config so that external (non-Mastra) servers
   * appear in Studio alongside native MCPServer instances.
   *
   * @returns Record mapping server names to MCPServerBase proxy instances
   *
   * @example
   * ```typescript
   * const mcp = new MCPClient({
   *   servers: {
   *     trailhead: { command: 'npx', args: ['trailhead-server'] },
   *   },
   * });
   *
   * const mastra = new Mastra({
   *   mcpServers: {
   *     ...mcp.toMCPServerProxies(),
   *   },
   * });
   * ```
   */
  public toMCPServerProxies(): Record<string, MCPServerBase> {
    const proxies: Record<string, MCPServerBase> = {};
    for (const serverName of Object.keys(this.serverConfigs)) {
      proxies[serverName] = new MCPClientServerProxy({ name: serverName, id: serverName }, () =>
        this.getConnectedClientForServer(serverName),
      );
    }
    return proxies;
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

  /**
   * Gets the stderr stream of a connected stdio server.
   *
   * Only available for servers using stdio transport with `stderr: 'pipe'`.
   * Returns null if the server is not connected, not using stdio, or stderr is not piped.
   *
   * @param serverName - The name of the server
   * @returns The stderr stream, or null
   */
  public getServerStderr(serverName: string): Stream | null {
    const client = this.mcpClientsById.get(serverName);
    if (!client) return null;
    return client.stderr;
  }

  private getServerConfig(serverName: string): MastraMCPServerDefinition {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server configuration not found for name: ${serverName}`);
    }
    return serverConfig;
  }

  private async getOrCreateClient(name: string, config: MastraMCPServerDefinition): Promise<InternalMastraMCPClient> {
    if (this.disconnectPromise) {
      await this.disconnectPromise;
    }

    const exists = this.mcpClientsById.has(name);
    const existingClient = this.mcpClientsById.get(name);

    this.logger.debug('Checking connected client', { name, exists });

    if (exists) {
      // This is just to satisfy Typescript since technically you could have this.mcpClientsById.set('someKey', undefined);
      // Should never reach this point basically we always create a new MastraMCPClient instance when we add to the Map.
      if (!existingClient) {
        throw new Error(`Client ${name} exists but is undefined`);
      }
      return existingClient;
    }

    const mcpClient = new InternalMastraMCPClient({
      name,
      server: config,
      timeout: config.timeout ?? this.defaultTimeout,
      capabilities: config.capabilities,
    });

    mcpClient.__setLogger(this.logger);

    this.mcpClientsById.set(name, mcpClient);

    return mcpClient;
  }

  private async getConnectedClient(name: string, config: MastraMCPServerDefinition): Promise<InternalMastraMCPClient> {
    this.logger.debug('Connecting to MCP server', { name });

    const mcpClient = await this.getOrCreateClient(name, config);

    try {
      await mcpClient.connect();
    } catch (e) {
      throw this.handleConnectError(name, e);
    }
    this.logger.debug('Connected to MCP server', { name });
    return mcpClient;
  }

  private handleConnectError(name: string, error: unknown): MastraError {
    const mastraError = new MastraError(
      {
        id: 'MCP_CLIENT_CONNECT_FAILED',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.THIRD_PARTY,
        text: `Failed to connect to MCP server ${name}: ${
          error instanceof Error ? error.stack || error.message : String(error)
        }`,
        details: {
          name,
        },
      },
      error,
    );
    this.logger.trackException(mastraError);
    this.logger.error('MCPClient errored connecting to MCP server:', { error: mastraError.toString() });
    // Keep the client when authorization is required: it carries the needs-auth
    // state and the pending transport that authenticate() completes.
    if (!(error instanceof UnauthorizedError)) {
      this.mcpClientsById.delete(name);
    }
    return mastraError;
  }

  private async getConnectedClientForServer(serverName: string): Promise<InternalMastraMCPClient> {
    return this.getConnectedClient(serverName, this.getServerConfig(serverName));
  }

  private async getClientForServer(serverName: string): Promise<InternalMastraMCPClient> {
    return this.getOrCreateClient(serverName, this.getServerConfig(serverName));
  }

  private async getToolsForServer(serverName: string): Promise<Record<string, Tool<any, any, any, any>>> {
    for (let attempt = 1; attempt <= TOOL_DISCOVERY_MAX_ATTEMPTS; attempt++) {
      try {
        const client = await this.getConnectedClientForServer(serverName);
        return await client.tools();
      } catch (error) {
        if (attempt === TOOL_DISCOVERY_MAX_ATTEMPTS || !isReconnectableMCPError(error)) {
          throw error;
        }

        this.logger.debug('Retrying MCP tool discovery after reconnect', {
          serverName,
          attempt,
          maxAttempts: TOOL_DISCOVERY_MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.reconnectServer(serverName);
      }
    }

    return {};
  }
}
