import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { getAITraceHandler, getAITracesPaginatedHandler, processTraceScoringHandler } from './handlers';

export function observabilityRouter() {
  const router = new Hono();

  router.get(
    '/traces',
    describeRoute({
      description: 'Get paginated list of AI traces',
      tags: ['observability'],
      parameters: [
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Page number for pagination (default: 0)',
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Number of items per page (default: 10)',
        },
        {
          name: 'name',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Filter traces by name',
        },
        {
          name: 'spanType',
          in: 'query',
          required: false,
          schema: { type: 'number' },
          description: 'Filter traces by span type',
        },
        {
          name: 'dateRange',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'JSON string with start and end dates for filtering',
        },
        {
          name: 'attributes',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'JSON string with attributes to filter by',
        },
      ],
      responses: {
        200: {
          description: 'Paginated list of AI traces',
        },
        400: {
          description: 'Bad request - invalid parameters',
        },
      },
    }),
    getAITracesPaginatedHandler,
  );

  router.get(
    '/traces/:traceId',
    describeRoute({
      description: 'Get a specific AI trace by ID',
      tags: ['observability'],
      parameters: [
        {
          name: 'traceId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'The ID of the trace to retrieve',
        },
      ],
      responses: {
        200: {
          description: 'AI trace with all its spans',
        },
        400: {
          description: 'Bad request - missing trace ID',
        },
        404: {
          description: 'Trace not found',
        },
      },
    }),
    getAITraceHandler,
  );

  router.post(
    '/traces/score',
    describeRoute({
      description: 'Score traces using a specified scorer',
      tags: ['observability'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['scorerName', 'targets'],
              properties: {
                scorerName: {
                  type: 'string',
                  description: 'Name of the scorer to use for evaluation',
                  example: 'relevance-scorer',
                },
                targets: {
                  type: 'array',
                  description: 'Array of trace targets to score',
                  minItems: 1,
                  items: {
                    type: 'object',
                    required: ['traceId'],
                    properties: {
                      traceId: {
                        type: 'string',
                        description: 'ID of the trace to score',
                        example: 'trace-123',
                      },
                      spanId: {
                        type: 'string',
                        description: 'Optional specific span ID within the trace to score',
                        example: 'span-456',
                      },
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
          description: 'Scoring initiated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                  },
                  traceCount: {
                    type: 'number',
                    example: 3,
                  },
                  status: {
                    type: 'string',
                    enum: ['initiated'],
                    example: 'initiated',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - invalid parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        404: {
          description: 'Scorer not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    }),
    processTraceScoringHandler,
  );

  return router;
}
