import { listLogsHandler, listLogsByRunIdHandler, listLogTransports } from '../../handlers/logs';
import { listLogsQuerySchema, listLogsResponseSchema, listLogTransportsResponseSchema } from '../../schemas/logs';
import { createRoute } from './route-builder';
import type { ServerRoute, ServerRouteHandler } from '.';
import { runIdPathParams } from '../../schemas/common';

export const LOGS_ROUTES: ServerRoute[] = [
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: listLogTransports as unknown as ServerRouteHandler,
    path: '/api/logs/transports',
    responseSchema: listLogTransportsResponseSchema,
    summary: 'List log transports',
    description: 'Returns a list of all available log transports',
    tags: ['Logs'],
  }),
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: listLogsHandler as unknown as ServerRouteHandler,
    path: '/api/logs',
    queryParamSchema: listLogsQuerySchema,
    responseSchema: listLogsResponseSchema,
    summary: 'List logs',
    description:
      'Returns logs from a specific transport with optional filtering by date range, log level, and custom filters',
    tags: ['Logs'],
  }),
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: listLogsByRunIdHandler as unknown as ServerRouteHandler,
    path: '/api/logs/:runId',
    pathParamSchema: runIdPathParams,
    queryParamSchema: listLogsQuerySchema,
    responseSchema: listLogsResponseSchema,
    summary: 'List logs by run ID',
    description: 'Returns all logs for a specific execution run from a transport',
    tags: ['Logs'],
  }),
];
