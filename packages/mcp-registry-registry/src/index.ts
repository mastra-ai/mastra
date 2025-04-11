import fs from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { helloTool, helloInputSchema } from './tools/hello';
import { registryTool, registryInputSchema } from './tools/registry';
import { fromPackageRoot } from './utils';

const server = new Server(
  {
    name: 'Registry Registry Server',
    version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'registryHello',
      description: helloTool.description,
      inputSchema: zodToJsonSchema(helloInputSchema),
    },
    {
      name: 'registryInfo',
      description: registryTool.description,
      inputSchema: zodToJsonSchema(registryInputSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    switch (request.params.name) {
      case 'registryHello': {
        const args = helloInputSchema.parse(request.params.arguments);
        return await helloTool.execute(args);
      }
      case 'registryInfo': {
        const args = registryInputSchema.parse(request.params.arguments);
        return await registryTool.execute(args);
      }
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
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
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Registry Registry MCP Server running on stdio');
}

export { runServer, server };
