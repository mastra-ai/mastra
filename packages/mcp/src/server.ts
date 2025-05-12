import { randomUUID } from 'crypto';
import type * as http from 'node:http';
import type { InternalCoreTool } from '@mastra/core';
import { makeCoreTool } from '@mastra/core';
import type { ToolsInput } from '@mastra/core/agent';
import { MCPServerBase } from '@mastra/core/mcp';
import type { MCPServerSSEOptions, ConvertedTool } from '@mastra/core/mcp';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export class MCPServer extends MCPServerBase {
  private server: Server;
  private stdioTransport?: StdioServerTransport;
  private sseTransport?: SSEServerTransport;
  private streamableHTTPTransport?: StreamableHTTPServerTransport;
  private listToolsHandlerIsRegistered: boolean = false;
  private callToolHandlerIsRegistered: boolean = false;

  /**
   * Get the current stdio transport.
   */
  public getStdioTransport(): StdioServerTransport | undefined {
    return this.stdioTransport;
  }

  /**
   * Get the current SSE transport.
   */
  public getSseTransport(): SSEServerTransport | undefined {
    return this.sseTransport;
  }

  /**
   * Get the current streamable HTTP transport.
   */
  public getStreamableHTTPTransport(): StreamableHTTPServerTransport | undefined {
    return this.streamableHTTPTransport;
  }

  /**
   * Construct a new MCPServer instance.
   * @param opts.name - Server name
   * @param opts.version - Server version
   * @param opts.tools - Tool definitions to register
   */
  constructor({ name, version, tools }: { name: string; version: string; tools: ToolsInput }) {
    super({ name, version, tools });

    this.server = new Server({ name, version }, { capabilities: { tools: {}, logging: { enabled: true } } });

    this.logger.info(
      `Initialized MCPServer '${name}' v${version} with tools: ${Object.keys(this.convertedTools).join(', ')}`,
    );

    this.registerListToolsHandler();
    this.registerCallToolHandler();
  }

  /**
   * Convert and validate all provided tools, logging registration status.
   * @param tools Tool definitions
   * @returns Converted tools registry
   */
  convertTools(tools: ToolsInput): Record<string, ConvertedTool> {
    const convertedTools: Record<string, ConvertedTool> = {};
    for (const toolName of Object.keys(tools)) {
      const toolInstance = tools[toolName];
      if (!toolInstance) {
        this.logger.warn(`Tool instance for '${toolName}' is undefined. Skipping.`);
        continue;
      }

      if (typeof toolInstance.execute !== 'function') {
        this.logger.warn(`Tool '${toolName}' does not have a valid execute function. Skipping.`);
        continue;
      }

      const options = {
        name: toolName,
        runtimeContext: new RuntimeContext(),
        mastra: this.mastra,
        logger: this.logger,
        description: toolInstance?.description,
      };

      const coreTool = makeCoreTool(toolInstance, options) as InternalCoreTool;

      convertedTools[toolName] = {
        name: toolName,
        description: coreTool.description,
        parameters: coreTool.parameters,
        execute: coreTool.execute,
      };
      this.logger.info(`Registered tool: '${toolName}' [${toolInstance?.description || 'No description'}]`);
    }
    this.logger.info(`Total tools registered: ${Object.keys(convertedTools).length}`);
    return convertedTools;
  }

  /**
   * Register the ListTools handler for listing all available tools.
   */
  private registerListToolsHandler() {
    if (this.listToolsHandlerIsRegistered) {
      return;
    }
    this.listToolsHandlerIsRegistered = true;
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling ListTools request');
      return {
        tools: Object.values(this.convertedTools).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters.jsonSchema,
        })),
      };
    });
  }

  /**
   * Register the CallTool handler for executing a tool by name.
   */
  private registerCallToolHandler() {
    if (this.callToolHandlerIsRegistered) {
      return;
    }
    this.callToolHandlerIsRegistered = true;
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const startTime = Date.now();
      try {
        const tool = this.convertedTools[request.params.name];
        if (!tool) {
          this.logger.warn(`CallTool: Unknown tool '${request.params.name}' requested.`);
          return {
            content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          };
        }

        this.logger.debug(`CallTool: Invoking '${request.params.name}' with arguments:`, request.params.arguments);

        const validation = tool.parameters.validate?.(request.params.arguments ?? {});
        if (validation && !validation.success) {
          this.logger.warn(`CallTool: Invalid tool arguments for '${request.params.name}'`, {
            errors: validation.error,
          });
          return {
            content: [{ type: 'text', text: `Invalid tool arguments: ${JSON.stringify(validation.error)}` }],
            isError: true,
          };
        }
        if (!tool.execute) {
          this.logger.warn(`CallTool: Tool '${request.params.name}' does not have an execute function.`);
          return {
            content: [{ type: 'text', text: `Tool '${request.params.name}' does not have an execute function.` }],
            isError: true,
          };
        }

        const result = await tool.execute(validation?.value, { messages: [], toolCallId: '' });
        const duration = Date.now() - startTime;
        this.logger.info(`Tool '${request.params.name}' executed successfully in ${duration}ms.`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
          isError: false,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        if (error instanceof z.ZodError) {
          this.logger.warn('Invalid tool arguments', {
            tool: request.params.name,
            errors: error.errors,
            duration: `${duration}ms`,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
              },
            ],
            isError: true,
          };
        }
        this.logger.error(`Tool execution failed: ${request.params.name}`, { error });
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    });
  }

  /**
   * Start the MCP server using stdio transport (for Windsurf integration).
   */
  public async startStdio(): Promise<void> {
    this.stdioTransport = new StdioServerTransport();
    await this.server.connect(this.stdioTransport);
    this.logger.info('Started MCP Server (stdio)');
  }

  /**
   * Handles MCP-over-SSE protocol for user-provided HTTP servers.
   * Call this from your HTTP server for both the SSE and message endpoints.
   *
   * @param url Parsed URL of the incoming request
   * @param ssePath Path for establishing the SSE connection (e.g. '/sse')
   * @param messagePath Path for POSTing client messages (e.g. '/message')
   * @param req Incoming HTTP request
   * @param res HTTP response (must support .write/.end)
   */
  public async startSSE({ url, ssePath, messagePath, req, res }: MCPServerSSEOptions): Promise<void> {
    if (url.pathname === ssePath) {
      await this.connectSSE({
        messagePath,
        res,
      });
    } else if (url.pathname === messagePath) {
      this.logger.debug('Received message');
      if (!this.sseTransport) {
        res.writeHead(503);
        res.end('SSE connection not established');
        return;
      }
      await this.sseTransport.handlePostMessage(req, res);
    } else {
      this.logger.debug('Unknown path:', { path: url.pathname });
      res.writeHead(404);
      res.end();
    }
  }

  /**
   * Handles MCP-over-StreamableHTTP protocol for user-provided HTTP servers.
   * Call this from your HTTP server for the streamable HTTP endpoint.
   *
   * @param url Parsed URL of the incoming request
   * @param httpPath Path for establishing the streamable HTTP connection (e.g. '/mcp')
   * @param req Incoming HTTP request
   * @param res HTTP response (must support .write/.end)
   * @param options Optional options to pass to the transport (e.g. sessionIdGenerator)
   */
  public async startHTTP({
    url,
    httpPath,
    req,
    res,
    options = { sessionIdGenerator: () => randomUUID() },
  }: {
    url: URL;
    httpPath: string;
    req: http.IncomingMessage;
    res: http.ServerResponse<http.IncomingMessage>;
    options?: StreamableHTTPServerTransportOptions;
  }) {
    if (url.pathname === httpPath) {
      this.streamableHTTPTransport = new StreamableHTTPServerTransport(options);
      try {
        await this.server.connect(this.streamableHTTPTransport);
      } catch (error) {
        this.logger.error('Error connecting to MCP server', { error });
        res.writeHead(500);
        res.end('Error connecting to MCP server');
        return;
      }

      try {
        await this.streamableHTTPTransport.handleRequest(req, res);
      } catch (error) {
        this.logger.error('Error handling MCP connection', { error });
        res.writeHead(500);
        res.end('Error handling MCP connection');
        return;
      }

      this.server.onclose = async () => {
        this.streamableHTTPTransport = undefined;
        await this.server.close();
      };

      res.on('close', () => {
        this.streamableHTTPTransport = undefined;
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  }

  public async handlePostMessage(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage>) {
    if (!this.sseTransport) {
      res.writeHead(503);
      res.end('SSE connection not established');
      return;
    }
    await this.sseTransport.handlePostMessage(req, res);
  }

  public async connectSSE({
    messagePath,
    res,
  }: {
    messagePath: string;
    res: http.ServerResponse<http.IncomingMessage>;
  }) {
    this.logger.debug('Received SSE connection');
    this.sseTransport = new SSEServerTransport(messagePath, res);
    await this.server.connect(this.sseTransport);

    this.server.onclose = async () => {
      this.sseTransport = undefined;
      await this.server.close();
    };

    res.on('close', () => {
      this.sseTransport = undefined;
    });
  }

  /**
   * Close the MCP server and all its connections
   */
  async close() {
    this.callToolHandlerIsRegistered = false;
    this.listToolsHandlerIsRegistered = false;
    try {
      if (this.stdioTransport) {
        await this.stdioTransport.close?.();
        this.stdioTransport = undefined;
      }
      if (this.sseTransport) {
        await this.sseTransport.close?.();
        this.sseTransport = undefined;
      }
      if (this.streamableHTTPTransport) {
        await this.streamableHTTPTransport.close?.();
        this.streamableHTTPTransport = undefined;
      }
      await this.server.close();
      this.logger.info('MCP server closed.');
    } catch (error) {
      this.logger.error('Error closing MCP server:', { error });
    }
  }
}
