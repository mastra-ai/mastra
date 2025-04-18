import { isVercelTool, isZodType, resolveSerializedZodOutput } from '@mastra/core';
import type { ToolsInput } from '@mastra/core/agent';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import jsonSchemaToZod from 'json-schema-to-zod';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createLogger } from './logger';

const logger = createLogger();

/**
 * Create a reusable MCP server for Mastra tools.
 * @param {Object} opts
 * @param {string} opts.name - Server name
 * @param {string} opts.version - Server version
 * @param {Array} opts.tools - List of tools (name, description, inputSchema, execute)
 * @returns {Object} - { server, startStdio }
 */
export function createMCPServer({ name, version, tools }: { name: string; version: string; tools: ToolsInput }) {
  const server = new Server({ name, version }, { capabilities: { tools: {}, logging: { enabled: true } } });

  // Build an object keyed by tool name, each value with name, description, inputSchema (zod), inputSchemaJson, and execute
  const convertedTools: Record<
    string,
    {
      name: string;
      description?: string;
      inputSchema: any;
      zodSchema: z.ZodTypeAny;
      execute: any;
    }
  > = {};
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

    // Wrap execute to support both signatures
    const execute = async (args: any, execOptions?: any) => {
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
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.values(convertedTools).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const startTime = Date.now();
    try {
      const tool = convertedTools[request.params.name];
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
          isError: true,
        };
      }
      const args = tool.zodSchema.parse(request.params.arguments);
      const result = await tool.execute(args, request.params);
      const duration = Date.now() - startTime;
      void logger.debug(`Tool execution completed`, { tool: request.params.name, duration: `${duration}ms` });
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
        void logger.warning('Invalid tool arguments', {
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
      void logger.error(`Tool execution failed: ${request.params.name}`, error);
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  async function startStdio() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    void logger.info('Started MCP Server (stdio)');
  }

  return { server, startStdio };
}
