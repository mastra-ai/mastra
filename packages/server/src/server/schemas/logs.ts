import z from 'zod';
import { createPagePaginationSchema, baseLogMessageSchema } from './common';

// Query parameter schemas
export const listLogsQuerySchema = createPagePaginationSchema().extend({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  filters: z.union([z.string(), z.array(z.string())]).optional(),
  transportId: z.string(),
});

// Response schemas
export const listLogsResponseSchema = z.object({
  logs: z.array(baseLogMessageSchema),
  total: z.number(),
  page: z.number(),
  perPage: z.union([z.number(), z.literal(false)]),
  hasMore: z.boolean(),
});

export const listLogTransportsResponseSchema = z.object({
  transports: z.array(z.string()),
});
