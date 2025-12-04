import qs from 'qs';
import { z } from 'zod';

import { SpanType } from '../../observability';

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Entity types for span classification
 */
export const spanEntityTypeSchema = z
  .enum(['agent', 'workflow', 'tool', 'network', 'step'])
  .describe("Entity type: 'agent' | 'workflow' | 'tool' | 'network' | 'step'");

/**
 * Derived span status (computed from error/endedAt, not stored)
 */
export const spanStatusSchema = z
  .enum(['success', 'error', 'running'])
  .describe("Derived status: 'error' = has error, 'running' = no endedAt, 'success' = endedAt and no error");

/**
 * Span type enum values
 */
export const spanTypeSchema = z.nativeEnum(SpanType).describe('Span type classification');

// ============================================================================
// Core Type Schemas (source of truth with proper types)
// ============================================================================

/**
 * Pagination arguments for list queries (page and perPage only)
 * Uses z.coerce to handle string → number conversion from query params
 */
export const paginationArgsSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().describe('Zero-indexed page number'),
    perPage: z.coerce.number().int().min(1).optional().describe('Number of items per page'),
  })
  .describe('Pagination options for list queries');

/**
 * Date range for filtering by time
 * Uses z.coerce to handle ISO string → Date conversion from query params
 */
export const dateRangeSchema = z
  .object({
    start: z.coerce.date().optional().describe('Start of date range (inclusive)'),
    end: z.coerce.date().optional().describe('End of date range (inclusive)'),
  })
  .describe('Date range filter for timestamps');

/**
 * Fields available for ordering trace results
 */
export const tracesOrderByFieldSchema = z
  .enum(['startedAt', 'endedAt'])
  .describe("Field to order by: 'startedAt' | 'endedAt'");

/**
 * Sort direction for ordering
 */
export const sortDirectionSchema = z.enum(['ASC', 'DESC']).describe("Sort direction: 'ASC' | 'DESC'");

/**
 * Order by configuration for trace queries
 * Follows the existing StorageOrderBy pattern
 */
export const tracesOrderBySchema = z
  .object({
    field: tracesOrderByFieldSchema.optional().describe('Field to order by'),
    direction: sortDirectionSchema.optional().describe('Sort direction'),
  })
  .describe('Order by configuration');

/**
 * Filters for querying traces (with proper types)
 */
export const tracesFilterSchema = z
  .object({
    // Date range filters for startedAt and endedAt
    startedAt: dateRangeSchema.optional().describe('Filter by span start time range'),
    endedAt: dateRangeSchema.optional().describe('Filter by span end time range'),

    // Span type filter
    spanType: spanTypeSchema.optional().describe('Filter by span type'),

    // Entity filters
    entityType: spanEntityTypeSchema.optional().describe('Filter by entity type'),
    entityId: z.string().optional().describe('Filter by entity ID (e.g., "weatherAgent", "orderWorkflow")'),
    entityName: z.string().optional().describe('Filter by human-readable entity name'),

    // Identity & Tenancy filters
    userId: z.string().optional().describe('Filter by human end-user who triggered the trace'),
    organizationId: z.string().optional().describe('Filter by multi-tenant organization/account'),
    resourceId: z.string().optional().describe('Filter by resource context (Mastra memory compatibility)'),

    // Correlation ID filters
    runId: z.string().optional().describe('Filter by unique execution run identifier'),
    sessionId: z.string().optional().describe('Filter by session identifier for grouping traces'),
    threadId: z.string().optional().describe('Filter by conversation thread identifier'),
    requestId: z.string().optional().describe('Filter by HTTP request ID for log correlation'),

    // Deployment context filters
    environment: z.string().optional().describe("Filter by environment: 'production' | 'staging' | 'development'"),
    source: z.string().optional().describe("Filter by source: 'local' | 'cloud' | 'ci'"),
    serviceName: z.string().optional().describe('Filter by service name'),
    deploymentId: z.string().optional().describe('Filter by specific deployment/release identifier'),

    // Span data filters
    metadata: z.record(z.unknown()).optional().describe('Key-value matching on user-defined metadata'),
    tags: z
      .preprocess(
        val => (typeof val === 'string' ? val.split(',').filter(t => t.trim() !== '') : val),
        z.array(z.string()).optional(),
      )
      .describe('Match traces with any of these tags'),
    scope: z.record(z.unknown()).optional().describe('Key-value matching on Mastra package versions'),
    versionInfo: z.record(z.unknown()).optional().describe('Key-value matching on app version info'),

    // Derived status filters
    status: spanStatusSchema.optional().describe('Filter by root span status'),
    hasChildError: z
      .preprocess(val => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional())
      .describe('True = any child span in the trace has an error (even if root succeeded)'),
  })
  .describe('Filters for querying traces');

