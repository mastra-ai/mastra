import z from 'zod';
import { createPagePaginationSchema } from './memory';

// Path parameter schemas
export const transportIdPathParams = z.object({
  transportId: z.string().describe('Unique identifier for the log transport'),
});

export const transportRunIdPathParams = z.object({
  transportId: z.string().describe('Unique identifier for the log transport'),
  runId: z.string().describe('Unique identifier for the run'),
});

// Query parameter schemas
export const listLogsQuerySchema = createPagePaginationSchema().extend({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  filters: z.union([z.string(), z.array(z.string())]).optional(),
});

// Response schemas
export const listLogsResponseSchema = z.object({
  logs: z.array(z.unknown()), // BaseLogMessage - complex type
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  hasMore: z.boolean(),
});

export const listLogTransportsResponseSchema = z.object({
  transports: z.array(z.string()),
});
