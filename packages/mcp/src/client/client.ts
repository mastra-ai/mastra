import $RefParser from '@apidevtools/json-schema-ref-parser';
import { MastraBase } from '@mastra/core/base';
import type { RequestContext } from '@mastra/core/di';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { isZodType } from '@mastra/core/utils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { GetPromptResult, ListPromptsResult, LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ListResourceTemplatesResultSchema,
  ListPromptsResultSchema,
  GetPromptResultSchema,
  PromptListChangedNotificationSchema,
  ElicitRequestSchema,
  ProgressNotificationSchema,
  ListRootsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';
import { z } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import { convertJsonSchemaToZod as convertJsonSchemaToZodV3 } from 'zod-from-json-schema-v3';
import type { JSONSchema } from 'zod-from-json-schema-v3';
import { ElicitationClientActions } from './actions/elicitation';
import { ProgressClientActions } from './actions/progress';
import { PromptClientActions } from './actions/prompt';
import { ResourceClientActions } from './actions/resource';
import type {
  LogHandler,
  ElicitationHandler,
  ProgressHandler,
  MastraMCPServerDefinition,
  InternalMastraMCPClientOptions,
  Root,
} from './types';

// Re-export types for convenience
export type {
  LoggingLevel,
  LogMessage,
  LogHandler,
  ElicitationHandler,
  ProgressHandler,
  MastraMCPServerDefinition,
  InternalMastraMCPClientOptions,
  Root,
} from './types';

const DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC = 3000;

// Per MCP spec, only fallback to SSE for these status codes
const SSE_FALLBACK_STATUS_CODES = [400, 404, 405];

/**
 * Convert an MCP LoggingLevel to a logger method name that exists in our logger
 */
function convertLogLevelToLoggerMethod(level: LoggingLevel): 'debug' | 'info' | 'warn' | 'error' {
  switch (level) {
    case 'debug':
      return 'debug';
    case 'info':
    case 'notice':
      return 'info';
    case 'warning':
      return 'warn';
    case 'error':
    case 'critical':
    case 'alert':
    case 'emergency':
      return 'error';
    default:
      // For any other levels, default to info
      return 'info';
  }
}

/**
 * Internal MCP client implementation for connecting to a single MCP server.
 *
 * This class handles the low-level connection, transport management, and protocol
 * communication with an MCP server. Most users should use MCPClient instead.
 *
 * @internal
 */
export class InternalMastraMCPClient extends MastraBase {
  name: string;
  private client: Client;
  private readonly timeout: number;
  private logHandler?: LogHandler;
  private enableServerLogs?: boolean;
  private enableProgressTracking?: boolean;
  private serverConfig: MastraMCPServerDefinition;
  private transport?: Transport;
  private currentOperationContext: RequestContext | null = null;
  private exitHookUnsubscribe?: () => void;
  private sigTermHandler?: () => void;
  private _roots: Root[];

  /** Provides access to resource operations (list, read, subscribe, etc.) */
  public readonly resources: ResourceClientActions;
  /** Provides access to prompt operations (list, get, notifications) */
  public readonly prompts: PromptClientActions;
  /** Provides access to elicitation operations (request handling) */
  public readonly elicitation: ElicitationClientActions;
  /** Provides access to progress operations (notifications) */
  public readonly progress: ProgressClientActions;

