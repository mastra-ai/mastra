import $RefParser from '@apidevtools/json-schema-ref-parser';
import { MastraBase } from '@mastra/core/base';
import type { RuntimeContext } from '@mastra/core/di';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createTool } from '@mastra/core/tools';
import { isZodType } from '@mastra/core/utils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  ClientCapabilities,
  ElicitRequest,
  ElicitResult,
  GetPromptResult,
  ListPromptsResult,
  LoggingLevel,
} from '@modelcontextprotocol/sdk/types.js';
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
} from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';
import { z } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import { convertJsonSchemaToZod as convertJsonSchemaToZodV3 } from 'zod-from-json-schema-v3';
import type { JSONSchema } from 'zod-from-json-schema-v3';
import { ElicitationClientActions } from './elicitationActions';
import { PromptClientActions } from './promptActions';
import { ResourceClientActions } from './resourceActions';

// Re-export MCP SDK LoggingLevel for convenience
export type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

export interface LogMessage {
  level: LoggingLevel;
  message: string;
  timestamp: Date;
  serverName: string;
  details?: Record<string, any>;
  runtimeContext?: RuntimeContext | null;
}

export type LogHandler = (logMessage: LogMessage) => void;

// Elicitation handler type
export type ElicitationHandler = (request: ElicitRequest['params']) => Promise<ElicitResult>;

// Base options common to all server definitions
type BaseServerOptions = {
  logger?: LogHandler;
  timeout?: number;
  capabilities?: ClientCapabilities;
  enableServerLogs?: boolean;
};

type StdioServerDefinition = BaseServerOptions & {
  command: string; // 'command' is required for Stdio
  args?: string[];
  env?: Record<string, string>;

  url?: never; // Exclude 'url' for Stdio
  requestInit?: never; // Exclude HTTP options for Stdio
  eventSourceInit?: never; // Exclude HTTP options for Stdio
  authProvider?: never; // Exclude HTTP options for Stdio
  reconnectionOptions?: never; // Exclude Streamable HTTP specific options
  sessionId?: never; // Exclude Streamable HTTP specific options
};

// HTTP Server Definition (Streamable HTTP or SSE fallback)
type HttpServerDefinition = BaseServerOptions & {
  url: URL; // 'url' is required for HTTP

  command?: never; // Exclude 'command' for HTTP
  args?: never; // Exclude Stdio options for HTTP
  env?: never; // Exclude Stdio options for HTTP

  // Include relevant options from SDK HTTP transport types
  requestInit?: StreamableHTTPClientTransportOptions['requestInit'];
  eventSourceInit?: SSEClientTransportOptions['eventSourceInit'];
  authProvider?: StreamableHTTPClientTransportOptions['authProvider'];
  reconnectionOptions?: StreamableHTTPClientTransportOptions['reconnectionOptions'];
  sessionId?: StreamableHTTPClientTransportOptions['sessionId'];
};

export type MastraMCPServerDefinition = StdioServerDefinition | HttpServerDefinition;

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

export type InternalMastraMCPClientOptions = {
  name: string;
  server: MastraMCPServerDefinition;
  capabilities?: ClientCapabilities;
  version?: string;
  timeout?: number;
};

export class InternalMastraMCPClient extends MastraBase {
  name: string;
  private client: Client;
  private readonly timeout: number;
  private logHandler?: LogHandler;
  private enableServerLogs?: boolean;
  private serverConfig: MastraMCPServerDefinition;
  private transport?: Transport;
  private currentOperationContext: RuntimeContext | null = null;
  public readonly resources: ResourceClientActions;
  public readonly prompts: PromptClientActions;
  public readonly elicitation: ElicitationClientActions;
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

    const clientCapabilities = { ...capabilities, elicitation: {} };

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

    this.resources = new ResourceClientActions({ client: this, logger: this.logger });
    this.prompts = new PromptClientActions({ client: this, logger: this.logger });
    this.elicitation = new ElicitationClientActions({ client: this, logger: this.logger });
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
        runtimeContext: this.currentOperationContext,
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
    const { requestInit, eventSourceInit, authProvider } = this.serverConfig;

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
        });
        await this.client.connect(streamableTransport, {
          timeout:
            // this is hardcoded to 3s because the long default timeout would be extremely slow for sse backwards compat (60s)
            3000,
        });
        this.transport = streamableTransport;
        this.log('debug', 'Successfully connected using Streamable HTTP transport.');
      } catch (error) {
        this.log('debug', `Streamable HTTP transport failed: ${error}`);
        shouldTrySSE = true;
      }
    }

    if (shouldTrySSE) {
      this.log('debug', 'Falling back to deprecated HTTP+SSE transport...');
      try {
        // Fallback to SSE transport
        const sseTransport = new SSEClientTransport(url, { requestInit, eventSourceInit, authProvider });
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

  async connect() {
    // If a connection attempt is in progress, wait for it.
    if (await this.isConnected) {
      return true;
    }

    // Start new connection attempt.
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

    asyncExitHook(
      async () => {
        this.log('debug', `Disconnecting MCP server during exit`);
        await this.disconnect();
      },
      { wait: 5000 },
    );

    process.on('SIGTERM', () => gracefulExit());
    this.log('debug', `Successfully connected to MCP server`);
    return this.isConnected;
  }

  /**
   * Get the current session ID if using the Streamable HTTP transport.
   * Returns undefined if not connected or not using Streamable HTTP.
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
      this.isConnected = Promise.resolve(false);
    }
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

  async tools() {
    this.log('debug', `Requesting tools from MCP server`);
    const { tools } = await this.client.listTools({ timeout: this.timeout });
    const toolsRes: Record<string, any> = {};
    for (const tool of tools) {
      this.log('debug', `Processing tool: ${tool.name}`);
      try {
        const mastraTool = createTool({
          id: `${this.name}_${tool.name}`,
          description: tool.description || '',
          inputSchema: await this.convertInputSchema(tool.inputSchema),
          outputSchema: await this.convertOutputSchema(tool.outputSchema),
          execute: async ({ context, runtimeContext }: { context: any; runtimeContext?: RuntimeContext | null }) => {
            const previousContext = this.currentOperationContext;
            this.currentOperationContext = runtimeContext || null; // Set current context
            try {
              this.log('debug', `Executing tool: ${tool.name}`, { toolArgs: context });
              const res = await this.client.callTool(
                {
                  name: tool.name,
                  arguments: context,
                },
                CallToolResultSchema,
                {
                  timeout: this.timeout,
                },
              );

              this.log('debug', `Tool executed successfully: ${tool.name}`);
              return res;
            } catch (e) {
              this.log('error', `Error calling tool: ${tool.name}`, {
                error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
                toolArgs: context,
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

/**
 * @deprecated MastraMCPClient is deprecated and will be removed in a future release. Please use MCPClient instead.
 */

export class MastraMCPClient extends InternalMastraMCPClient {
  constructor(args: InternalMastraMCPClientOptions) {
    super(args);
    this.logger.warn(
      '[DEPRECATION] MastraMCPClient is deprecated and will be removed in a future release. Please use MCPClient instead.',
    );
  }
}
