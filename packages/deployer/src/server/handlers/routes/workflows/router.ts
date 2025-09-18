import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  cancelWorkflowRunHandler,
  createWorkflowRunHandler,
  getWorkflowByIdHandler,
  getWorkflowRunByIdHandler,
  getWorkflowRunExecutionResultHandler,
  getWorkflowRunsHandler,
  getWorkflowsHandler,
  resumeAsyncWorkflowHandler,
  resumeWorkflowHandler,
  sendWorkflowRunEventHandler,
  startAsyncWorkflowHandler,
  startWorkflowRunHandler,
  streamWorkflowHandler,
  observeStreamWorkflowHandler,
  streamVNextWorkflowHandler,
  watchWorkflowHandler,
} from './handlers';
import {
  createLegacyWorkflowRunHandler,
  getLegacyWorkflowByIdHandler,
  getLegacyWorkflowRunsHandler,
  getLegacyWorkflowsHandler,
  resumeAsyncLegacyWorkflowHandler,
  resumeLegacyWorkflowHandler,
  startAsyncLegacyWorkflowHandler,
  startLegacyWorkflowRunHandler,
  watchLegacyWorkflowHandler,
} from './legacyWorkflows';

export function workflowsRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.get(
    '/legacy',
    describeRoute({
      description: 'Get all legacy workflows',
      tags: ['legacyWorkflows'],
      responses: {
        200: {
          description: 'List of all legacy workflows',
        },
      },
    }),
    getLegacyWorkflowsHandler,
  );

  router.get(
    '/legacy/:workflowId',
    describeRoute({
      description: 'Get legacy workflow by ID',
      tags: ['legacyWorkflows'],
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
          description: 'Legacy Workflow details',
        },
        404: {
          description: 'Legacy Workflow not found',
        },
      },
    }),
    getLegacyWorkflowByIdHandler,
  );

  router.get(
    '/legacy/:workflowId/runs',
    describeRoute({
      description: 'Get all runs for a legacy workflow',
      tags: ['legacyWorkflows'],
      parameters: [
        {
          name: 'workflowId',
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
          description: 'List of legacy workflow runs from storage',
        },
      },
    }),
    getLegacyWorkflowRunsHandler,
  );

  router.post(
    '/legacy/:workflowId/resume',
    describeRoute({
      description: 'Resume a suspended legacy workflow step',
      tags: ['legacyWorkflows'],
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
    resumeLegacyWorkflowHandler,
  );

  router.post(
    '/legacy/:workflowId/resume-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Resume a suspended legacy workflow step',
      tags: ['legacyWorkflows'],
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
    resumeAsyncLegacyWorkflowHandler,
  );

  router.post(
    '/legacy/:workflowId/create-run',
    describeRoute({
      description: 'Create a new legacy workflow run',
      tags: ['legacyWorkflows'],
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
          description: 'New legacy workflow run created',
        },
      },
    }),
    createLegacyWorkflowRunHandler,
  );

  router.post(
    '/legacy/:workflowId/start-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Execute/Start a legacy workflow',
      tags: ['legacyWorkflows'],
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
          description: 'Legacy Workflow execution result',
        },
        404: {
          description: 'Legacy Workflow not found',
        },
      },
    }),
    startAsyncLegacyWorkflowHandler,
  );

  router.post(
    '/legacy/:workflowId/start',
    describeRoute({
      description: 'Create and start a new legacy workflow run',
      tags: ['legacyWorkflows'],
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
          description: 'Legacy Workflow run started',
        },
        404: {
          description: 'Legacy Workflow not found',
        },
      },
    }),
    startLegacyWorkflowRunHandler,
  );

  router.get(
    '/legacy/:workflowId/watch',
    describeRoute({
      description: 'Watch legacy workflow transitions in real-time',
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
      tags: ['legacyWorkflows'],
      responses: {
        200: {
          description: 'Legacy Workflow transitions in real-time',
        },
      },
    }),
    watchLegacyWorkflowHandler,
  );

  // Workflow routes
  router.get(
    '/',
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

  router.get(
    '/:workflowId',
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

  router.get(
    '/:workflowId/runs',
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
        { name: 'fromDate', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        { name: 'toDate', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
        { name: 'offset', in: 'query', required: false, schema: { type: 'number' } },
        { name: 'resourceId', in: 'query', required: false, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'List of workflow runs from storage',
        },
      },
    }),
    getWorkflowRunsHandler,
  );

  router.get(
    '/:workflowId/runs/:runId/execution-result',
    describeRoute({
      description: 'Get execution result for a workflow run',
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
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Workflow run execution result',
        },
        404: {
          description: 'Workflow run execution result not found',
        },
      },
    }),
    getWorkflowRunExecutionResultHandler,
  );

  router.get(
    '/:workflowId/runs/:runId',
    describeRoute({
      description: 'Get workflow run by ID',
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
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Workflow run by ID',
        },
        404: {
          description: 'Workflow run not found',
        },
      },
    }),
    getWorkflowRunByIdHandler,
  );

  router.post(
    '/:workflowId/resume',
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
                step: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                resumeData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the workflow execution',
                },
              },
              required: ['step'],
            },
          },
        },
      },
    }),
    resumeWorkflowHandler,
  );

  router.post(
    '/:workflowId/resume-async',
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
                step: {
                  oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
                },
                resumeData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the workflow execution',
                },
              },
              required: ['step'],
            },
          },
        },
      },
    }),
    resumeAsyncWorkflowHandler,
  );

  router.post(
    '/:workflowId/stream',
    describeRoute({
      description: 'Stream workflow in real-time',
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
                inputData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the workflow execution',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'workflow run started',
        },
        404: {
          description: 'workflow not found',
        },
      },
      tags: ['workflows'],
    }),
    streamWorkflowHandler,
  );

  router.post(
    '/:workflowId/observe-stream',
    describeRoute({
      description: 'Observe workflow stream in real-time',
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
      responses: {
        200: {
          description: 'workflow stream observed',
        },
        404: {
          description: 'workflow not found',
        },
      },
      tags: ['workflows'],
    }),
    observeStreamWorkflowHandler,
  );

  router.post(
    '/:workflowId/streamVNext',
    describeRoute({
      description: 'Stream workflow in real-time using the VNext streaming API',
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
                inputData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the workflow execution',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'workflow run started',
        },
        404: {
          description: 'workflow not found',
        },
      },
      tags: ['workflows'],
    }),
    streamVNextWorkflowHandler,
  );

  router.post(
    '/:workflowId/create-run',
    bodyLimit(bodyLimitOptions),
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
    createWorkflowRunHandler,
  );

  router.post(
    '/:workflowId/start-async',
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
                inputData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the workflow execution',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'workflow execution result',
        },
        404: {
          description: 'workflow not found',
        },
      },
    }),
    startAsyncWorkflowHandler,
  );

  router.post(
    '/:workflowId/start',
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
                inputData: { type: 'object' },
                runtimeContext: {
                  type: 'object',
                  description: 'Runtime context for the workflow execution',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'workflow run started',
        },
        404: {
          description: 'workflow not found',
        },
      },
    }),
    startWorkflowRunHandler,
  );

  router.get(
    '/:workflowId/watch',
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
          description: 'workflow transitions in real-time',
        },
      },
    }),
    watchWorkflowHandler,
  );

  router.post(
    '/:workflowId/runs/:runId/cancel',
    describeRoute({
      description: 'Cancel a workflow run',
      parameters: [
        {
          name: 'workflowId',
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
      tags: ['workflows'],
      responses: {
        200: {
          description: 'workflow run cancelled',
        },
      },
    }),
    cancelWorkflowRunHandler,
  );

  router.post(
    '/:workflowId/runs/:runId/send-event',
    describeRoute({
      description: 'Send an event to a workflow run',
      parameters: [
        {
          name: 'workflowId',
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
      tags: ['workflows'],
      responses: {
        200: {
          description: 'workflow run event sent',
        },
      },
    }),
    sendWorkflowRunEventHandler,
  );

  return router;
}
