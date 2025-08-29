import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  createTemplateInstallRunHandler,
  startAsyncTemplateInstallHandler,
  startTemplateInstallRunHandler,
  streamTemplateInstallHandler,
  streamVNextTemplateInstallHandler,
  watchTemplateInstallHandler,
  resumeAsyncTemplateInstallHandler,
  resumeTemplateInstallHandler,
  getTemplateInstallRunsHandler,
  getTemplateInstallRunByIdHandler,
  getTemplateInstallRunExecutionResultHandler,
  cancelTemplateInstallRunHandler,
  sendTemplateInstallRunEventHandler,
  getAgentBuilderWorkflow,
} from './handlers';

export function templatesRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.get(
    '/agent-builder-workflow',
    describeRoute({
      description: 'Get the agent builder workflow',
      tags: ['templates'],
    }),
    getAgentBuilderWorkflow,
  );

  // Template run management endpoints
  router.get(
    '/:templateSlug/runs',
    describeRoute({
      description: 'Get all runs for a template installation',
      tags: ['templates'],
      parameters: [
        {
          name: 'templateSlug',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        { name: 'fromDate', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        { name: 'toDate', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
        { name: 'offset', in: 'query', required: false, schema: { type: 'number' } },
        { name: 'resourceId', in: 'query', required: false, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'List of template installation runs from storage',
        },
      },
    }),
    getTemplateInstallRunsHandler,
  );

  router.get(
    '/:templateSlug/runs/:runId/execution-result',
    describeRoute({
      description: 'Get execution result for a template installation run',
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
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Template installation run execution result',
        },
        404: {
          description: 'Template installation run execution result not found',
        },
      },
    }),
    getTemplateInstallRunExecutionResultHandler,
  );

  router.get(
    '/:templateSlug/runs/:runId',
    describeRoute({
      description: 'Get template installation run by ID',
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
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Template installation run by ID',
        },
        404: {
          description: 'Template installation run not found',
        },
      },
    }),
    getTemplateInstallRunByIdHandler,
  );

  // Resume endpoints
  router.post(
    '/:templateSlug/resume',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Resume a suspended template installation step',
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
                step: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                resumeData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the template installation execution',
                },
              },
              required: ['step'],
            },
          },
        },
      },
    }),
    resumeTemplateInstallHandler,
  );

  router.post(
    '/:templateSlug/resume-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Resume a suspended template installation step',
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
                step: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                resumeData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the template installation execution',
                },
              },
              required: ['step'],
            },
          },
        },
      },
    }),
    resumeAsyncTemplateInstallHandler,
  );

  // Core execution endpoints
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
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the template installation execution',
                },
              },
              required: ['repo'],
            },
          },
        },
      },
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
    '/:templateSlug/start',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create and start a new template installation run',
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
          description: 'Template installation run started',
        },
        404: {
          description: 'Template not found',
        },
      },
    }),
    startTemplateInstallRunHandler,
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
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the template installation execution',
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

  router.post(
    '/:templateSlug/streamVNext',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Stream template installation progress in real-time using the VNext streaming API',
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
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the template installation execution',
                },
              },
              required: ['repo'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Template installation run started',
        },
        404: {
          description: 'Template not found',
        },
      },
    }),
    streamVNextTemplateInstallHandler,
  );

  router.get(
    '/:templateSlug/watch',
    describeRoute({
      description: 'Watch template installation transitions in real-time',
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
      tags: ['templates'],
      responses: {
        200: {
          description: 'Template installation transitions in real-time',
        },
      },
    }),
    watchTemplateInstallHandler,
  );

  router.post(
    '/:templateSlug/runs/:runId/cancel',
    describeRoute({
      description: 'Cancel a template installation run',
      parameters: [
        {
          name: 'templateSlug',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      tags: ['templates'],
      responses: {
        200: {
          description: 'Template installation run cancelled',
        },
      },
    }),
    cancelTemplateInstallRunHandler,
  );

  router.post(
    '/:templateSlug/runs/:runId/send-event',
    describeRoute({
      description: 'Send an event to a template installation run',
      parameters: [
        {
          name: 'templateSlug',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'runId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object', properties: { event: { type: 'string' }, data: { type: 'object' } } },
          },
        },
      },
      tags: ['templates'],
      responses: {
        200: {
          description: 'Template installation run event sent',
        },
      },
    }),
    sendTemplateInstallRunEventHandler,
  );

  return router;
}
