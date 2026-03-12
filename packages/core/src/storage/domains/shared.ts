import { z } from 'zod/v4';
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

/** Input type for pagination arguments (page and perPage). */
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

/** Date range with optional inclusive/exclusive boundaries. */
export type DateRange = z.input<typeof dateRangeSchema>;

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

// Parent entity hierarchy fields
export const parentEntityTypeField = z.nativeEnum(EntityType).describe('Entity type of the parent entity');
export const parentEntityIdField = z.string().describe('ID of the parent entity');
export const parentEntityNameField = z.string().describe('Name of the parent entity');

// Root entity hierarchy fields
export const rootEntityTypeField = z.nativeEnum(EntityType).describe('Entity type of the root entity');
export const rootEntityIdField = z.string().describe('ID of the root entity');
export const rootEntityNameField = z.string().describe('Name of the root entity');

// Experimentation
export const experimentIdField = z.string().describe('Experiment or eval run identifier');

// ============================================================================
// Common observability fields (shared across tracing, metrics, logs)
// ============================================================================

export const scopeField = z
  .record(z.string(), z.unknown())
  .describe('Arbitrary package/app version info (e.g., {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"})');

export const metadataField = z.record(z.string(), z.unknown()).describe('User-defined metadata for custom filtering');

export const tagsField = z.array(z.string()).describe('Labels for filtering');

/**
 * Context fields shared across observability signals (metrics, logs).
 * All fields are nullish — each signal uses them as optional context.
 */
export const contextFields = {
  // Entity identification
  entityType: entityTypeField.nullish(),
  entityId: entityIdField.nullish(),
  entityName: entityNameField.nullish(),

  // Parent entity hierarchy
  parentEntityType: parentEntityTypeField.nullish(),
  parentEntityId: parentEntityIdField.nullish(),
  parentEntityName: parentEntityNameField.nullish(),

  // Root entity hierarchy
  rootEntityType: rootEntityTypeField.nullish(),
  rootEntityId: rootEntityIdField.nullish(),
  rootEntityName: rootEntityNameField.nullish(),

  // Identity & tenancy
  userId: userIdField.nullish(),
  organizationId: organizationIdField.nullish(),
  resourceId: resourceIdField.nullish(),

  // Correlation IDs
  runId: runIdField.nullish(),
  sessionId: sessionIdField.nullish(),
  threadId: threadIdField.nullish(),
  requestId: requestIdField.nullish(),

  // Deployment context
  environment: environmentField.nullish(),
  source: sourceField.nullish(),
  serviceName: serviceNameField.nullish(),
  scope: scopeField.nullish(),

  // Experimentation
  experimentId: experimentIdField.nullish(),
} as const;

/**
 * Common filter fields shared across observability signal filters (metrics, logs, scores, feedback).
 * All fields are optional — each signal extends this with signal-specific filters.
 */
export const commonFilterFields = {
  timestamp: dateRangeSchema.optional().describe('Filter by timestamp range'),
  traceId: z.string().optional().describe('Filter by trace ID'),
  spanId: z.string().optional().describe('Filter by span ID'),
  entityType: entityTypeField.optional(),
  entityName: entityNameField.optional(),
  userId: userIdField.optional(),
  organizationId: organizationIdField.optional(),
  experimentId: experimentIdField.optional(),
  serviceName: serviceNameField.optional(),
  environment: environmentField.optional(),
} as const;
