import { MastraBase } from '@mastra/core/base';
import { createTool } from '@mastra/core/tools';
import { jsonSchemaToModel } from '@mastra/core/utils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Protocol } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ClientCapabilities, LoggingLevel, LoggingMessageNotification } from '@modelcontextprotocol/sdk/types.js';
import { CallToolResultSchema, ListResourcesResultSchema } from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';

// Re-export MCP SDK LoggingLevel for convenience
export type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

export interface LogMessage {
  level: LoggingLevel;
  message: string;
  timestamp: Date;
  serverName: string;
  details?: Record<string, any>;
}

export type LogHandler = (logMessage: LogMessage) => void;

type SSEClientParameters = {
  url: URL;
} & ConstructorParameters<typeof SSEClientTransport>[1];

export type MastraMCPServerDefinition = (StdioServerParameters | SSEClientParameters) & {
  log?: LogHandler;
};

// Type guard to check if a Client has onLogMessage method
function hasLogMessageSupport(client: any): client is Client & { 
  onLogMessage: (callback: (message: LoggingMessageNotification) => void) => void 
} {
  return client && typeof client.onLogMessage === 'function';
}

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

export class MastraMCPClient extends MastraBase {
  name: string;
  private transport: Transport;
  private client: Client;
  private readonly timeout: number;
  private logHandler?: LogHandler;
  
  constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
    timeout = DEFAULT_REQUEST_TIMEOUT_MSEC,
  }: {
    name: string;
    server: MastraMCPServerDefinition;
    capabilities?: ClientCapabilities;
    version?: string;
    timeout?: number;
  }) {
    super({ name: 'MastraMCPClient' });
    this.name = name;
    this.timeout = timeout;
    this.logHandler = server.log;

    // Extract log handler from server config to avoid passing it to transport
    const { log, ...serverConfig } = server;

    if (`url` in serverConfig) {
      this.transport = new SSEClientTransport(serverConfig.url, {
        requestInit: serverConfig.requestInit,
        eventSourceInit: serverConfig.eventSourceInit,
      });
    } else {
      this.transport = new StdioClientTransport({
        ...serverConfig,
        // without ...getDefaultEnvironment() commands like npx will fail because there will be no PATH env var
        env: { ...getDefaultEnvironment(), ...(serverConfig.env || {}) },
      });
    }

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
    
    // Log to internal logger
    this.logger[loggerMethod](message, details);
    
    // Send to registered handler if available
    if (this.logHandler) {
      this.logHandler({
        level,
        message,
        timestamp: new Date(),
        serverName: this.name,
        details,
      });
    }
  }
  
  private setupLogging(): void {
    // Check if the client supports logging
    if (hasLogMessageSupport(this.client)) {
      this.client.onLogMessage((message) => {
        // Convert from MCP SDK log message to our log format
        const level = message.params.level as LoggingLevel;
        this.log(level, `MCP server message: ${message.params.data}`, { 
          mcpMessage: message 
        });
      });
    }
  }

  private isConnected = false;

  async connect() {
    if (this.isConnected) return;
    try {
      this.log('debug', `Connecting to MCP server`);
      await this.client.connect(this.transport);
      this.isConnected = true;
      const originalOnClose = this.client.onclose;
      this.client.onclose = () => {
        this.log('debug', `MCP server connection closed`);
        this.isConnected = false;
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
      this.log('info', `Successfully connected to MCP server`);
    } catch (e) {
      this.log('error', `Failed connecting to MCP server`, { 
        error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2)
      });
      this.isConnected = false;
      throw e;
    }
  }

  async disconnect() {
    this.log('debug', `Disconnecting from MCP server`);
    return await this.client.close();
  }

  // TODO: do the type magic to return the right method type. Right now we get infinitely deep infered type errors from Zod without using "any"

  async resources(): Promise<ReturnType<Protocol<any, any, any>['request']>> {
    this.log('debug', `Requesting resources from MCP server`);
    return await this.client.request({ method: 'resources/list' }, ListResourcesResultSchema);
  }

  async tools() {
    this.log('debug', `Requesting tools from MCP server`);
    const { tools } = await this.client.listTools();
    const toolsRes: Record<string, any> = {};
    tools.forEach(tool => {
      this.log('debug', `Processing tool: ${tool.name}`);
      const s = jsonSchemaToModel(tool.inputSchema);
      const mastraTool = createTool({
        id: `${this.name}_${tool.name}`,
        description: tool.description || '',
        inputSchema: s,
        execute: async ({ context }) => {
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
              toolArgs: context
            });
            throw e;
          }
        },
      });

      if (tool.name) {
        toolsRes[tool.name] = mastraTool;
      }
    });

    return toolsRes;
  }
}
