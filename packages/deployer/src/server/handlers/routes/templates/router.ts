import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  createTemplateInstallRunHandler,
  startAsyncTemplateInstallHandler,
  streamTemplateInstallHandler,
} from './handlers';

export function templatesRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.post(
    '/:templateSlug/create-run',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new template installation run',
      tags: ['templates'],
      parameters: [
        {
          name: 'templateSlug',
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
          description: 'Template installation run created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  runId: { type: 'string' },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request',
        },
        500: {
          description: 'Internal server error',
        },
      },
    }),
    createTemplateInstallRunHandler,
  );

  router.post(
    '/:templateSlug/start-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Start an async template installation and wait for completion',
      tags: ['templates'],
      parameters: [
        {
          name: 'templateSlug',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'The run ID to start',
        },
      ],
      responses: {
        200: {
          description: 'Template installation result',
        },
        400: {
          description: 'Bad request',
        },
        500: {
          description: 'Internal server error',
        },
      },
    }),
    startAsyncTemplateInstallHandler,
  );

  router.post(
    '/:templateSlug/stream',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Stream template installation progress in real-time',
      tags: ['templates'],
      parameters: [
        {
          name: 'templateSlug',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'The run ID to stream (optional - will create new run if not provided)',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                repo: {
                  type: 'string',
                  description: 'Template repository URL or slug',
                },
                ref: {
                  type: 'string',
                  description: 'Git ref (branch/tag/commit) to install from',
                },
                slug: {
                  type: 'string',
                  description: 'Template slug for identification',
                },
                targetPath: {
                  type: 'string',
                  description: 'Target project path',
                },
                variables: {
                  type: 'object',
                  description: 'Environment variables for template',
                },
              },
              required: ['repo'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Template installation progress stream',
          headers: {
            'Transfer-Encoding': {
              schema: { type: 'string', enum: ['chunked'] },
            },
          },
        },
        400: {
          description: 'Bad request',
        },
        500: {
          description: 'Internal server error',
        },
      },
    }),
    streamTemplateInstallHandler,
  );

  return router;
}
