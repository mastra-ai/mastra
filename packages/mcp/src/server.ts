import { isVercelTool, isZodType, resolveSerializedZodOutput } from '@mastra/core';
import type { ToolsInput } from '@mastra/core/agent';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import jsonSchemaToZod from 'json-schema-to-zod';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createLogger } from './logger';

const logger = createLogger();

type ConvertedTool = {
  name: string;
  description?: string;
  inputSchema: any;
  zodSchema: z.ZodTypeAny;
  execute: any;
};

export class MCPServer {
  private server: Server;
  private convertedTools: Record<string, ConvertedTool>;
  private stdioTransport?: StdioServerTransport;
  private sseTransport?: SSEServerTransport;

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
   * Get a read-only view of the registered tools (for testing/introspection).
   */
  tools(): Readonly<Record<string, ConvertedTool>> {
    return this.convertedTools;
  }

  /**
   * Construct a new MCPServer instance.
   * @param opts.name - Server name
   * @param opts.version - Server version
   * @param opts.tools - Tool definitions to register
   */
  constructor({ name, version, tools }: { name: string; version: string; tools: ToolsInput }) {
    this.server = new Server({ name, version }, { capabilities: { tools: {}, logging: { enabled: true } } });
    this.convertedTools = this.convertTools(tools);
    void logger.info(
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
  private convertTools(tools: ToolsInput): Record<string, ConvertedTool> {
    const convertedTools: Record<string, ConvertedTool> = {};
    for (const toolName of Object.keys(tools)) {
      let inputSchema: any;
      let zodSchema: z.ZodTypeAny;
      const toolInstance = tools[toolName];
      if (!toolInstance) {
        void logger.warning(`Tool instance for '${toolName}' is undefined. Skipping.`);
        continue;
      }
      if (typeof toolInstance.execute !== 'function') {
        void logger.warning(`Tool '${toolName}' does not have a valid execute function. Skipping.`);
        continue;
      }
      // Vercel tools: .parameters is either Zod or JSON schema
      if (isVercelTool(toolInstance)) {
        if (isZodType(toolInstance.parameters)) {
          zodSchema = toolInstance.parameters;
          inputSchema = zodToJsonSchema(zodSchema);
        } else if (typeof toolInstance.parameters === 'object') {
          zodSchema = resolveSerializedZodOutput(jsonSchemaToZod(toolInstance.parameters));
          inputSchema = toolInstance.parameters;
        } else {
          zodSchema = z.object({});
          inputSchema = zodToJsonSchema(zodSchema);
        }
      } else {
        // Mastra tools: .inputSchema is always Zod
        zodSchema = toolInstance?.inputSchema ?? z.object({});
        inputSchema = zodToJsonSchema(zodSchema);
      }

      // Wrap execute to support both signatures (typed, returns Promise<any>)
      const execute: (args: any, execOptions?: any) => Promise<any> = async (args, execOptions) => {
        if (isVercelTool(toolInstance)) {
          return (await toolInstance.execute?.(args, execOptions)) ?? undefined;
        }
        return (await toolInstance.execute?.({ context: args }, execOptions)) ?? undefined;
      };
      convertedTools[toolName] = {
        name: toolName,
        description: toolInstance?.description,
        inputSchema,
        zodSchema,
        execute,
      };
      void logger.info(`Registered tool: '${toolName}' [${toolInstance?.description || 'No description'}]`);
    }
    void logger.info(`Total tools registered: ${Object.keys(convertedTools).length}`);
    return convertedTools;
  }

  /**
   * Register the ListTools handler for listing all available tools.
   */
  private registerListToolsHandler() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      await logger.debug('Handling ListTools request');
      return {
        tools: Object.values(this.convertedTools).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });
  }

  /**
   * Register the CallTool handler for executing a tool by name.
   */
  private registerCallToolHandler() {
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const startTime = Date.now();
      try {
        const tool = this.convertedTools[request.params.name];
        if (!tool) {
          await logger.warning(`CallTool: Unknown tool '${request.params.name}' requested.`);
          return {
            content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          };
        }
        await logger.debug(`CallTool: Invoking '${request.params.name}' with arguments:`, request.params.arguments);
        const args = tool.zodSchema.parse(request.params.arguments ?? {});
        const result = await tool.execute(args, request.params);
        const duration = Date.now() - startTime;
        await logger.info(`Tool '${request.params.name}' executed successfully in ${duration}ms.`);
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
          await logger.warning('Invalid tool arguments', {
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
        await logger.error(`Tool execution failed: ${request.params.name}`, error);
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
  async startStdio() {
    this.stdioTransport = new StdioServerTransport();
    await this.server.connect(this.stdioTransport);
    await logger.info('Started MCP Server (stdio)');
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
  async startSSE({
    url,
    ssePath,
    messagePath,
    req,
    res,
  }: {
    url: URL;
    ssePath: string;
    messagePath: string;
    req: any;
    res: any;
  }) {
    if (url.pathname === ssePath) {
      await logger.debug('Received SSE connection');
      this.sseTransport = new SSEServerTransport(messagePath, res);
      await this.server.connect(this.sseTransport);

      this.server.onclose = async () => {
        await this.server.close();
        this.sseTransport = undefined;
      };
      res.on('close', () => {
        this.sseTransport = undefined;
      });
    } else if (url.pathname === messagePath) {
      await logger.debug('Received message');
      if (!this.sseTransport) {
        res.writeHead(503);
        res.end('SSE connection not established');
        return;
      }
      await this.sseTransport.handlePostMessage(req, res);
    } else {
      await logger.debug('Unknown path:', url.pathname);
      res.writeHead(404);
      res.end();
    }
  }
}
