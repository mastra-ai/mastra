import z from 'zod';
import { getAITracesPaginatedHandler } from '../../handlers/observability';
import { getAITracesPaginatedResponseSchema } from '../../schemas/observability';
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
    description: 'Returns a paginated list of AI execution traces with optional filtering by name, type, date range, and entity',
    tags: ['Observability'],
  }),
];
