import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../types';
import {
  createThreadHandler,
  deleteThreadHandler,
  getMemoryStatusHandler,
  getMessagesHandler,
  getMessagesPaginatedHandler,
  getThreadByIdHandler,
  getThreadsHandler,
  getWorkingMemoryHandler,
  saveMessagesHandler,
  updateThreadHandler,
  updateWorkingMemoryHandler,
} from '../memory';

export function memoryRoutes(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  // Network Memory routes
  router.get(
    '/network/status',
    describeRoute({
      description: 'Get network memory status',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'networkId',
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

  router.get(
    '/network/threads',
    describeRoute({
      description: 'Get all threads',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'resourceid',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'networkId',
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

  router.get(
    '/network/threads/:threadId',
    describeRoute({
      description: 'Get thread by ID',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'networkId',
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

  router.get(
    '/network/threads/:threadId/messages',
    describeRoute({
      description: 'Get messages for a thread',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'networkId',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Limit the number of messages to retrieve (default: 40)',
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

  router.post(
    '/network/threads',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new thread',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'networkId',
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
                resourceId: { type: 'string' },
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

  router.patch(
    '/network/threads/:threadId',
    describeRoute({
      description: 'Update a thread',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'networkId',
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

  router.delete(
    '/network/threads/:threadId',
    describeRoute({
      description: 'Delete a thread',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'networkId',
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

  router.post(
    '/network/save-messages',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Save messages',
      tags: ['networkMemory'],
      parameters: [
        {
          name: 'networkId',
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

  // Memory routes
  router.get(
    '/status',
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

  router.get(
    '/threads',
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

  router.get(
    '/threads/:threadId',
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

  router.get(
    '/threads/:threadId/messages',
    async (c, next) => {
      c.header('Deprecation', 'true');
      c.header(
        'Warning',
        '299 - "This endpoint is deprecated, use /api/memory/threads/:threadId/messages/paginated instead"',
      );
      c.header('Link', '</api/memory/threads/:threadId/messages/paginated>; rel="successor-version"');
      return next();
    },
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
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Limit the number of messages to retrieve (default: 40)',
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

  // @TODO: Temporary api as we inform users that we are deprecating the original /api/memory/threads/:threadId/messages api.
  router.get(
    '/threads/:threadId/messages/paginated',
    describeRoute({
      description: 'Get paginated messages for a thread',
      tags: ['memory'],
      parameters: [
        {
          name: 'threadId',
          in: 'path',
          required: true,
          description: 'The unique identifier of the thread',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'resourceId',
          in: 'query',
          required: false,
          description: 'Filter messages by resource ID',
          schema: {
            type: 'string',
          },
        },
        {
          name: 'format',
          in: 'query',
          required: false,
          description: 'Message format to return',
          schema: {
            type: 'string',
            enum: ['v1', 'v2'],
            default: 'v1',
          },
        },
        {
          name: 'selectBy',
          in: 'query',
          required: false,
          description: 'JSON string containing selection criteria for messages',
          schema: {
            type: 'string',
            example:
              '{"pagination":{"page":0,"perPage":20,"dateRange":{"start":"2024-01-01T00:00:00Z","end":"2024-12-31T23:59:59Z"}},"include":[{"id":"msg-123","withPreviousMessages":5,"withNextMessages":3}]}',
          },
        },
      ],
      responses: {
        200: {
          description: 'List of messages',
        },
      },
    }),
    getMessagesPaginatedHandler,
  );

  router.get(
    '/threads/:threadId/working-memory',
    describeRoute({
      description: 'Get working memory for a thread',
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
        {
          name: 'resourceId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Working memory details',
        },
        404: {
          description: 'Thread not found',
        },
      },
    }),
    getWorkingMemoryHandler,
  );

  router.post(
    '/threads/:threadId/working-memory',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Update working memory for a thread',
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
            schema: {
              type: 'object',
              properties: {
                workingMemory: { type: 'string' },
                resourceId: { type: 'string' },
              },
              required: ['workingMemory'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Working memory updated successfully',
        },
        404: {
          description: 'Thread not found',
        },
      },
    }),
    updateWorkingMemoryHandler,
  );

  router.post(
    '/threads',
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
                resourceId: { type: 'string' },
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

  router.patch(
    '/threads/:threadId',
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

  router.delete(
    '/threads/:threadId',
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

  router.post(
    '/save-messages',
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

  return router;
}
