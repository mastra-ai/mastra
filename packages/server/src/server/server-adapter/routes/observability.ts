import z from 'zod';
import {
  getAITracesPaginatedHandler,
  getAITraceHandler,
  scoreTracesHandler,
  listScoresBySpan,
} from '../../handlers/observability';
import {
  getAITracesPaginatedResponseSchema,
  getAITraceResponseSchema,
  scoreTracesBodySchema,
  scoreTracesResponseSchema,
  listScoresBySpanResponseSchema,
  traceIdPathParams,
  traceSpanPathParams,
  listScoresBySpanQuerySchema,
} from '../../schemas/observability';
import { createRoute } from './route-builder';
import type { ServerRoute, ServerRouteHandler } from '.';

export const OBSERVABILITY_ROUTES: ServerRoute[] = [
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: getAITracesPaginatedHandler as unknown as ServerRouteHandler,
    path: '/api/observability/traces',
    queryParamSchema: z.object({
      page: z.coerce.number().optional().default(0),
      perPage: z.coerce.number().optional().default(10),
      name: z.string().optional(),
      spanType: z.string().optional(),
      dateRange: z.string().optional(),
      entityId: z.string().optional(),
      entityType: z.string().optional(),
    }),
    responseSchema: getAITracesPaginatedResponseSchema,
    summary: 'Get AI traces',
    description:
      'Returns a paginated list of AI execution traces with optional filtering by name, type, date range, and entity',
    tags: ['Observability'],
  }),
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: getAITraceHandler as unknown as ServerRouteHandler,
    path: '/api/observability/traces/:traceId',
    pathParamSchema: traceIdPathParams,
    responseSchema: getAITraceResponseSchema,
    summary: 'Get AI trace by ID',
    description: 'Returns a complete AI trace with all spans by trace ID',
    tags: ['Observability'],
  }),
  createRoute({
    method: 'POST',
    responseType: 'json',
    handler: scoreTracesHandler as unknown as ServerRouteHandler,
    path: '/api/observability/traces/score',
    bodySchema: scoreTracesBodySchema,
    responseSchema: scoreTracesResponseSchema,
    summary: 'Score traces',
    description: 'Scores one or more traces using a specified scorer (fire-and-forget)',
    tags: ['Observability'],
  }),
  createRoute({
    method: 'GET',
    responseType: 'json',
    handler: listScoresBySpan as unknown as ServerRouteHandler,
    path: '/api/observability/traces/:traceId/spans/:spanId/scores',
    pathParamSchema: traceSpanPathParams,
    queryParamSchema: listScoresBySpanQuerySchema,
    responseSchema: listScoresBySpanResponseSchema,
    summary: 'List scores by span',
    description: 'Returns all scores for a specific span within a trace',
    tags: ['Observability'],
  }),
];
