import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { getTelemetryHandler, storeTelemetryHandler } from './handlers';

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
