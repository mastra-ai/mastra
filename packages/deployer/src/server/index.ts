import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { dirname } from 'path';
import { join } from 'path/posix';
import { fileURLToPath, pathToFileURL } from 'url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import { Telemetry } from '@mastra/core';
import type { Mastra } from '@mastra/core';
import { Container } from '@mastra/core/di';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timeout } from 'hono/timeout';
import { describeRoute, openAPISpecs } from 'hono-openapi';
import {
  generateHandler,
  getAgentByIdHandler,
  getAgentsHandler,
  getEvalsByAgentIdHandler,
  getLiveEvalsByAgentIdHandler,
  setAgentInstructionsHandler,
  streamGenerateHandler,
} from './handlers/agents';
import { handleClientsRefresh, handleTriggerClientsRefresh } from './handlers/client';
import { errorHandler } from './handlers/error';
import { getLogsByRunIdHandler, getLogsHandler, getLogTransports } from './handlers/logs';
import {
  createThreadHandler,
  deleteThreadHandler,
  getMemoryStatusHandler,
  getMessagesHandler,
  getThreadByIdHandler,
  getThreadsHandler,
  saveMessagesHandler,
  updateThreadHandler,
} from './handlers/memory';
import {
  getNetworkByIdHandler,
  getNetworksHandler,
  generateHandler as generateNetworkHandler,
  streamGenerateHandler as streamGenerateNetworkHandler,
} from './handlers/network';
import { generateSystemPromptHandler } from './handlers/prompt';
import { rootHandler } from './handlers/root';
import { getTelemetryHandler, storeTelemetryHandler } from './handlers/telemetry';
import { executeAgentToolHandler, executeToolHandler, getToolByIdHandler, getToolsHandler } from './handlers/tools';
import { upsertVectors, createIndex, queryVectors, listIndexes, describeIndex, deleteIndex } from './handlers/vector';
import { getSpeakersHandler, speakHandler, listenHandler } from './handlers/voice';
import {
  startWorkflowRunHandler,
  resumeAsyncWorkflowHandler,
  startAsyncWorkflowHandler,
  getWorkflowByIdHandler,
  getWorkflowsHandler,
  resumeWorkflowHandler,
  watchWorkflowHandler,
  createRunHandler,
  getWorkflowRunsHandler,
} from './handlers/workflows.js';
import { html } from './welcome.js';

type Bindings = {};

type Variables = {
  mastra: Mastra;
  container: Container;
  clients: Set<{ controller: ReadableStreamDefaultController }>;
  tools: Record<string, any>;
  playground: boolean;
};

