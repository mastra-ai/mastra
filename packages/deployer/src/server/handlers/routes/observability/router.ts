import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { getAITraceHandler, getAITracesPaginatedHandler } from './handlers';

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

  return router;
}
