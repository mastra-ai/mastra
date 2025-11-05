import z from 'zod';

// Path parameter schemas
export const transportIdPathParams = z.object({
  transportId: z.string().describe('Unique identifier for the log transport'),
});

export const transportRunIdPathParams = z.object({
  transportId: z.string().describe('Unique identifier for the log transport'),
  runId: z.string().describe('Unique identifier for the run'),
});

// Query parameter schemas
export const listLogsQuerySchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  filters: z.union([z.string(), z.array(z.string())]).optional(),
  page: z.coerce.number().optional(),
  perPage: z.coerce.number().optional(),
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
