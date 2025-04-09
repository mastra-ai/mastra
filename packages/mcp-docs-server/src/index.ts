import fs from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { prepare } from './prepare-docs/prepare';
import { blogTool, blogInputSchema } from './tools/blog';
import { changesTool, changesInputSchema } from './tools/changes';
import { docsTool, docsInputSchema } from './tools/docs';
import { examplesTool, examplesInputSchema } from './tools/examples';
import { fromPackageRoot } from './utils';

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  await prepare();
}

const server = new Server(
  {
    name: 'Mastra Documentation Server',
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
      name: 'mastraBlog',
      description: blogTool.description,
      inputSchema: zodToJsonSchema(blogInputSchema),
    },
    {
      name: 'mastraDocs',
      description: docsTool.description,
      inputSchema: zodToJsonSchema(docsInputSchema),
    },
    {
      name: 'mastraExamples',
      description: examplesTool.description,
      inputSchema: zodToJsonSchema(examplesInputSchema),
    },
    {
      name: 'mastraChanges',
      description: changesTool.description,
      inputSchema: zodToJsonSchema(changesInputSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    switch (request.params.name) {
      case 'mastraBlog': {
        const args = blogInputSchema.parse(request.params.arguments);
        return await blogTool.execute(args);
      }
      case 'mastraDocs': {
        const args = docsInputSchema.parse(request.params.arguments);
        return await docsTool.execute(args);
      }
      case 'mastraExamples': {
        const args = examplesInputSchema.parse(request.params.arguments);
        return await examplesTool.execute(args);
      }
      case 'mastraChanges': {
        const args = changesInputSchema.parse(request.params.arguments);
        return await changesTool.execute(args);
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
  console.error('Mastra Docs MCP Server running on stdio');
}

export { runServer, server };