/**
 * Arguments for paginated trace queries
 */
export const tracesPaginatedArgSchema = z
  .object({
    filters: tracesFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.optional().describe('Optional pagination settings'),
    orderBy: tracesOrderBySchema.optional().describe('Optional ordering configuration'),
  })
  .describe('Arguments for paginated trace queries');

// ============================================================================
// Inferred Types
// ============================================================================

export type SpanEntityType = z.infer<typeof spanEntityTypeSchema>;
export type SpanStatus = z.infer<typeof spanStatusSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type PaginationArgs = z.infer<typeof paginationArgsSchema>;
export type TracesOrderByField = z.infer<typeof tracesOrderByFieldSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
export type TracesOrderBy = z.infer<typeof tracesOrderBySchema>;
export type TracesFilter = z.infer<typeof tracesFilterSchema>;
export type TracesPaginatedArg = z.infer<typeof tracesPaginatedArgSchema>;

// ============================================================================
// Query Parameter Translation (Server-Side)
// ============================================================================

/**
 * Query parameter format (URL) - using qs bracket notation:
 *
 * Simple strings:     ?filters[entityId]=abc&filters[userId]=user_123
 * Pagination:         ?pagination[page]=0&pagination[perPage]=20
 * Date range:         ?filters[dateRange][start]=2024-01-01T00:00:00Z
 * Arrays:             ?filters[tags][0]=prod&filters[tags][1]=v2
 * Nested objects:     ?filters[metadata][key1]=val1&filters[metadata][key2]=val2
 * Booleans:           ?filters[hasChildError]=true
 *
 * The qs library handles the bracket notation bidirectionally.
 */

interface ValidationError {
  field: string;
  message: string;
}

interface ParseResult {
  success: true;
  data: TracesPaginatedArg;
}

interface ParseErrorResult {
  success: false;
  errors: ValidationError[];
}

/**
 * Simple scalar filter keys that go at root level (not nested)
 */
const SCALAR_FILTER_KEYS = [
  'spanType',
  'entityType',
  'entityId',
  'entityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'serviceName',
  'deploymentId',
  'status',
  'hasChildError',
] as const;

/**
 * Parses query params into TracesPaginatedArg using qs + Zod validation.
 *
 * Accepts either:
 * - A query string: "page=0&perPage=20&entityType=agent&dateRange[start]=..."
 * - A Record from Hono/Express: { 'page': '0', 'entityType': 'agent', 'dateRange[start]': '...' }
 *
 * Query format (flattened):
 * - page, perPage: Simple scalars at root level
 * - entityType, entityId, status, etc.: Simple scalars at root level
 * - dateRange[start], dateRange[end]: Bracket notation for nested object
 * - tags[0], tags[1]: Bracket notation for arrays
 * - metadata[key]: Bracket notation for key-value objects
 *
 * @param input - Query string or Record<string, string> from request
 * @returns ParseResult with validated data or ParseErrorResult with all Zod errors
 */
