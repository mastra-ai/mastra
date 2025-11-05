import z from 'zod';
import { getAITracesPaginatedHandler } from '../../handlers/observability';
import type { ServerRoute, ServerRouteHandler } from '.';

export const OBSERVABILITY_ROUTES: ServerRoute[] = [
  {
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
  },
];