export async function createHonoServer(
  mastra: Mastra,
  options: { playground?: boolean; swaggerUI?: boolean; apiReqLogs?: boolean } = {},
) {
  // Create typed Hono app
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  const server = mastra.getServer();

  // Initialize tools
  // @ts-ignore
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const mastraToolsPaths = (await import(pathToFileURL(join(__dirname, 'tools.mjs')).href)).tools;
  const toolImports = mastraToolsPaths
    ? await Promise.all(
        // @ts-ignore
        mastraToolsPaths.map(async toolPath => {
          return import(pathToFileURL(join(__dirname, toolPath)).href);
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

  app.use('*', async function setTelemetryInfo(c, next) {
    const requestId = c.req.header('x-request-id') ?? randomUUID();
    const span = Telemetry.getActiveSpan();
    if (span) {
      span.setAttribute('http.request_id', requestId);
      span.updateName(`${c.req.method} ${c.req.path}`);

      const newCtx = Telemetry.setBaggage({
        'http.request_id': requestId,
      });

      await new Promise(resolve => {
        Telemetry.withContext(newCtx, async () => {
          await next();
          resolve(true);
        });
      });
    } else {
      await next();
    }
  });

  if (options.apiReqLogs) {
    app.use(logger());
  }

  app.onError(errorHandler);

  // Add Mastra to context
  app.use('*', function setContext(c, next) {
    const container = new Container();

    c.set('container', container);
    c.set('mastra', mastra);
    c.set('tools', tools);
    c.set('playground', options.playground === true);

    return next();
  });

  // Apply custom server middleware from Mastra instance
  const serverMiddleware = mastra.getServerMiddleware?.();

  if (serverMiddleware && serverMiddleware.length > 0) {
    for (const m of serverMiddleware) {
      app.use(m.path, m.handler);
    }
  }

  //Global cors config
  if (server?.cors === false) {
    app.use('*', timeout(server?.timeout ?? 3 * 60 * 1000));
  } else {
    const corsConfig = {
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: false,
      maxAge: 3600,
      ...server?.cors,
      allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type', ...(server?.cors?.allowHeaders ?? [])],
      exposeHeaders: ['Content-Length', 'X-Requested-With', ...(server?.cors?.exposeHeaders ?? [])],
    };
    app.use('*', timeout(server?.timeout ?? 3 * 60 * 1000), cors(corsConfig));
  }

  const bodyLimitOptions = {
    maxSize: 4.5 * 1024 * 1024, // 4.5 MB,
    onError: (c: Context) => c.json({ error: 'Request body too large' }, 413),
  };

  const routes = server?.apiRoutes;

  if (server?.middleware) {
    const normalizedMiddlewares = Array.isArray(server.middleware) ? server.middleware : [server.middleware];
    const middlewares = normalizedMiddlewares.map(middleware => {
      if (typeof middleware === 'function') {
        return {
          path: '*',
          handler: middleware,
        };
      }

      return middleware;
    });

    for (const middleware of middlewares) {
      app.use(middleware.path, middleware.handler);
    }
  }

  if (routes) {
    for (const route of routes) {
      const middlewares: MiddlewareHandler[] = [];

      if (route.middleware) {
        middlewares.push(...(Array.isArray(route.middleware) ? route.middleware : [route.middleware]));
      }
      if (route.openapi) {
        middlewares.push(describeRoute(route.openapi));
      }

      if (route.method === 'GET') {
        app.get(route.path, ...middlewares, route.handler);
      } else if (route.method === 'POST') {
        app.post(route.path, ...middlewares, route.handler);
      } else if (route.method === 'PUT') {
        app.put(route.path, ...middlewares, route.handler);
      } else if (route.method === 'DELETE') {
        app.delete(route.path, ...middlewares, route.handler);
      }
    }
  }

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

  // Network routes
  app.get(
    '/api/networks',
    describeRoute({
      description: 'Get all available networks',
      tags: ['networks'],
      responses: {
        200: {
          description: 'List of all networks',
        },
      },
    }),
    getNetworksHandler,
  );

  app.get(
    '/api/networks/:networkId',
    describeRoute({
      description: 'Get network by ID',
      tags: ['networks'],
      parameters: [
        {
          name: 'networkId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Network details',
        },
        404: {
          description: 'Network not found',
        },
      },
    }),
    getNetworkByIdHandler,
  );

  app.post(
    '/api/networks/:networkId/generate',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate a response from a network',
      tags: ['networks'],
      parameters: [
        {
          name: 'networkId',
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
                input: {
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'array',
                      items: { type: 'object' },
                    },
                  ],
                  description: 'Input for the network, can be a string or an array of CoreMessage objects',
                },
              },
              required: ['input'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Network not found',
        },
      },
    }),
    generateNetworkHandler,
  );

  app.post(
    '/api/networks/:networkId/stream',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate a response from a network',
      tags: ['networks'],
      parameters: [
        {
          name: 'networkId',
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
                input: {
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'array',
                      items: { type: 'object' },
                    },
                  ],
                  description: 'Input for the network, can be a string or an array of CoreMessage objects',
                },
              },
              required: ['input'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'Network not found',
        },
      },
    }),
    streamGenerateNetworkHandler,
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
    getLiveEvalsByAgentIdHandler,
  );

  app.post(
    '/api/agents/:agentId/generate',
    bodyLimit(bodyLimitOptions),
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
                resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                resourceid: {
                  type: 'string',
                  description: 'The resource ID for the conversation (deprecated, use resourceId instead)',
                  deprecated: true,
                },
                runId: { type: 'string' },
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
    bodyLimit(bodyLimitOptions),
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
                resourceId: { type: 'string', description: 'The resource ID for the conversation' },
                resourceid: {
                  type: 'string',
                  description: 'The resource ID for the conversation (deprecated, use resourceId instead)',
                  deprecated: true,
                },
                runId: { type: 'string' },
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
    '/api/agents/:agentId/instructions',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: "Update an agent's instructions",
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
                instructions: {
                  type: 'string',
                  description: 'New instructions for the agent',
                },
              },
              required: ['instructions'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Instructions updated successfully',
        },
        403: {
          description: 'Not allowed in non-playground environment',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    setAgentInstructionsHandler,
  );

  app.post(
    '/api/agents/:agentId/instructions/enhance',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate an improved system prompt from instructions',
      tags: ['agents'],
      parameters: [
        {
          name: 'agentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'ID of the agent whose model will be used for prompt generation',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                instructions: {
                  type: 'string',
                  description: 'Instructions to generate a system prompt from',
                },
                comment: {
                  type: 'string',
                  description: 'Optional comment for the enhanced prompt',
                },
              },
              required: ['instructions'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated system prompt and analysis',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  explanation: {
                    type: 'string',
                    description: 'Detailed analysis of the instructions',
                  },
                  new_prompt: {
                    type: 'string',
                    description: 'The enhanced system prompt',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Missing or invalid request parameters',
        },
        404: {
          description: 'Agent not found',
        },
        500: {
          description: 'Internal server error or model response parsing error',
        },
      },
    }),
    generateSystemPromptHandler,
  );

  app.get(
    '/api/agents/:agentId/speakers',
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header('Warning', '299 - "This endpoint is deprecated, use /api/agents/:agentId/voice/speakers instead"');
      c.header('Link', '</api/agents/:agentId/voice/speakers>; rel="successor-version"');
      return next();
    },
    describeRoute({
      description: '[DEPRECATED] Use /api/agents/:agentId/voice/speakers instead. Get available speakers for an agent',
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
          description: 'List of available speakers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Speaker information depending on the voice provider',
                  properties: {
                    voiceId: { type: 'string' },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getSpeakersHandler,
  );

  app.get(
    '/api/agents/:agentId/voice/speakers',
    describeRoute({
      description: 'Get available speakers for an agent',
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
          description: 'List of available speakers',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  description: 'Speaker information depending on the voice provider',
                  properties: {
                    voiceId: { type: 'string' },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    getSpeakersHandler,
  );

  app.post(
    '/api/agents/:agentId/speak',
    bodyLimit(bodyLimitOptions),
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header('Warning', '299 - "This endpoint is deprecated, use /api/agents/:agentId/voice/speak instead"');
      c.header('Link', '</api/agents/:agentId/voice/speak>; rel="successor-version"');
      return next();
    },
    describeRoute({
      description:
        "[DEPRECATED] Use /api/agents/:agentId/voice/speak instead. Convert text to speech using the agent's voice provider",
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
                text: {
                  type: 'string',
                  description: 'Text to convert to speech',
                },
                options: {
                  type: 'object',
                  description: 'Provider-specific options for speech generation',
                  properties: {
                    speaker: {
                      type: 'string',
                      description: 'Speaker ID to use for speech generation',
                    },
                  },
                  additionalProperties: true,
                },
              },
              required: ['text'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Audio stream',
          content: {
            'audio/mpeg': {
              schema: {
                format: 'binary',
                description: 'Audio stream containing the generated speech',
              },
            },
            'audio/*': {
              schema: {
                format: 'binary',
                description: 'Audio stream depending on the provider',
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    speakHandler,
  );

  app.post(
    '/api/agents/:agentId/voice/speak',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: "Convert text to speech using the agent's voice provider",
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
                input: {
                  type: 'string',
                  description: 'Text to convert to speech',
                },
                options: {
                  type: 'object',
                  description: 'Provider-specific options for speech generation',
                  properties: {
                    speaker: {
                      type: 'string',
                      description: 'Speaker ID to use for speech generation',
                    },
                    options: {
                      type: 'object',
                      description: 'Provider-specific options for speech generation',
                      additionalProperties: true,
                    },
                  },
                  additionalProperties: true,
                },
              },
              required: ['text'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Audio stream',
          content: {
            'audio/mpeg': {
              schema: {
                format: 'binary',
                description: 'Audio stream containing the generated speech',
              },
            },
            'audio/*': {
              schema: {
                format: 'binary',
                description: 'Audio stream depending on the provider',
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    speakHandler,
  );

  app.post(
    '/api/agents/:agentId/listen',
    bodyLimit({
      ...bodyLimitOptions,
      maxSize: 10 * 1024 * 1024, // 10 MB for audio files
    }),
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header('Warning', '299 - "This endpoint is deprecated, use /api/agents/:agentId/voice/listen instead"');
      c.header('Link', '</api/agents/:agentId/voice/listen>; rel="successor-version"');
      return next();
    },
    describeRoute({
      description:
        "[DEPRECATED] Use /api/agents/:agentId/voice/listen instead. Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
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
          'audio/mpeg': {
            schema: {
              format: 'binary',
              description:
                'Audio data stream to transcribe (supports various formats depending on provider like mp3, wav, webm, flac)',
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Transcription result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'Transcribed text',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    listenHandler,
  );

  app.post(
    '/api/agents/:agentId/voice/listen',
    bodyLimit({
      ...bodyLimitOptions,
      maxSize: 10 * 1024 * 1024, // 10 MB for audio files
    }),
    describeRoute({
      description:
        "Convert speech to text using the agent's voice provider. Additional provider-specific options can be passed as query parameters.",
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
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['audio'],
              properties: {
                audio: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'Audio data stream to transcribe (supports various formats depending on provider like mp3, wav, webm, flac)',
                },
                options: {
                  type: 'object',
                  description: 'Provider-specific options for speech-to-text',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Transcription result',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'Transcribed text',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Agent does not have voice capabilities or invalid request',
        },
        404: {
          description: 'Agent not found',
        },
      },
    }),
    listenHandler,
  );

  app.post(
    '/api/agents/:agentId/tools/:toolId/execute',
    bodyLimit(bodyLimitOptions),
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
                data: { type: 'object' },
              },
              required: ['data'],
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
      parameters: [
        {
          name: 'agentId',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
      ],
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
      parameters: [
        {
          name: 'resourceid',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'agentId',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
      ],
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
        {
          name: 'agentId',
          in: 'query',
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
        {
          name: 'agentId',
          in: 'query',
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

  app.post(
    '/api/memory/threads',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'agentId',
          in: 'query',
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
                title: { type: 'string' },
                metadata: { type: 'object' },
                resourceid: { type: 'string' },
                threadId: { type: 'string' },
              },
            },
          },
        },
      },
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
        {
          name: 'agentId',
          in: 'query',
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
        {
          name: 'agentId',
          in: 'query',
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
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Save messages',
      tags: ['memory'],
      parameters: [
        {
          name: 'agentId',
          in: 'query',
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

  // Telemetry routes
  app.get(
    '/api/telemetry',
    describeRoute({
      description: 'Get all traces',
      tags: ['telemetry'],
      responses: {
        200: {
          description: 'List of all traces (paged)',
        },
      },
    }),
    getTelemetryHandler,
  );

  app.post(
    '/api/telemetry',
    describeRoute({
      description: 'Store telemetry',
      tags: ['telemetry'],
      responses: {
        200: {
          description: 'Traces stored',
        },
      },
    }),
    storeTelemetryHandler,
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

  app.get(
    '/api/workflows/:workflowId/runs',
    describeRoute({
      description: 'Get all runs for a workflow',
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
          description: 'List of workflow runs from storage',
        },
      },
    }),
    getWorkflowRunsHandler,
  );

  app.post(
    '/api/workflows/:workflowId/resume',
    describeRoute({
      description: 'Resume a suspended workflow step',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
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
                stepId: { type: 'string' },
                context: { type: 'object' },
              },
            },
          },
        },
      },
    }),
    resumeWorkflowHandler,
  );

  /**
   * @deprecated Use /api/workflows/:workflowId/resume-async instead
   */
  app.post(
    '/api/workflows/:workflowId/resumeAsync',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: '@deprecated Use /api/workflows/:workflowId/resume-async instead',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
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
                stepId: { type: 'string' },
                context: { type: 'object' },
              },
            },
          },
        },
      },
    }),
    resumeAsyncWorkflowHandler,
  );

  app.post(
    '/api/workflows/:workflowId/resume-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Resume a suspended workflow step',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
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
                stepId: { type: 'string' },
                context: { type: 'object' },
              },
            },
          },
        },
      },
    }),
    resumeAsyncWorkflowHandler,
  );

  app.post(
    '/api/workflows/:workflowId/createRun',
    describeRoute({
      description: 'Create a new workflow run',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'New workflow run created',
        },
      },
    }),
    createRunHandler,
  );

  app.post(
    '/api/workflows/:workflowId/startAsync',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Execute/Start a workflow',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
          required: false,
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
    startAsyncWorkflowHandler,
  );

  /**
   * @deprecated Use /api/workflows/:workflowId/start-async instead
   */
  app.post(
    '/api/workflows/:workflowId/start-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: '@deprecated Use /api/workflows/:workflowId/start-async instead',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
          required: false,
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
    startAsyncWorkflowHandler,
  );

  app.post(
    '/api/workflows/:workflowId/start',
    describeRoute({
      description: 'Create and start a new workflow run',
      tags: ['workflows'],
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
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
          description: 'Workflow run started',
        },
        404: {
          description: 'Workflow not found',
        },
      },
    }),
    startWorkflowRunHandler,
  );

  app.get(
    '/api/workflows/:workflowId/watch',
    describeRoute({
      description: 'Watch workflow transitions in real-time',
      parameters: [
        {
          name: 'workflowId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      tags: ['workflows'],
      responses: {
        200: {
          description: 'Workflow transitions in real-time',
        },
      },
    }),
    watchWorkflowHandler,
  );

  // Log routes
  app.get(
    '/api/logs',
    describeRoute({
      description: 'Get all logs',
      tags: ['logs'],
      parameters: [
        {
          name: 'transportId',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of all logs',
        },
      },
    }),
    getLogsHandler,
  );

  app.get(
    '/api/logs/transports',
    describeRoute({
      description: 'List of all log transports',
      tags: ['logs'],
      responses: {
        200: {
          description: 'List of all log transports',
        },
      },
    }),
    getLogTransports,
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
        {
          name: 'transportId',
          in: 'query',
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

  app.post(
    '/api/tools/:toolId/execute',
    bodyLimit(bodyLimitOptions),
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
                data: { type: 'object' },
              },
              required: ['data'],
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

  // Vector routes
  app.post(
    '/api/vector/:vectorName/upsert',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Upsert vectors into an index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
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
                indexName: { type: 'string' },
                vectors: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
                metadata: {
                  type: 'array',
                  items: { type: 'object' },
                },
                ids: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['indexName', 'vectors'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Vectors upserted successfully',
        },
      },
    }),
    upsertVectors,
  );

  app.post(
    '/api/vector/:vectorName/create-index',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new vector index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
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
                indexName: { type: 'string' },
                dimension: { type: 'number' },
                metric: {
                  type: 'string',
                  enum: ['cosine', 'euclidean', 'dotproduct'],
                },
              },
              required: ['indexName', 'dimension'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Index created successfully',
        },
      },
    }),
    createIndex,
  );

  app.post(
    '/api/vector/:vectorName/query',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Query vectors from an index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
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
                indexName: { type: 'string' },
                queryVector: {
                  type: 'array',
                  items: { type: 'number' },
                },
                topK: { type: 'number' },
                filter: { type: 'object' },
                includeVector: { type: 'boolean' },
              },
              required: ['indexName', 'queryVector'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Query results',
        },
      },
    }),
    queryVectors,
  );

  app.get(
    '/api/vector/:vectorName/indexes',
    describeRoute({
      description: 'List all indexes for a vector store',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'List of indexes',
        },
      },
    }),
    listIndexes,
  );

  app.get(
    '/api/vector/:vectorName/indexes/:indexName',
    describeRoute({
      description: 'Get details about a specific index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'indexName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Index details',
        },
      },
    }),
    describeIndex,
  );

  app.delete(
    '/api/vector/:vectorName/indexes/:indexName',
    describeRoute({
      description: 'Delete a specific index',
      tags: ['vector'],
      parameters: [
        {
          name: 'vectorName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'indexName',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Index deleted successfully',
        },
      },
    }),
    deleteIndex,
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
  options: { playground?: boolean; swaggerUI?: boolean; apiReqLogs?: boolean } = {},
) {
  const app = await createHonoServer(mastra, options);
  const serverOptions = mastra.getServer();

  const port = serverOptions?.port ?? (Number(process.env.PORT) || 4111);

  const server = serve(
    {
      fetch: app.fetch,
      port,
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

  return server;
}
