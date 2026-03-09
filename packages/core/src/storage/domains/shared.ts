import { z } from 'zod';
import { EntityType } from '../../observability';

/**
 * Common DB fields
 */
export const createdAtField = z.date().describe('Database record creation time');

export const updatedAtField = z.date().describe('Database record last update time');

export const dbTimestamps = {
  createdAt: createdAtField,
  updatedAt: updatedAtField.nullable(),
} as const satisfies z.ZodRawShape;

/**
 * Pagination arguments for list queries (page and perPage only)
 * Uses z.coerce to handle string → number conversion from query params
 */
export const paginationArgsSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().default(0).describe('Zero-indexed page number'),
    perPage: z.coerce.number().int().min(1).max(100).optional().default(10).describe('Number of items per page'),
  })
  .describe('Pagination options for list queries');

export type PaginationArgs = z.input<typeof paginationArgsSchema>;

/**
 * Pagination response info
 * Used across all paginated endpoints
 */
export const paginationInfoSchema = z.object({
  total: z.number().describe('Total number of items available'),
  page: z.number().describe('Current page'),
  perPage: z
    .union([z.number(), z.literal(false)])
    .describe('Number of items per page, or false if pagination is disabled'),
  hasMore: z.boolean().describe('True if more pages are available'),
});

/**
 * Date range for filtering by time
 * Uses z.coerce to handle ISO string → Date conversion from query params
 */
export const dateRangeSchema = z
  .object({
    start: z.coerce.date().optional().describe('Start of date range (inclusive by default)'),
    end: z.coerce.date().optional().describe('End of date range (inclusive by default)'),
    startExclusive: z
      .boolean()
      .optional()
      .describe('When true, excludes the start date from results (uses > instead of >=)'),
    endExclusive: z
      .boolean()
      .optional()
      .describe('When true, excludes the end date from results (uses < instead of <=)'),
  })
  .describe('Date range filter for timestamps');

export type DateRange = z.infer<typeof dateRangeSchema>;

export const sortDirectionSchema = z.enum(['ASC', 'DESC']).describe("Sort direction: 'ASC' | 'DESC'");

export const entityTypeField = z
  .nativeEnum(EntityType)
  .describe(`Entity type (e.g., 'agent' | 'processor' | 'tool' | 'workflow')`);

export const entityIdField = z.string().describe('ID of the entity (e.g., "weatherAgent", "orderWorkflow")');

export const entityNameField = z.string().describe('Name of the entity');

export const userIdField = z.string().describe('Human end-user who triggered execution');

export const organizationIdField = z.string().describe('Multi-tenant organization/account');

export const resourceIdField = z.string().describe('Broader resource context (Mastra memory compatibility)');

export const runIdField = z.string().describe('Unique execution run identifier');

export const sessionIdField = z.string().describe('Session identifier for grouping traces');

export const threadIdField = z.string().describe('Conversation thread identifier');

export const requestIdField = z.string().describe('HTTP request ID for log correlation');

export const environmentField = z.string().describe(`Environment (e.g., "production" | "staging" | "development")`);

export const sourceField = z.string().describe(`Source of execution (e.g., "local" | "cloud" | "ci")`);

export const serviceNameField = z.string().describe('Name of the service');
