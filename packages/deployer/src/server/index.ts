import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { describeRoute, openAPISpecs } from 'hono-openapi';
import { join } from 'path';
import { pathToFileURL } from 'url';

import { readFile } from 'fs/promises';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import {
  generateHandler,
  getAgentByIdHandler,
  getAgentsHandler,
  getEvalsByAgentIdHandler,
  getLiveEvalsByAgentIdHandler,
  streamGenerateHandler,
} from './handlers/agents.js';
import { handleClientsRefresh, handleTriggerClientsRefresh } from './handlers/client.js';
import { errorHandler } from './handlers/error.js';
import { getLogsByRunIdHandler, getLogsHandler } from './handlers/logs.js';
import {
  createThreadHandler,
  deleteThreadHandler,
  getContextWindowHandler,
  getMemoryStatusHandler,
  getMessagesHandler,
  getThreadByIdHandler,
  getThreadsHandler,
  saveMessagesHandler,
  updateThreadHandler,
} from './handlers/memory.js';
import { rootHandler } from './handlers/root.js';
import { executeSyncHandler } from './handlers/syncs.js';
import {
  executeAgentToolHandler,
  executeToolHandler,
  getToolByIdHandler,
  getToolResultHandler,
  getToolsHandler,
} from './handlers/tools.js';
import { executeWorkflowHandler, getWorkflowByIdHandler, getWorkflowsHandler } from './handlers/workflows.js';
import { html } from './welcome.js';

type Bindings = {};

type Variables = {
  mastra: Mastra;
  clients: Set<{ controller: ReadableStreamDefaultController }>;
  tools: Record<string, any>;
};

