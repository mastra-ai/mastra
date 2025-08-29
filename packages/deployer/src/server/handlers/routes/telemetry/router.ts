import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { getTelemetryHandler, getTraceHandler, storeTelemetryHandler } from './handlers';

export function telemetryRouter() {
  const router = new Hono();

  router.get(
    '/',
    describeRoute({
      description: 'Get all traces',
      tags: ['telemetry'],
      responses: {
        200: {
          description: 'List of all traces (paged)',
        },
      },
    }),
    getTelemetryHandler,
  );

  router.get(
    '/:traceId',
    describeRoute({
      description: 'Get a trace',
      tags: ['telemetry'],
      responses: {
        200: {
          description: 'Fetch all spans for a trace',
        },
      },
    }),
    getTraceHandler,
  );

  router.post(
    '/',
    describeRoute({
      description: 'Store telemetry',
      tags: ['telemetry'],
      responses: {
        200: {
          description: 'Traces stored',
        },
      },
    }),
    storeTelemetryHandler,
  );

  return router;
}
