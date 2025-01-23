import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { join } from 'path';
import { pathToFileURL } from 'url';

import { readFile } from 'fs/promises';
import { cors } from 'hono/cors';

import { generateHandler, getAgentByIdHandler, getAgentsHandler, streamGenerateHandler } from './handlers/agents.js';
import { handleClientsRefresh } from './handlers/client.js';
import { handleTriggerClientsRefresh } from './handlers/client.js';
import { getLogsByRunIdHandler, getLogsHandler } from './handlers/logs';
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
} from './handlers/memory';
import { rootHandler } from './handlers/root.js';
import { executeSyncHandler } from './handlers/syncs.js';
import {
  executeAgentToolHandler,
  executeToolHandler,
  getToolByIdHandler,
  getToolResultHandler,
  getToolsHandler,
  validateToolCallArgsHandler,
} from './handlers/tools';
import { executeWorkflowHandler, getWorkflowByIdHandler, getWorkflowsHandler } from './handlers/workflows';
import { html } from './welcome.js';

type Bindings = {};

type Variables = {
  mastra: Mastra;
  clients: Set<{ controller: ReadableStreamDefaultController }>;
  tools: Record<string, any>;
};

export async function createHonoServer(mastra: Mastra, options: { playground?: boolean } = {}) {
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

  // Add Mastra to context
  app.use('*', async (c, next) => {
    c.set('mastra', mastra);
    c.set('tools', tools);
    await next();
  });

  // API routes
  app.get('/api', rootHandler);

  // Agent routes
  app.get('/api/agents', getAgentsHandler);
  app.get('/api/agents/:agentId', getAgentByIdHandler);
  app.post('/api/agents/:agentId/generate', generateHandler);
  app.post('/api/agents/:agentId/stream', streamGenerateHandler);
  app.post('/api/agents/:agentId/tools/:toolId/execute', executeAgentToolHandler);

  // Memory routes
  app.get('/api/memory/status', getMemoryStatusHandler);
  app.get('/api/memory/threads', getThreadsHandler);
  app.get('/api/memory/threads/:threadId', getThreadByIdHandler);
  app.get('/api/memory/threads/:threadId/messages', getMessagesHandler);
  app.get('/api/memory/threads/:threadId/context-window', getContextWindowHandler);
  app.post('/api/memory/threads', createThreadHandler);
  app.patch('/api/memory/threads/:threadId', updateThreadHandler);
  app.delete('/api/memory/threads/:threadId', deleteThreadHandler);
  app.post('/api/memory/save-messages', saveMessagesHandler);
  app.post('/api/memory/threads/:threadId/tool-result', getToolResultHandler);
  app.post('/api/memory/validate-tool-call-args', validateToolCallArgsHandler);

  // Workflow routes
  app.get('/api/workflows', getWorkflowsHandler);
  app.get('/api/workflows/:workflowId', getWorkflowByIdHandler);
  app.post('/api/workflows/:workflowId/execute', executeWorkflowHandler);

  // Sync routes
  app.post('/api/syncs/:syncId/execute', executeSyncHandler);

  // Log routes
  app.get('/api/logs', getLogsHandler);
  app.get('/api/logs/:runId', getLogsByRunIdHandler);

  // Tool routes
  app.get('/api/tools', getToolsHandler);
  app.get('/api/tools/:toolId', getToolByIdHandler);
  app.post('/api/tools/:toolId/execute', executeToolHandler(tools));

  // SSE endpoint for refresh notifications
  app.get('/refresh-events', handleClientsRefresh);

  // Trigger refresh for all clients
  app.post('/__refresh', handleTriggerClientsRefresh);

  if (options?.playground) {
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

    // Serve assets from playground directory
    app.use(
      '/assets/*',
      serveStatic({
        root: './playground/assets',
      }),
    );

    // Serve static files from playground directory
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
    if (c.req.path.startsWith('/api/')) {
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

export async function createNodeServer(mastra: Mastra, options: { playground?: boolean } = {}) {
  const app = await createHonoServer(mastra, options);
  return serve(
    {
      fetch: app.fetch,
      port: Number(process.env.PORT) || 4111,
    },
    () => {
      console.log(`🦄 Server running on port ${process.env.PORT || 4111}/api`);
      console.log(`📚 Open API documentation available at http://localhost:${process.env.PORT || 4111}/openapi.json`);
      console.log(`👨‍💻 Playground available at http://localhost:${process.env.PORT || 4111}/`);
    },
  );
}
