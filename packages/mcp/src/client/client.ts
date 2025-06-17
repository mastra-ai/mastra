import { MastraBase } from '@mastra/core/base';

import type { RuntimeContext } from '@mastra/core/di';
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
} from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';
import { z } from 'zod';
import { convertJsonSchemaToZod } from 'zod-from-json-schema';
import type { JSONSchema } from 'zod-from-json-schema';
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

    this.client = new Client(
      {
        name,
        version,
      },
      {
        capabilities,
      },
    );

    // Set up log message capturing
    this.setupLogging();

    this.resources = new ResourceClientActions({ client: this, logger: this.logger });
    this.prompts = new PromptClientActions({ client: this, logger: this.logger });
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
    const { requestInit, eventSourceInit } = this.serverConfig;

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
        const sseTransport = new SSEClientTransport(url, { requestInit, eventSourceInit });
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
    let res: (value: boolean) => void = () => {};
    let rej: (reason?: any) => void = () => {};

    if (this.isConnected === null) {
      this.log('debug', `Creating new isConnected promise`);
      this.isConnected = new Promise<boolean>((resolve, reject) => {
        res = resolve;
        rej = reject;
      });
    } else if (await this.isConnected) {
      this.log('debug', `MCP server already connected`);
      return;
    }

    const { command, url } = this.serverConfig;

    if (command) {
      await this.connectStdio(command).catch(e => {
        rej(e);
      });
    } else if (url) {
      await this.connectHttp(url).catch(e => {
        rej(e);
      });
    } else {
      rej(false);
      throw new Error('Server configuration must include either a command or a url.');
    }

    res(true);
    const originalOnClose = this.client.onclose;
    this.client.onclose = () => {
      this.log('debug', `MCP server connection closed`);
      rej(false);
      if (typeof originalOnClose === `function`) {
        originalOnClose();
      }
    };
    asyncExitHook(
      async () => {
        this.log('debug', `Disconnecting MCP server during exit`);
        await this.disconnect();
      },
      { wait: 5000 },
    );

    process.on('SIGTERM', () => gracefulExit());
    this.log('debug', `Successfully connected to MCP server`);
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

    private convertInputSchema(
    inputSchema: Awaited<ReturnType<Client['listTools']>>['tools'][0]['inputSchema'] | JSONSchema,
  ): z.ZodType {
    if (isZodType(inputSchema)) {
      return inputSchema;
    }

    // Strategy 1: Try original conversion
    try {
      return convertJsonSchemaToZod(inputSchema as JSONSchema);
    } catch (originalError: unknown) {
      this.log('debug', 'Schema conversion failed, trying repair strategies...', {
        originalError: originalError instanceof Error ? originalError.message : String(originalError),
      });

      // Strategy 2: Try to fix known problematic patterns
      const repairedSchema = this.repairCommonSchemaIssues(inputSchema);
      if (JSON.stringify(repairedSchema) !== JSON.stringify(inputSchema)) {
        try {
          const result = convertJsonSchemaToZod(repairedSchema as JSONSchema);
          this.log('info', 'Schema repaired and converted successfully');
          return result;
        } catch (repairError) {
          this.log('debug', 'Schema repair attempt failed');
        }
      }

      // Strategy 3: Try simplified version
      const simplifiedSchema = this.simplifyComplexSchema(inputSchema);
      try {
        const result = convertJsonSchemaToZod(simplifiedSchema as JSONSchema);
        this.log('info', 'Simplified schema converted successfully');
        return result;
      } catch (simplifyError) {
        this.log('debug', 'Simplified schema conversion failed');
      }

      // Strategy 4: Manual conversion for known patterns
      const manualSchema = this.manualSchemaConversion(inputSchema);
      if (manualSchema) {
        this.log('info', 'Manual schema conversion successful');
        return manualSchema;
      }

      // Strategy 5: Last resort - permissive fallback (with strong warnings)
      let errorDetails: string | undefined;
      if (originalError instanceof Error) {
        errorDetails = originalError.stack;
      } else {
        try {
          errorDetails = JSON.stringify(originalError);
        } catch {
          errorDetails = String(originalError);
        }
      }

      this.log('error', 'ALL SCHEMA CONVERSION STRATEGIES FAILED - Using unsafe permissive fallback', {
        originalError: errorDetails,
        originalSchema: inputSchema,
        fallbackUsed: true,
        requiresInvestigation: true,
        warning: 'VALIDATION REDUCED - Parameters will not be type-checked'
      });

      // Return a permissive schema that accepts any object as absolute last resort
      return z.object({}).passthrough();
    }
  }

  // Repair common schema issues that break zod-from-json-schema
  private repairCommonSchemaIssues(schema: any): any {
    const repaired = JSON.parse(JSON.stringify(schema)); // Deep clone

    // Fix 1: Handle missing 'items' in array schemas
    const fixArrayItems = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      if (obj.type === 'array' && !obj.items) {
        this.log('debug', 'Fixing missing array items');
        obj.items = { type: 'string' }; // Safe default
      }

      // Recursively fix nested objects
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          obj[key] = fixArrayItems(obj[key]);
        }
      }

      return obj;
    };

    // Fix 2: Simplify complex anyOf structures
    const simplifyAnyOf = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      if (obj.anyOf && Array.isArray(obj.anyOf)) {
        this.log('debug', 'Simplifying anyOf structure');
        // Take the first option or create a generic object
        const firstOption = obj.anyOf[0];
        if (firstOption && firstOption.type === 'object') {
          return { ...firstOption, anyOf: undefined };
        } else {
          return { type: 'object', additionalProperties: true };
        }
      }

      // Recursively fix nested objects
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          obj[key] = simplifyAnyOf(obj[key]);
        }
      }

      return obj;
    };

    let result = fixArrayItems(repaired);
    result = simplifyAnyOf(result);

    return result;
  }

  // Create a simplified but still type-safe version of complex schemas
  private simplifyComplexSchema(schema: any): any {
    // Extract just the basic structure for validation
    const simplified: any = {
      type: 'object',
      properties: {},
      additionalProperties: true
    };

    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop = value as any;

        // Simplify each property to basic types
        if (prop.type === 'string') {
          simplified.properties[key] = { type: 'string' };
        } else if (prop.type === 'number' || prop.type === 'integer') {
          simplified.properties[key] = { type: 'number' };
        } else if (prop.type === 'boolean') {
          simplified.properties[key] = { type: 'boolean' };
        } else if (prop.type === 'array') {
          simplified.properties[key] = {
            type: 'array',
            items: { type: 'string' } // Safe default
          };
        } else {
          simplified.properties[key] = { type: 'object', additionalProperties: true };
        }
      }
    }

    return simplified;
  }

  // Manual conversion for known DataForSEO patterns
  private manualSchemaConversion(schema: any): z.ZodType | null {
    // Check if this looks like a DataForSEO schema
    const schemaStr = JSON.stringify(schema);

    if (schemaStr.includes('keywords') && schemaStr.includes('location_name')) {
      this.log('debug', 'Applying DataForSEO manual schema conversion');

      return z.object({
        keywords: z.array(z.string()).optional(),
        location_name: z.string().optional(),
        language_name: z.string().optional(),
        filters: z.array(z.any()).optional(),
        // Add other common DataForSEO fields
        limit: z.number().optional(),
        offset: z.number().optional(),
        target: z.string().optional(),
        url: z.string().optional(),
        device: z.string().optional(),
        os: z.string().optional(),
      }).passthrough(); // Allow additional properties
    }

    // Add more manual conversions for other known problematic schemas
    return null;
  }

  async tools() {
    this.log('debug', `Requesting tools from MCP server`);
    const { tools } = await this.client.listTools({ timeout: this.timeout });
    const toolsRes: Record<string, any> = {};
    tools.forEach(tool => {
      this.log('debug', `Processing tool: ${tool.name}`);
      try {
        const mastraTool = createTool({
          id: `${this.name}_${tool.name}`,
          description: tool.description || '',
          inputSchema: this.convertInputSchema(tool.inputSchema),
          execute: async ({ context, runtimeContext }: { context: any; runtimeContext?: RuntimeContext | null }) => {
            const previousContext = this.currentOperationContext;
            this.currentOperationContext = runtimeContext || null; // Set current context
            try {
              // Validate that we have parameters to send
              if (context === undefined || context === null) {
                this.log('warn', `No parameters provided for tool: ${tool.name}`);
              }

              this.log('debug', `Executing tool: ${tool.name}`, {
                toolArgs: context,
                hasArgs: context !== undefined,
                argType: typeof context
              });

              const res = await this.client.callTool(
                {
                  name: tool.name,
                  arguments: context || {}, // Ensure we never send undefined
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
                hasArgs: context !== undefined,
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
    });

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