export async function createHonoServer(
  mastra: Mastra,
  options: { playground?: boolean; swaggerUI?: boolean; evalStore?: any; apiReqLogs?: boolean } = {},
) {
  // Create typed Hono app
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // Initialize tools
  const mastraToolsPaths = process.env.MASTRA_TOOLS_PATH;
  const toolImports = mastraToolsPaths
    ? await Promise.all(
        mastraToolsPaths.split(',').map(async toolPath => {
          return import(pathToFileURL(toolPath).href);
        }),
      )
    : [];

  const tools = toolImports.reduce((acc, toolModule) => {
    Object.entries(toolModule).forEach(([key, tool]) => {
      acc[key] = tool;
    });
    return acc;
  }, {});

  // Middleware
  app.use('*', cors());

  if (options.apiReqLogs) {
    app.use(logger());
  }

  app.onError(errorHandler);

  // Add Mastra to context
  app.use('*', async (c, next) => {
    c.set('mastra', mastra);
    c.set('tools', tools);
    await next();
  });

  // API routes
  app.get(
    '/api',
    describeRoute({
      description: 'Get API status',
      tags: ['system'],
      responses: {
        200: {
          description: 'Success',
        },
      },
    }),
    rootHandler,
  );

  // Agent routes
  app.get(
    '/api/agents',
    describeRoute({
      description: 'Get all available agents',
      tags: ['agents'],
      responses: {
        200: {
          description: 'List of all agents',
        },
      },
    }),
    getAgentsHandler,
  );

  app.get(
    '/api/agents/:agentId',
    describeRoute({
      description: 'Get agent by ID',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Agent details',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getAgentByIdHandler,
  );

  app.get(
    '/api/agents/:agentId/evals/ci',
    describeRoute({
      description: 'Get CI evals by agent ID',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of evals',
        },
      },
    }),
    getEvalsByAgentIdHandler,
  );

  app.get(
    '/api/agents/:agentId/evals/live',
    describeRoute({
      description: 'Get live evals by agent ID',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of evals',
        },
      },
    }),
    getLiveEvalsByAgentIdHandler(options.evalStore),
  );

  app.post(
    '/api/agents/:agentId/generate',
    describeRoute({
      description: 'Generate a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                threadId: { type: 'string' },
                resourceid: { type: 'string' },
                output: { type: 'object' },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    generateHandler,
  );

  app.post(
    '/api/agents/:agentId/stream',
    describeRoute({
      description: 'Stream a response from an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
                threadId: { type: 'string' },
                resourceid: { type: 'string' },
                output: { type: 'object' },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    streamGenerateHandler,
  );

  app.post(
    '/api/agents/:agentId/tools/:toolId/execute',
    describeRoute({
      description: 'Execute a tool through an agent',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'toolId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                args: { type: 'object' },
                threadId: { type: 'string' },
                resourceid: { type: 'string' },
              },
              required: ['args'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tool execution result',
        },
        404: {
          description: 'Tool or agent not found',
        },
      },
    }),
    executeAgentToolHandler,
  );

  // Memory routes
  app.get(
    '/api/memory/status',
    describeRoute({
      description: 'Get memory status',
      tags: ['memory'],
      responses: {
        200: {
          description: 'Memory status',
        },
      },
    }),
    getMemoryStatusHandler,
  );

  app.get(
    '/api/memory/threads',
    describeRoute({
      description: 'Get all threads',
      tags: ['memory'],
      responses: {
        200: {
          description: 'List of all threads',
        },
      },
    }),
    getThreadsHandler,
  );

  app.get(
    '/api/memory/threads/:threadId',
    describeRoute({
      description: 'Get thread by ID',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Thread details',
        },
        404: {
          description: 'Thread not found',
        },
      },
    }),
    getThreadByIdHandler,
  );

  app.get(
    '/api/memory/threads/:threadId/messages',
    describeRoute({
      description: 'Get messages for a thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of messages',
        },
      },
    }),
    getMessagesHandler,
  );

  app.get(
    '/api/memory/threads/:threadId/context-window',
    describeRoute({
      description: 'Get context window for a thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Context window',
        },
      },
    }),
    getContextWindowHandler,
  );

  app.post(
    '/api/memory/threads',
    describeRoute({
      description: 'Create a new thread',
      tags: ['memory'],
      responses: {
        200: {
          description: 'Created thread',
        },
      },
    }),
    createThreadHandler,
  );

  app.patch(
    '/api/memory/threads/:threadId',
    describeRoute({
      description: 'Update a thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
      responses: {
        200: {
          description: 'Updated thread',
        },
        404: {
          description: 'Thread not found',
        },
      },
    }),
    updateThreadHandler,
  );

  app.delete(
    '/api/memory/threads/:threadId',
    describeRoute({
      description: 'Delete a thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Thread deleted',
        },
        404: {
          description: 'Thread not found',
        },
      },
    }),
    deleteThreadHandler,
  );

  app.post(
    '/api/memory/save-messages',
    describeRoute({
      description: 'Save messages',
      tags: ['memory'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
              required: ['messages'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Messages saved',
        },
      },
    }),
    saveMessagesHandler,
  );

  app.post(
    '/api/memory/threads/:threadId/tool-result',
    describeRoute({
      description: 'Get tool execution result for a thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                toolId: { type: 'string' },
                resultId: { type: 'string' },
              },
              required: ['toolId', 'resultId'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tool execution result',
        },
        404: {
          description: 'Result not found',
        },
      },
    }),
    getToolResultHandler,
  );

  // Workflow routes
  app.get(
    '/api/workflows',
    describeRoute({
      description: 'Get all workflows',
      tags: ['workflows'],
      responses: {
        200: {
          description: 'List of all workflows',
        },
      },
    }),
    getWorkflowsHandler,
  );

  app.get(
    '/api/workflows/:workflowId',
    describeRoute({
      description: 'Get workflow by ID',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Workflow details',
        },
        404: {
          description: 'Workflow not found',
        },
      },
    }),
    getWorkflowByIdHandler,
  );

  app.post(
    '/api/workflows/:workflowId/execute',
    describeRoute({
      description: 'Execute a workflow',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                input: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Workflow execution result',
        },
        404: {
          description: 'Workflow not found',
        },
      },
    }),
    executeWorkflowHandler,
  );

  // Sync routes
  app.post(
    '/api/syncs/:syncId/execute',
    describeRoute({
      description: 'Execute a sync',
      tags: ['syncs'],
      parameters: [
        {
          name: 'syncId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                input: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Sync execution result',
        },
        404: {
          description: 'Sync not found',
        },
      },
    }),
    executeSyncHandler,
  );

  // Log routes
  app.get(
    '/api/logs',
    describeRoute({
      description: 'Get all logs',
      tags: ['logs'],
      responses: {
        200: {
          description: 'List of all logs',
        },
      },
    }),
    getLogsHandler,
  );

  app.get(
    '/api/logs/:runId',
    describeRoute({
      description: 'Get logs by run ID',
      tags: ['logs'],
      parameters: [
        {
          name: 'runId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of logs for run ID',
        },
      },
    }),
    getLogsByRunIdHandler,
  );

  // Tool routes
  app.get(
    '/api/tools',
    describeRoute({
      description: 'Get all tools',
      tags: ['tools'],
      responses: {
        200: {
          description: 'List of all tools',
        },
      },
    }),
    getToolsHandler,
  );

  app.get(
    '/api/tools/:toolId',
    describeRoute({
      description: 'Get tool by ID',
      tags: ['tools'],
      parameters: [
        {
          name: 'toolId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Tool details',
        },
        404: {
          description: 'Tool not found',
        },
      },
    }),
    getToolByIdHandler,
  );

  app.get(
    '/api/tools/:toolId/result/:resultId',
    describeRoute({
      description: 'Get tool execution result',
      tags: ['tools'],
      parameters: [
        {
          name: 'toolId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'resultId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Tool execution result',
        },
        404: {
          description: 'Result not found',
        },
      },
    }),
    getToolResultHandler,
  );

  app.post(
    '/api/tools/:toolId/execute',
    describeRoute({
      description: 'Execute a tool',
      tags: ['tools'],
      parameters: [
        {
          name: 'toolId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                args: { type: 'object' },
                threadId: { type: 'string' },
                resourceid: { type: 'string' },
              },
              required: ['args'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tool execution result',
        },
        404: {
          description: 'Tool not found',
        },
      },
    }),
    executeToolHandler(tools),
  );

  app.get(
    '/openapi.json',
    openAPISpecs(app, {
      documentation: {
        info: { title: 'Mastra API', version: '1.0.0', description: 'Mastra API' },
      },
    }),
  );

  app.get('/swagger-ui', swaggerUI({ url: '/openapi.json' }));

  if (options?.swaggerUI) {
    app.get('/swagger-ui', swaggerUI({ url: '/openapi.json' }));
  }

  if (options?.playground) {
    // SSE endpoint for refresh notifications
    app.get('/refresh-events', handleClientsRefresh);

    // Trigger refresh for all clients
    app.post('/__refresh', handleTriggerClientsRefresh);
    // Playground routes - these should come after API routes
    // Serve assets with specific MIME types
    app.use('/assets/*', async (c, next) => {
      const path = c.req.path;
      if (path.endsWith('.js')) {
        c.header('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        c.header('Content-Type', 'text/css');
      }
      await next();
    });

    // Serve static assets from playground directory
    app.use(
      '/assets/*',
      serveStatic({
        root: './playground/assets',
      }),
    );

    // Serve extra static files from playground directory
    app.use(
      '*',
      serveStatic({
        root: './playground',
      }),
    );
  }

  // Catch-all route to serve index.html for any non-API routes
  app.get('*', async (c, next) => {
    // Skip if it's an API route
    if (
      c.req.path.startsWith('/api/') ||
      c.req.path.startsWith('/swagger-ui') ||
      c.req.path.startsWith('/openapi.json')
    ) {
      return await next();
    }

    if (options?.playground) {
      // For all other routes, serve index.html
      const indexHtml = await readFile(join(process.cwd(), './playground/index.html'), 'utf-8');
      return c.newResponse(indexHtml, 200, { 'Content-Type': 'text/html' });
    }

    return c.newResponse(html, 200, { 'Content-Type': 'text/html' });
  });

  return app;
}

export async function createNodeServer(
  mastra: Mastra,
  options: { playground?: boolean; swaggerUI?: boolean; evalStore?: any; apiReqLogs?: boolean } = {},
) {
  const app = await createHonoServer(mastra, options);
  return serve(
    {
      fetch: app.fetch,
      port: Number(process.env.PORT) || 4111,
    },
    () => {
      const logger = mastra.getLogger();
      logger.info(`🦄 Mastra API running on port ${process.env.PORT || 4111}/api`);
      logger.info(`📚 Open API documentation available at http://localhost:${process.env.PORT || 4111}/openapi.json`);
      if (options?.swaggerUI) {
        logger.info(`🧪 Swagger UI available at http://localhost:${process.env.PORT || 4111}/swagger-ui`);
      }
      if (options?.playground) {
        logger.info(`👨‍💻 Playground available at http://localhost:${process.env.PORT || 4111}/`);
      }
    },
  );
}
