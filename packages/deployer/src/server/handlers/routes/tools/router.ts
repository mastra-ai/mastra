import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import { executeToolHandler, getToolByIdHandler, listToolsHandler } from './handlers';

export function toolsRouter(bodyLimitOptions: BodyLimitOptions, tools: Record<string, any>) {
  const router = new Hono();

  router.get(
    '/',
    describeRoute({
      description: 'Get all tools',
      tags: ['tools'],
      responses: {
        200: {
          description: 'List of all tools',
        },
      },
    }),
    listToolsHandler,
  );

  router.get(
    '/:toolId',
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

  router.post(
    '/:toolId/execute',
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
                data: { type: 'object' },
                requestContext: { type: 'object' },
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

  return router;
}
