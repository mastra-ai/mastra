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
  listWorkflowRunsHandler,
  listWorkflowsHandler,
  resumeAsyncWorkflowHandler,
  resumeWorkflowHandler,
  startAsyncWorkflowHandler,
  startWorkflowRunHandler,
  streamVNextWorkflowHandler,
  resumeStreamWorkflowHandler,
  observeStreamVNextWorkflowHandler,
  streamLegacyWorkflowHandler,
  observeStreamLegacyWorkflowHandler,
} from './handlers';

export function workflowsRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

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
    listWorkflowsHandler,
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
      description: 'List all runs for a workflow',
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
    listWorkflowRunsHandler,
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
              },
            },
          },
        },
      },
    }),
    resumeWorkflowHandler,
  );

  router.post(
    '/:workflowId/resume-stream',
    describeRoute({
      description: 'Resume a suspended workflow that uses streamVNext',
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the workflow execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    resumeStreamWorkflowHandler,
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
              },
            },
          },
        },
      },
    }),
    resumeAsyncWorkflowHandler,
  );

  router.post(
    '/:workflowId/stream-legacy',
    describeRoute({
      description: 'Stream legacy workflow in real-time',
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the workflow execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
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
    streamLegacyWorkflowHandler,
  );

  router.post(
    '/:workflowId/observe-stream-legacy',
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
    observeStreamLegacyWorkflowHandler,
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
                closeOnSuspend: {
                  type: 'boolean',
                  description: 'Close the stream on suspend',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the workflow execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
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
    '/:workflowId/observe',
    describeRoute({
      description: 'Observe workflow stream in real-time using the streaming API',
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
    observeStreamVNextWorkflowHandler,
  );

  router.post(
    '/:workflowId/stream',
    describeRoute({
      description: 'Stream workflow in real-time using the streaming API',
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
                closeOnSuspend: {
                  type: 'boolean',
                  description: 'Close the stream on suspend',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the workflow execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
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
    '/:workflowId/observe-streamVNext',
    describeRoute({
      description: 'Observe workflow stream in real-time using the VNext streaming API',
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
          description: 'workflow stream vNext observed',
        },
        404: {
          description: 'workflow not found',
        },
      },
      tags: ['workflows'],
    }),
    observeStreamVNextWorkflowHandler,
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the workflow execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
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
      description: 'Start an existing workflow run',
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
                requestContext: {
                  type: 'object',
                  description: 'Request Context for the workflow execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the workflow execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
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

  return router;
}