  /**
   * @internal
   */
  constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
    timeout = DEFAULT_REQUEST_TIMEOUT_MSEC,
  }: InternalMastraMCPClientOptions) {
    super({ name: 'MastraMCPClient' });
    this.name = name;
    this.timeout = timeout;
    this.logHandler = server.logger;
    this.enableServerLogs = server.enableServerLogs ?? true;
    this.serverConfig = server;
    this.enableProgressTracking = !!server.enableProgressTracking;

    // Initialize roots from server config
    this._roots = server.roots ?? [];

    // Build client capabilities, automatically enabling roots if configured
    const hasRoots = this._roots.length > 0 || !!capabilities.roots;
    const clientCapabilities = {
      ...capabilities,
      elicitation: {},
      // Auto-enable roots capability if roots are provided
      ...(hasRoots ? { roots: { listChanged: true, ...(capabilities.roots ?? {}) } } : {}),
    };

    this.client = new Client(
      {
        name,
        version,
      },
      {
        capabilities: clientCapabilities,
      },
    );

    // Set up log message capturing
    this.setupLogging();

    // Set up roots/list request handler if roots capability is enabled
    if (hasRoots) {
      this.setupRootsHandler();
    }

    this.resources = new ResourceClientActions({ client: this, logger: this.logger });
    this.prompts = new PromptClientActions({ client: this, logger: this.logger });
    this.elicitation = new ElicitationClientActions({ client: this, logger: this.logger });
    this.progress = new ProgressClientActions({ client: this, logger: this.logger });
  }

  /**
   * Log a message at the specified level
   * @param level Log level
   * @param message Log message
   * @param details Optional additional details
   */
  private log(level: LoggingLevel, message: string, details?: Record<string, any>): void {
    // Convert MCP logging level to our logger method
    const loggerMethod = convertLogLevelToLoggerMethod(level);

    const msg = `[${this.name}] ${message}`;

    // Log to internal logger
    this.logger[loggerMethod](msg, details);

    // Send to registered handler if available
    if (this.logHandler) {
      this.logHandler({
        level,
        message: msg,
        timestamp: new Date(),
        serverName: this.name,
        details,
        requestContext: this.currentOperationContext,
      });
    }
  }

  private setupLogging(): void {
    if (this.enableServerLogs) {
      this.client.setNotificationHandler(
        z.object({
          method: z.literal('notifications/message'),
          params: z
            .object({
              level: z.string(),
            })
            .passthrough(),
        }),
        notification => {
          const { level, ...params } = notification.params;
          this.log(level as LoggingLevel, '[MCP SERVER LOG]', params);
        },
      );
    }
  }

  /**
   * Set up handler for roots/list requests from the server.
   *
   * Per MCP spec (https://modelcontextprotocol.io/specification/2025-11-25/client/roots):
   * When a server sends a roots/list request, the client responds with the configured roots.
   */
  private setupRootsHandler(): void {
    this.log('debug', 'Setting up roots/list request handler');
    this.client.setRequestHandler(ListRootsRequestSchema, async () => {
      this.log('debug', `Responding to roots/list request with ${this._roots.length} roots`);
      return { roots: this._roots };
    });
  }

  /**
   * Get the currently configured roots.
   *
   * @returns Array of configured filesystem roots
   */
  get roots(): Root[] {
    return [...this._roots];
  }

  /**
   * Update the list of filesystem roots and notify the server.
   *
   * Per MCP spec, when roots change, the client sends a `notifications/roots/list_changed`
   * notification to inform the server that it should re-fetch the roots list.
   *
   * @param roots - New list of filesystem roots
   *
   * @example
   * ```typescript
   * await client.setRoots([
   *   { uri: 'file:///home/user/projects', name: 'Projects' },
   *   { uri: 'file:///tmp', name: 'Temp' }
   * ]);
   * ```
   */
  async setRoots(roots: Root[]): Promise<void> {
    this.log('debug', `Updating roots to ${roots.length} entries`);
    this._roots = [...roots];
    await this.sendRootsListChanged();
  }

  /**
   * Send a roots/list_changed notification to the server.
   *
   * Per MCP spec, clients that support `listChanged` MUST send this notification
   * when the list of roots changes. The server will then call roots/list to get
   * the updated list.
   */
  async sendRootsListChanged(): Promise<void> {
    if (!this.transport) {
      this.log('debug', 'Cannot send roots/list_changed: not connected');
      return;
    }
    this.log('debug', 'Sending notifications/roots/list_changed');
    await this.client.notification({ method: 'notifications/roots/list_changed' });
  }

  private async connectStdio(command: string) {
    this.log('debug', `Using Stdio transport for command: ${command}`);
    try {
      this.transport = new StdioClientTransport({
        command,
        args: this.serverConfig.args,
        env: { ...getDefaultEnvironment(), ...(this.serverConfig.env || {}) },
      });
      await this.client.connect(this.transport, { timeout: this.serverConfig.timeout ?? this.timeout });
      this.log('debug', `Successfully connected to MCP server via Stdio`);
    } catch (e) {
      this.log('error', e instanceof Error ? e.stack || e.message : JSON.stringify(e));
      throw e;
    }
  }

  private async connectHttp(url: URL) {
    const { requestInit, eventSourceInit, authProvider, connectTimeout, fetch } = this.serverConfig;

    this.log('debug', `Attempting to connect to URL: ${url}`);

    // Assume /sse means sse.
    let shouldTrySSE = url.pathname.endsWith(`/sse`);

    if (!shouldTrySSE) {
      try {
        // Try Streamable HTTP transport first
        this.log('debug', 'Trying Streamable HTTP transport...');
        const streamableTransport = new StreamableHTTPClientTransport(url, {
          requestInit,
          reconnectionOptions: this.serverConfig.reconnectionOptions,
          authProvider: authProvider,
          fetch,
        });
        await this.client.connect(streamableTransport, {
          timeout: connectTimeout ?? DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC,
        });
        this.transport = streamableTransport;
        this.log('debug', 'Successfully connected using Streamable HTTP transport.');
      } catch (error: any) {
        this.log('debug', `Streamable HTTP transport failed: ${error}`);

        // @modelcontextprotocol/sdk 1.24.0+ throws StreamableHTTPError with 'code' property
        // Older @modelcontextprotocol/sdk: fallback to SSE (legacy behavior)
        const status = error?.code;
        if (status !== undefined && !SSE_FALLBACK_STATUS_CODES.includes(status)) {
          throw error;
        }
        shouldTrySSE = true;
      }
    }

    if (shouldTrySSE) {
      this.log('debug', 'Falling back to deprecated HTTP+SSE transport...');
      try {
        // Fallback to SSE transport
        // If fetch is provided, ensure it's also in eventSourceInit for the EventSource connection
        // The top-level fetch is used for POST requests, but eventSourceInit.fetch is needed for the SSE stream
        const sseEventSourceInit = fetch ? { ...eventSourceInit, fetch } : eventSourceInit;

        const sseTransport = new SSEClientTransport(url, {
          requestInit,
          eventSourceInit: sseEventSourceInit,
          authProvider,
          fetch,
        });
        await this.client.connect(sseTransport, { timeout: this.serverConfig.timeout ?? this.timeout });
        this.transport = sseTransport;
        this.log('debug', 'Successfully connected using deprecated HTTP+SSE transport.');
      } catch (sseError) {
        this.log(
          'error',
          `Failed to connect with SSE transport after failing to connect to Streamable HTTP transport first. SSE error: ${sseError}`,
        );
        throw new Error('Could not connect to server with any available HTTP transport');
      }
    }
  }

  private isConnected: Promise<boolean> | null = null;

  /**
   * Connects to the MCP server using the configured transport.
   *
   * Automatically detects transport type based on configuration (stdio vs HTTP).
   * Safe to call multiple times - returns existing connection if already connected.
   *
   * @returns Promise resolving to true when connected
   * @throws {MastraError} If connection fails
   *
   * @internal
   */
  async connect() {
    if (this.isConnected) {
      return this.isConnected;
    }

    this.isConnected = new Promise<boolean>(async (resolve, reject) => {
      try {
        const { command, url } = this.serverConfig;

        if (command) {
          await this.connectStdio(command);
        } else if (url) {
          await this.connectHttp(url);
        } else {
          throw new Error('Server configuration must include either a command or a url.');
        }

        resolve(true);

        // Set up disconnect handler to reset state.
        const originalOnClose = this.client.onclose;
        this.client.onclose = () => {
          this.log('debug', `MCP server connection closed`);
          this.isConnected = null;
          if (typeof originalOnClose === 'function') {
            originalOnClose();
          }
        };
      } catch (e) {
        this.isConnected = null;
        reject(e);
      }
    });

    // Only register exit hooks if not already registered
    if (!this.exitHookUnsubscribe) {
      this.exitHookUnsubscribe = asyncExitHook(
        async () => {
          this.log('debug', `Disconnecting MCP server during exit`);
          await this.disconnect();
        },
        { wait: 5000 },
      );
    }

    if (!this.sigTermHandler) {
      this.sigTermHandler = () => gracefulExit();
      process.on('SIGTERM', this.sigTermHandler);
    }

    this.log('debug', `Successfully connected to MCP server`);
    return this.isConnected;
  }

  /**
   * Gets the current session ID if using Streamable HTTP transport.
   *
   * Returns undefined if not connected or not using Streamable HTTP transport.
   *
   * @returns Session ID string or undefined
   *
   * @internal
   */
  get sessionId(): string | undefined {
    if (this.transport instanceof StreamableHTTPClientTransport) {
      return this.transport.sessionId;
    }
    return undefined;
  }

  async disconnect() {
    if (!this.transport) {
      this.log('debug', 'Disconnect called but no transport was connected.');
      return;
    }
    this.log('debug', `Disconnecting from MCP server`);
    try {
      await this.transport.close();
      this.log('debug', 'Successfully disconnected from MCP server');
    } catch (e) {
      this.log('error', 'Error during MCP server disconnect', {
        error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
      });
      throw e;
    } finally {
      this.transport = undefined;
      this.isConnected = null;

      // Clean up exit hooks to prevent memory leaks
      if (this.exitHookUnsubscribe) {
        this.exitHookUnsubscribe();
        this.exitHookUnsubscribe = undefined;
      }
      if (this.sigTermHandler) {
        process.off('SIGTERM', this.sigTermHandler);
        this.sigTermHandler = undefined;
      }
    }
  }

  /**
   * Checks if an error indicates a session invalidation that requires reconnection.
   *
   * Common session-related errors include:
   * - "No valid session ID provided" (HTTP 400)
   * - "Server not initialized" (HTTP 400)
   * - "Not connected" (protocol state error)
   * - Connection refused errors
   *
   * @param error - The error to check
   * @returns true if the error indicates a session problem requiring reconnection
   *
   * @internal
   */
  private isSessionError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();

    // Check for session-related error patterns
    return (
      errorMessage.includes('no valid session') ||
      errorMessage.includes('session') ||
      errorMessage.includes('server not initialized') ||
      errorMessage.includes('not connected') ||
      errorMessage.includes('http 400') ||
      errorMessage.includes('http 401') ||
      errorMessage.includes('http 403') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connection refused')
    );
  }

  /**
   * Forces a reconnection to the MCP server by disconnecting and reconnecting.
   *
   * This is useful when the session becomes invalid (e.g., after server restart)
   * and the client needs to establish a fresh connection.
   *
   * @returns Promise resolving when reconnection is complete
   * @throws {Error} If reconnection fails
   *
   * @internal
   */
  async forceReconnect(): Promise<void> {
    this.log('debug', 'Forcing reconnection to MCP server...');

    // Disconnect current connection (ignore errors as connection may already be broken)
    try {
      if (this.transport) {
        await this.transport.close();
      }
    } catch (e) {
      this.log('debug', 'Error during force disconnect (ignored)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Reset connection state
    this.transport = undefined;
    this.isConnected = null;

    // Reconnect
    await this.connect();
    this.log('debug', 'Successfully reconnected to MCP server');
  }

  async listResources() {
    this.log('debug', `Requesting resources from MCP server`);
    return await this.client.request({ method: 'resources/list' }, ListResourcesResultSchema, {
      timeout: this.timeout,
    });
  }

  async readResource(uri: string) {
    this.log('debug', `Reading resource from MCP server: ${uri}`);
    return await this.client.request({ method: 'resources/read', params: { uri } }, ReadResourceResultSchema, {
      timeout: this.timeout,
    });
  }

  async subscribeResource(uri: string) {
    this.log('debug', `Subscribing to resource on MCP server: ${uri}`);
    return await this.client.request({ method: 'resources/subscribe', params: { uri } }, z.object({}), {
      timeout: this.timeout,
    });
  }

  async unsubscribeResource(uri: string) {
    this.log('debug', `Unsubscribing from resource on MCP server: ${uri}`);
    return await this.client.request({ method: 'resources/unsubscribe', params: { uri } }, z.object({}), {
      timeout: this.timeout,
    });
  }

  async listResourceTemplates() {
    this.log('debug', `Requesting resource templates from MCP server`);
    return await this.client.request({ method: 'resources/templates/list' }, ListResourceTemplatesResultSchema, {
      timeout: this.timeout,
    });
  }

  /**
   * Fetch the list of available prompts from the MCP server.
   */
  async listPrompts(): Promise<ListPromptsResult> {
    this.log('debug', `Requesting prompts from MCP server`);
    return await this.client.request({ method: 'prompts/list' }, ListPromptsResultSchema, {
      timeout: this.timeout,
    });
  }

  /**
   * Get a prompt and its dynamic messages from the server.
   * @param name The prompt name
   * @param args Arguments for the prompt
   * @param version (optional) The prompt version to retrieve
   */
  async getPrompt({
    name,
    args,
    version,
  }: {
    name: string;
    args?: Record<string, any>;
    version?: string;
  }): Promise<GetPromptResult> {
    this.log('debug', `Requesting prompt from MCP server: ${name}`);
    return await this.client.request(
      { method: 'prompts/get', params: { name, arguments: args, version } },
      GetPromptResultSchema,
      { timeout: this.timeout },
    );
  }

  /**
   * Register a handler to be called when the prompt list changes on the server.
   * Use this to refresh cached prompt lists in the client/UI if needed.
   */
  setPromptListChangedNotificationHandler(handler: () => void): void {
    this.log('debug', 'Setting prompt list changed notification handler');
    this.client.setNotificationHandler(PromptListChangedNotificationSchema, () => {
      handler();
    });
  }

  setResourceUpdatedNotificationHandler(
    handler: (params: z.infer<typeof ResourceUpdatedNotificationSchema>['params']) => void,
  ): void {
    this.log('debug', 'Setting resource updated notification handler');
    this.client.setNotificationHandler(ResourceUpdatedNotificationSchema, notification => {
      handler(notification.params);
    });
  }

  setResourceListChangedNotificationHandler(handler: () => void): void {
    this.log('debug', 'Setting resource list changed notification handler');
    this.client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      handler();
    });
  }

  setElicitationRequestHandler(handler: ElicitationHandler): void {
    this.log('debug', 'Setting elicitation request handler');
    this.client.setRequestHandler(ElicitRequestSchema, async request => {
      this.log('debug', `Received elicitation request: ${request.params.message}`);
      return handler(request.params);
    });
  }

  setProgressNotificationHandler(handler: ProgressHandler): void {
    this.log('debug', 'Setting progress notification handler');
    this.client.setNotificationHandler(ProgressNotificationSchema, notification => {
      handler(notification.params);
    });
  }

  private async convertInputSchema(
    inputSchema: Awaited<ReturnType<Client['listTools']>>['tools'][0]['inputSchema'] | JSONSchema,
  ): Promise<z.ZodType> {
    if (isZodType(inputSchema)) {
      return inputSchema;
    }

    try {
      await $RefParser.dereference(inputSchema);
      const jsonSchemaToConvert = ('jsonSchema' in inputSchema ? inputSchema.jsonSchema : inputSchema) as JSONSchema;
      if ('toJSONSchema' in z) {
        //@ts-expect-error - zod type issue
        return convertJsonSchemaToZod(jsonSchemaToConvert);
      } else {
        return convertJsonSchemaToZodV3(jsonSchemaToConvert);
      }
    } catch (error: unknown) {
      let errorDetails: string | undefined;
      if (error instanceof Error) {
        errorDetails = error.stack;
      } else {
        // Attempt to stringify, fallback to String()
        try {
          errorDetails = JSON.stringify(error);
        } catch {
          errorDetails = String(error);
        }
      }
      this.log('error', 'Failed to convert JSON schema to Zod schema using zodFromJsonSchema', {
        error: errorDetails,
        originalJsonSchema: inputSchema,
      });

      throw new MastraError({
        id: 'MCP_TOOL_INPUT_SCHEMA_CONVERSION_FAILED',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        details: { error: errorDetails ?? 'Unknown error' },
      });
    }
  }

  private async convertOutputSchema(
    outputSchema: Awaited<ReturnType<Client['listTools']>>['tools'][0]['outputSchema'] | JSONSchema,
  ): Promise<z.ZodType | undefined> {
    if (!outputSchema) return;
    if (isZodType(outputSchema)) {
      return outputSchema;
    }

    try {
      await $RefParser.dereference(outputSchema);
      const jsonSchemaToConvert = ('jsonSchema' in outputSchema ? outputSchema.jsonSchema : outputSchema) as JSONSchema;
      if ('toJSONSchema' in z) {
        //@ts-expect-error - zod type issue
        return convertJsonSchemaToZod(jsonSchemaToConvert);
      } else {
        return convertJsonSchemaToZodV3(jsonSchemaToConvert);
      }
    } catch (error: unknown) {
      let errorDetails: string | undefined;
      if (error instanceof Error) {
        errorDetails = error.stack;
      } else {
        // Attempt to stringify, fallback to String()
        try {
          errorDetails = JSON.stringify(error);
        } catch {
          errorDetails = String(error);
        }
      }
      this.log('error', 'Failed to convert JSON schema to Zod schema using zodFromJsonSchema', {
        error: errorDetails,
        originalJsonSchema: outputSchema,
      });

      throw new MastraError({
        id: 'MCP_TOOL_OUTPUT_SCHEMA_CONVERSION_FAILED',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        details: { error: errorDetails ?? 'Unknown error' },
      });
    }
  }

  async tools(): Promise<Record<string, Tool<any, any, any, any>>> {
    this.log('debug', `Requesting tools from MCP server`);
    const { tools } = await this.client.listTools({}, { timeout: this.timeout });
    const toolsRes: Record<string, Tool<any, any, any, any>> = {};
    for (const tool of tools) {
      this.log('debug', `Processing tool: ${tool.name}`);
      try {
        const mastraTool = createTool({
          id: `${this.name}_${tool.name}`,
          description: tool.description || '',
          inputSchema: await this.convertInputSchema(tool.inputSchema),
          outputSchema: await this.convertOutputSchema(tool.outputSchema),
          execute: async (input: any, context?: { requestContext?: RequestContext | null; runId?: string }) => {
            const previousContext = this.currentOperationContext;
            this.currentOperationContext = context?.requestContext || null; // Set current context

            const executeToolCall = async () => {
              this.log('debug', `Executing tool: ${tool.name}`, { toolArgs: input, runId: context?.runId });
              const res = await this.client.callTool(
                {
                  name: tool.name,
                  arguments: input,
                  // Use runId as progress token if available, otherwise generate a random UUID
                  ...(this.enableProgressTracking
                    ? { _meta: { progressToken: context?.runId || crypto.randomUUID() } }
                    : {}),
                },
                CallToolResultSchema,
                {
                  timeout: this.timeout,
                },
              );

              this.log('debug', `Tool executed successfully: ${tool.name}`);

              // When a tool has an outputSchema, return the structuredContent directly
              // so that output validation works correctly
              if (res.structuredContent !== undefined) {
                return res.structuredContent;
              }

              // When the tool has an outputSchema but the server didn't return
              // structuredContent (e.g. older MCP protocol versions that predate the
              // structuredContent spec), extract the result from the content array.
              // Without this, the raw CallToolResult envelope ({ content, isError,
              // _meta }) gets validated against the outputSchema and Zod strips all
              // unrecognised keys, producing {}.
              if (tool.outputSchema && !res.isError) {
                const content = res.content as Array<{ type: string; text?: string }> | undefined;
                if (content && content.length === 1 && content[0]!.type === 'text' && content[0]!.text !== undefined) {
                  try {
                    return JSON.parse(content[0]!.text);
                  } catch {
                    return content[0]!.text;
                  }
                }
              }

              return res;
            };

            try {
              return await executeToolCall();
            } catch (e) {
              // Check if this is a session-related error that requires reconnection
              if (this.isSessionError(e)) {
                this.log('debug', `Session error detected for tool ${tool.name}, attempting reconnection...`, {
                  error: e instanceof Error ? e.message : String(e),
                });

                try {
                  // Force reconnection
                  await this.forceReconnect();

                  // Retry the tool call with fresh connection
                  this.log('debug', `Retrying tool ${tool.name} after reconnection...`);
                  return await executeToolCall();
                } catch (reconnectError) {
                  this.log('error', `Reconnection or retry failed for tool ${tool.name}`, {
                    originalError: e instanceof Error ? e.message : String(e),
                    reconnectError: reconnectError instanceof Error ? reconnectError.stack : String(reconnectError),
                    toolArgs: input,
                  });
                  // Throw the original error if reconnection/retry fails
                  throw e;
                }
              }

              // For non-session errors, log and rethrow
              this.log('error', `Error calling tool: ${tool.name}`, {
                error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
                toolArgs: input,
              });
              throw e;
            } finally {
              this.currentOperationContext = previousContext; // Restore previous context
            }
          },
        });

        if (tool.name) {
          toolsRes[tool.name] = mastraTool;
        }
      } catch (toolCreationError: unknown) {
        // Catch errors during tool creation itself (e.g., if createTool has issues)
        this.log('error', `Failed to create Mastra tool wrapper for MCP tool: ${tool.name}`, {
          error: toolCreationError instanceof Error ? toolCreationError.stack : String(toolCreationError),
          mcpToolDefinition: tool,
        });
      }
    }

    return toolsRes;
  }
}
