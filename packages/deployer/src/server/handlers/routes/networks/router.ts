import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';
import type { BodyLimitOptions } from '../../../types';
import {
  getNetworksHandler,
  getNetworkByIdHandler,
  generateHandler as generateNetworkHandler,
  streamGenerateHandler as streamGenerateNetworkHandler,
} from './network';
import {
  getVNextNetworksHandler,
  getVNextNetworkByIdHandler,
  generateVNextNetworkHandler,
  loopVNextNetworkHandler,
  loopStreamVNextNetworkHandler,
  streamGenerateVNextNetworkHandler,
} from './vNextNetwork';

export function vNextNetworksRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.get(
    '/v-next',
    describeRoute({
      description: 'Get all available v-next networks',
      tags: ['vNextNetworks'],
      responses: {
        200: {
          description: 'List of all v-next networks',
        },
      },
    }),
    getVNextNetworksHandler,
  );

  router.get(
    '/v-next/:networkId',
    describeRoute({
      description: 'Get v-next network by ID',
      tags: ['vNextNetworks'],
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
          description: 'v-next Network details',
        },
        404: {
          description: 'v-next Network not found',
        },
      },
    }),
    getVNextNetworkByIdHandler,
  );

  router.post(
    '/v-next/:networkId/generate',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Generate a response from a v-next network',
      tags: ['vNextNetworks'],
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
                message: {
                  type: 'string',
                  description: 'Message for the v-next network',
                },
                threadId: {
                  type: 'string',
                  description: 'Thread Id of the conversation',
                },
                resourceId: {
                  type: 'string',
                  description: 'Resource Id of the conversation',
                },
              },
              required: ['message'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Generated response',
        },
        404: {
          description: 'v-next Network not found',
        },
      },
    }),
    generateVNextNetworkHandler,
  );

  router.post(
    '/v-next/:networkId/loop',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Loop a v-next network',
      tags: ['vNextNetworks'],
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
                message: {
                  type: 'string',
                  description: 'Message for the v-next network',
                },
              },
              required: ['message'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Looped response',
        },
        404: {
          description: 'v-next Network not found',
        },
      },
    }),
    loopVNextNetworkHandler,
  );

  router.post(
    '/v-next/:networkId/loop-stream',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Stream a v-next network loop',
      tags: ['vNextNetworks'],
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
                message: {
                  type: 'string',
                  description: 'Message for the v-next network',
                },
                threadId: {
                  type: 'string',
                  description: 'Thread Id of the conversation',
                },
                resourceId: {
                  type: 'string',
                  description: 'Resource Id of the conversation',
                },
                maxIterations: {
                  type: 'number',
                  description: 'Maximum number of iterations to run',
                },
              },
              required: ['message'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'v-next Network not found',
        },
      },
    }),
    loopStreamVNextNetworkHandler,
  );

  router.post(
    '/v-next/:networkId/stream',
    bodyLimit(bodyLimitOptions),
    describeRoute({
      description: 'Stream a response from a v-next network',
      tags: ['vNextNetworks'],
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
                message: {
                  type: 'string',
                  description: 'Message for the v-next network',
                },
                threadId: {
                  type: 'string',
                  description: 'Thread Id of the conversation',
                },
                resourceId: {
                  type: 'string',
                  description: 'Resource Id of the conversation',
                },
              },
              required: ['message'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streamed response',
        },
        404: {
          description: 'v-next Network not found',
        },
      },
    }),
    streamGenerateVNextNetworkHandler,
  );

  return router;
}

export function networksRouter(bodyLimitOptions: BodyLimitOptions) {
  const router = new Hono();

  router.get(
    '/',
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

  router.get(
    '/:networkId',
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

  router.post(
    '/:networkId/generate',
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

  router.post(
    '/:networkId/stream',
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

  return router;
}
