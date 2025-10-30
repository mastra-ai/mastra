import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { listLogsByRunIdHandler, listLogsHandler, listLogTransports } from './handlers';

export function logsRouter() {
  const router = new Hono();

  router.get(
    '/',
    describeRoute({
      description: 'Get all logs',
      tags: ['logs'],
      parameters: [
        {
          name: 'transportId',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'fromDate',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'toDate',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'logLevel',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'filters',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number' },
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number' },
        },
      ],
      responses: {
        200: {
          description: 'Paginated list of all logs',
        },
      },
    }),
    listLogsHandler,
  );

  router.get(
    '/transports',
    describeRoute({
      description: 'List of all log transports',
      tags: ['logs'],
      responses: {
        200: {
          description: 'List of all log transports',
        },
      },
    }),
    listLogTransports,
  );

  router.get(
    '/:runId',
    describeRoute({
      description: 'Get logs by run ID',
      tags: ['logs'],
      parameters: [
        {
          name: 'runId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'transportId',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
        {
          name: 'fromDate',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'toDate',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'logLevel',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'filters',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          schema: { type: 'number' },
        },
        {
          name: 'perPage',
          in: 'query',
          required: false,
          schema: { type: 'number' },
        },
      ],
      responses: {
        200: {
          description: 'Paginated list of logs for run ID',
        },
      },
    }),
    listLogsByRunIdHandler,
  );

  return router;
}
