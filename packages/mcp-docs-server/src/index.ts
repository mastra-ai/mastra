import fs from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { logger, createLogger } from './logger';
import { prepare } from './prepare-docs/prepare';
import { blogTool, blogInputSchema } from './tools/blog';
import { changesTool, changesInputSchema } from './tools/changes';
import { docsTool, docsInputSchema } from './tools/docs';
import { examplesTool, examplesInputSchema } from './tools/examples';
import { fromPackageRoot } from './utils';

let server: Server;

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  void logger.info('Rebuilding docs on start');
  try {
    await prepare();
    void logger.info('Docs rebuilt successfully');
  } catch (error) {
    void logger.error('Failed to rebuild docs', error);
  }
}

server = new Server(
  {
    name: 'Mastra Documentation Server',
    version: JSON.parse(await fs.readFile(fromPackageRoot(`package.json`), 'utf8')).version,
  },
  {
    capabilities: {
      tools: {},
      logging: { enabled: true },
    },
  },
);

// Update logger with server instance
Object.assign(logger, createLogger(server));

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
  const startTime = Date.now();
  try {
    let result;
    switch (request.params.name) {
      case 'mastraBlog': {
        const args = blogInputSchema.parse(request.params.arguments);
        result = await blogTool.execute(args);
        break;
      }
      case 'mastraDocs': {
        const args = docsInputSchema.parse(request.params.arguments);
        result = await docsTool.execute(args);
        break;
      }
      case 'mastraExamples': {
        const args = examplesInputSchema.parse(request.params.arguments);
        result = await examplesTool.execute(args);
        break;
      }
      case 'mastraChanges': {
        const args = changesInputSchema.parse(request.params.arguments);
        result = await changesTool.execute(args);
        break;
      }
      default: {
        void logger.warning(`Unknown tool requested: ${request.params.name}`);
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
    }

    const duration = Date.now() - startTime;
    void logger.debug(`Tool execution completed`, { tool: request.params.name, duration: `${duration}ms` });
    return result;
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
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    void logger.info('Started Mastra Docs MCP Server');
  } catch (error) {
    void logger.error('Failed to start server', error);
    process.exit(1);
  }
}

export { runServer, server };