export function parseTracesQueryParams(
  input: string | Record<string, string | string[] | undefined>,
): ParseResult | ParseErrorResult {
  // Step 1: Convert input to query string if needed
  let queryString: string;
  if (typeof input === 'string') {
    queryString = input;
  } else {
    // Convert Record to query string (Hono/Express give us { 'page': '0', 'entityType': 'agent' })
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    }
    queryString = params.toString();
  }

  // Step 2: Parse query string with qs (handles bracket notation for nested objects)
  const parsed = qs.parse(queryString, {
    ignoreQueryPrefix: true, // Handles leading ? if present
    allowDots: false, // We use bracket notation, not dots
    depth: 2, // dateRange[start], metadata[key], tags[0]
  }) as Record<string, unknown>;

  // Step 3: Restructure - move params into proper schema structure
  const restructured: Record<string, unknown> = {};

  // Pagination
  if (parsed.page !== undefined || parsed.perPage !== undefined) {
    restructured.pagination = {
      ...(parsed.page !== undefined && { page: parsed.page }),
      ...(parsed.perPage !== undefined && { perPage: parsed.perPage }),
    };
  }

  // Filters - collect all filter fields
  const filters: Record<string, unknown> = {};

  // Simple scalar filters (at root level in query string)
  for (const key of SCALAR_FILTER_KEYS) {
    if (parsed[key] !== undefined) {
      filters[key] = parsed[key];
    }
  }

  // Nested filters (already parsed by qs into objects/arrays)
  if (parsed.startedAt !== undefined) {
    filters.startedAt = parsed.startedAt;
  }
  if (parsed.endedAt !== undefined) {
    filters.endedAt = parsed.endedAt;
  }
  if (parsed.tags !== undefined) {
    filters.tags = parsed.tags;
  }
  if (parsed.metadata !== undefined) {
    filters.metadata = parsed.metadata;
  }
  if (parsed.scope !== undefined) {
    filters.scope = parsed.scope;
  }
  if (parsed.versionInfo !== undefined) {
    filters.versionInfo = parsed.versionInfo;
  }

  if (Object.keys(filters).length > 0) {
    restructured.filters = filters;
  }

  // Order by (nested - uses bracket notation)
  if (parsed.orderBy !== undefined) {
    restructured.orderBy = parsed.orderBy;
  }

  // Step 4: Validate with Zod schema (handles type coercion)
  const result = tracesPaginatedArgSchema.safeParse(restructured);

  if (!result.success) {
    const errors: ValidationError[] = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

// ============================================================================
// Query Parameter Serialization (Client-Side)
// ============================================================================

/**
 * Serializes TracesPaginatedArg to a query string using qs.stringify.
 *
 * Query format (flattened for readability):
 * - page, perPage: Simple scalars at root level
 * - entityType, entityId, status, etc.: Simple scalars at root level
 * - dateRange[start], dateRange[end]: Bracket notation for nested object
 * - tags[0], tags[1]: Bracket notation for arrays
 * - metadata[key]: Bracket notation for key-value objects
 *
 * Examples:
 * - { pagination: { page: 0 } } → page=0
 * - { filters: { entityType: "agent" } } → entityType=agent
 * - { filters: { tags: ["a", "b"] } } → tags[0]=a&tags[1]=b
 * - { filters: { dateRange: { start: Date } } } → dateRange[start]=2024-01-01T00:00:00.000Z
 *
 * @param args - The TracesPaginatedArg to serialize
 * @returns Query string (without leading ?)
 */
export function serializeTracesParams(args: TracesPaginatedArg): string {
  const flattened = prepareForSerialization(args);

  return qs.stringify(flattened, {
    encode: true, // URL-encode values
    skipNulls: true, // Don't include null/undefined values
    arrayFormat: 'indices', // tags[0]=a&tags[1]=b
  });
}

/**
 * Prepares TracesPaginatedArg for qs.stringify:
 * - Flattens pagination to root level (page, perPage)
 * - Flattens simple scalar filters to root level
 * - Keeps nested structures (startedAt, endedAt, orderBy, tags, metadata, etc.) for bracket notation
 * - Converts Date objects to ISO strings
 */
function prepareForSerialization(args: TracesPaginatedArg): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Flatten pagination to root level
  if (args.pagination?.page !== undefined) {
    result.page = args.pagination.page;
  }
  if (args.pagination?.perPage !== undefined) {
    result.perPage = args.pagination.perPage;
  }

  if (args.filters) {
    // Flatten simple scalar filters to root level
    for (const key of SCALAR_FILTER_KEYS) {
      const value = args.filters[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }

    // Keep nested structures (qs will use bracket notation)
    // startedAt - convert Date to ISO string
    if (args.filters.startedAt) {
      result.startedAt = {
        ...(args.filters.startedAt.start && { start: args.filters.startedAt.start.toISOString() }),
        ...(args.filters.startedAt.end && { end: args.filters.startedAt.end.toISOString() }),
      };
    }

    // endedAt - convert Date to ISO string
    if (args.filters.endedAt) {
      result.endedAt = {
        ...(args.filters.endedAt.start && { start: args.filters.endedAt.start.toISOString() }),
        ...(args.filters.endedAt.end && { end: args.filters.endedAt.end.toISOString() }),
      };
    }

    // tags - keep as array
    if (args.filters.tags && args.filters.tags.length > 0) {
      result.tags = args.filters.tags;
    }

    // metadata, scope, versionInfo - keep as objects
    if (args.filters.metadata && Object.keys(args.filters.metadata).length > 0) {
      result.metadata = args.filters.metadata;
    }
    if (args.filters.scope && Object.keys(args.filters.scope).length > 0) {
      result.scope = args.filters.scope;
    }
    if (args.filters.versionInfo && Object.keys(args.filters.versionInfo).length > 0) {
      result.versionInfo = args.filters.versionInfo;
    }
  }

  // orderBy - nested structure with field and direction
  if (args.orderBy) {
    result.orderBy = {
      ...(args.orderBy.field && { field: args.orderBy.field }),
      ...(args.orderBy.direction && { direction: args.orderBy.direction }),
    };
  }

  return result;
}
