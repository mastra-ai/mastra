import { serve } from '@hono/node-server';
import { type Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { pathToFileURL } from 'url';

import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';

import {
  generateHandler,
  getAgentByIdHandler,
  getAgentsHandler,
  streamGenerateHandler,
  streamObjectHandler,
  textObjectHandler,
} from './handlers/agents.js';
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

type Bindings = {};

type Variables = {
  mastra: Mastra;
};

export async function createHonoServer(mastra: Mastra) {
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
    await next();
  });

  app.get('/', rootHandler);

  // Agent routes
  app.get('/api/agents', getAgentsHandler);
  app.get('/api/agents/:agentId', getAgentByIdHandler);
  app.post('/api/agents/:agentId/generate', generateHandler);
  app.post('/api/agents/:agentId/stream', streamGenerateHandler);
  app.post('/api/agents/:agentId/text-object', textObjectHandler);
  app.post('/api/agents/:agentId/stream-object', streamObjectHandler);
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
  app.post('/workflows/:workflowId/execute', executeWorkflowHandler);

  // Sync routes
  app.post('/api/syncs/:syncId/execute', executeSyncHandler);

  // Log routes
  app.get('/api/logs', getLogsHandler);
  app.get('/api/logs/:runId', getLogsByRunIdHandler);

  // Tool routes
  app.get('/api/tools', getToolsHandler);
  app.get('/api/tools/:toolId', getToolByIdHandler);
  app.post('/api/tools/:toolId/execute', executeToolHandler(tools));

  return app;
}

export async function createNodeServer(mastra: Mastra) {
  const app = await createHonoServer(mastra);
  return serve(app, info => {
    console.log(info);
    console.log(`🦄Server running on port ${process.env.PORT || 4111}`);
    console.log(`📚 Open API documentation available at http://localhost:${process.env.PORT || 4111}/openapi.json`);
    console.log(`👨‍💻 Playground available at http://localhost:${process.env.PORT || 4111}/`);
  });
}

export async function createVercelServer(mastra: Mastra) {
  const app = await createHonoServer(mastra);
  return { MGET: handle(app), MPOST: handle(app) };
}
