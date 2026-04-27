import fs from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z, toJSONSchema } from 'zod';

import { listTool, listInputSchema } from './tools/list';
import { serversTool, serversInputSchema } from './tools/servers';
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
      name: 'registryList',
      description: listTool.description,
      inputSchema: toJSONSchema(listInputSchema),
    },
    {
      name: 'registryServers',
      description: serversTool.description,
      inputSchema: toJSONSchema(serversInputSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    switch (request.params.name) {
      case 'registryList': {
        const args = listInputSchema.parse(request.params.arguments);
        return await listTool.execute(args);
      }
      case 'registryServers': {
        const args = serversInputSchema.parse(request.params.arguments);
        return await serversTool.execute(args);
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
            text: `Invalid arguments: ${error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
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
