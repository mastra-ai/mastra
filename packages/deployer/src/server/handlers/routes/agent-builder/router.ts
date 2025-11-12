import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  createAgentBuilderActionRunHandler,
  getAgentBuilderActionByIdHandler,
  getAgentBuilderActionRunByIdHandler,
  getAgentBuilderActionRunExecutionResultHandler,
  getAgentBuilderActionRunsHandler,
  getAgentBuilderActionsHandler,
  resumeAgentBuilderActionHandler,
  resumeAsyncAgentBuilderActionHandler,
  resumeStreamAgentBuilderActionHandler,
  startAgentBuilderActionRunHandler,
  startAsyncAgentBuilderActionHandler,
  streamAgentBuilderActionHandler,
  streamLegacyAgentBuilderActionHandler,
  streamVNextAgentBuilderActionHandler,
  observeStreamLegacyAgentBuilderActionHandler,
  observeStreamAgentBuilderActionHandler,
  observeStreamVNextAgentBuilderActionHandler,
  cancelAgentBuilderActionRunHandler,
} from './handlers';

export function agentBuilderRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  // Agent builder routes
  router.get(
    '/',
    describeRoute({
      description: 'Get all agent builder actions',
      tags: ['agent-builder'],
      responses: {
        200: {
          description: 'List of all agent builder actions',
        },
      },
    }),
    getAgentBuilderActionsHandler,
  );

  router.get(
    '/:actionId',
    describeRoute({
      description: 'Get agent builder action by ID',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Agent builder action details',
        },
        404: {
          description: 'Agent builder action not found',
        },
      },
    }),
    getAgentBuilderActionByIdHandler,
  );

  router.get(
    '/:actionId/runs',
    describeRoute({
      description: 'Get all runs for an agent builder action',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
          description: 'List of agent builder action runs from storage',
        },
      },
    }),
    getAgentBuilderActionRunsHandler,
  );

  router.get(
    '/:actionId/runs/:runId/execution-result',
    describeRoute({
      description: 'Get execution result for an agent builder action run',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
          description: 'Agent builder action run execution result',
        },
        404: {
          description: 'Agent builder action run execution result not found',
        },
      },
    }),
    getAgentBuilderActionRunExecutionResultHandler,
  );

  router.get(
    '/:actionId/runs/:runId',
    describeRoute({
      description: 'Get agent builder action run by ID',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
          description: 'Agent builder action run by ID',
        },
        404: {
          description: 'Agent builder action run not found',
        },
      },
    }),
    getAgentBuilderActionRunByIdHandler,
  );

  router.post(
    '/:actionId/resume',
    describeRoute({
      description: 'Resume a suspended agent builder action step',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
    resumeAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/resume-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Resume a suspended agent builder action step',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
    resumeAsyncAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/resume-stream',
    describeRoute({
      description: 'Resume a suspended agent builder action that uses streamVNext',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
                  properties: {
                    metadata: {
                      type: 'object',
                      description: 'Custom metadata to attach to the trace',
                      additionalProperties: true,
                    },
                  },
                },
              },
              required: ['step'],
            },
          },
        },
      },
    }),
    resumeStreamAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/stream-legacy',
    describeRoute({
      description: 'Stream legacy agent builder action in real-time',
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
          description: 'agent builder action run started',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
      tags: ['agent-builder'],
    }),
    streamLegacyAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/observe-stream-legacy',
    describeRoute({
      description: 'Observe agent builder action stream in real-time',
      parameters: [
        {
          name: 'actionId',
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
          description: 'agent builder action stream observed',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
      tags: ['agent-builder'],
    }),
    observeStreamLegacyAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/stream',
    describeRoute({
      description: 'Stream agent builder action in real-time',
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
          description: 'agent builder action run started',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
      tags: ['agent-builder'],
    }),
    streamAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/observe',
    describeRoute({
      description: 'Observe agent builder action stream in real-time using the streaming API',
      parameters: [
        {
          name: 'actionId',
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
          description: 'agent builder action stream observed',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
      tags: ['agent-builder'],
    }),
    observeStreamAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/observe-streamVNext',
    describeRoute({
      description: 'Observe agent builder action stream in real-time using the VNext streaming API',
      parameters: [
        {
          name: 'actionId',
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
          description: 'agent builder action stream vNext observed',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
      tags: ['agent-builder'],
    }),
    observeStreamVNextAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/streamVNext',
    describeRoute({
      description: 'Stream agent builder action in real-time using the VNext streaming API',
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                closeOnSuspend: {
                  type: 'boolean',
                  description: 'Close the stream on suspend',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
          description: 'agent builder action run started',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
      tags: ['agent-builder'],
    }),
    streamVNextAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/create-run',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Create a new agent builder action run',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
          description: 'New agent builder action run created',
        },
      },
    }),
    createAgentBuilderActionRunHandler,
  );

  router.post(
    '/:actionId/start-async',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Execute/Start an agent builder action',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
          description: 'agent builder action execution result',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
    }),
    startAsyncAgentBuilderActionHandler,
  );

  router.post(
    '/:actionId/start',
    describeRoute({
      description: 'Create and start a new agent builder action run',
      tags: ['agent-builder'],
      parameters: [
        {
          name: 'actionId',
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
                  description: 'Request Context for the agent builder action execution',
                },
                tracingOptions: {
                  type: 'object',
                  description: 'Tracing options for the action execution',
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
          description: 'agent builder action run started',
        },
        404: {
          description: 'agent builder action not found',
        },
      },
    }),
    startAgentBuilderActionRunHandler,
  );

  router.post(
    '/:actionId/runs/:runId/cancel',
    describeRoute({
      description: 'Cancel an agent builder action run',
      parameters: [
        {
          name: 'actionId',
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
      tags: ['agent-builder'],
      responses: {
        200: {
          description: 'agent builder action run cancelled',
        },
      },
    }),
    cancelAgentBuilderActionRunHandler,
  );

  return router;
}
