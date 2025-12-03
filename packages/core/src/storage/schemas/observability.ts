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
 */
export const paginationArgsSchema = z
  .object({
    page: z.number().int().min(0).optional().describe('Zero-indexed page number'),
    perPage: z.number().int().min(1).optional().describe('Number of items per page'),
  })
  .describe('Pagination options for list queries');

/**
 * Date range for filtering by time
 */
export const dateRangeSchema = z
  .object({
    start: z.date().optional().describe('Start of date range (inclusive)'),
    end: z.date().optional().describe('End of date range (inclusive)'),
  })
  .describe('Date range filter for timestamps');

/**
 * Filters for querying traces (with proper types)
 */
export const tracesFilterSchema = z
  .object({
    // Date range filter
    dateRange: dateRangeSchema.optional().describe('Filter by date range'),

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
    tags: z.array(z.string()).optional().describe('Match traces with any of these tags'),
    scope: z.record(z.unknown()).optional().describe('Key-value matching on Mastra package versions'),
    versionInfo: z.record(z.unknown()).optional().describe('Key-value matching on app version info'),

    // Derived status filters
    status: spanStatusSchema.optional().describe('Filter by root span status'),
    hasChildError: z
      .boolean()
      .optional()
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
  })
  .describe('Arguments for paginated trace queries');

// ============================================================================
// Inferred Types
// ============================================================================

export type SpanEntityType = z.infer<typeof spanEntityTypeSchema>;
export type SpanStatus = z.infer<typeof spanStatusSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type PaginationArgs = z.infer<typeof paginationArgsSchema>;
export type TracesFilter = z.infer<typeof tracesFilterSchema>;
export type TracesPaginatedArg = z.infer<typeof tracesPaginatedArgSchema>;

// ============================================================================
// Query Parameter Translation (Server-Side)
// ============================================================================

/**
 * Query parameter format (URL):
 *
 * Simple strings:     ?entityId=abc&userId=user_123
 * Pagination:         ?page=0&perPage=20
 * Date range:         ?dateRange.start=2024-01-01T00:00:00Z&dateRange.end=2024-12-31T23:59:59Z
 * Arrays:             ?tag=prod&tag=v2 (repeated params)
 * Nested objects:     ?metadata.key1=val1&metadata.key2=val2 (dot notation)
 * Booleans:           ?hasChildError=true
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
 * Transforms raw query parameters into the shape expected by tracesPaginatedArgSchema,
 * then validates using Zod.
 *
 * Handles:
 * - Dot notation for nested objects: metadata.key=val → { filters: { metadata: { key: "val" } } }
 * - Comma-separated tags: tags=a,b → { filters: { tags: ["a", "b"] } }
 * - Type coercion: page/perPage strings → numbers, date strings → Date objects, etc.
 *
 * @param params - Raw query parameters from URL (Record<string, string>)
 * @returns ParseResult with validated data or ParseErrorResult with all Zod errors
 */
export function parseTracesQueryParams(
  params: Record<string, string | string[] | undefined>,
): ParseResult | ParseErrorResult {
  // Step 1: Transform raw string params into structured object
  const transformed = transformQueryParams(params);

  // Step 2: Validate with Zod schema
  const result = tracesPaginatedArgSchema.safeParse(transformed);

  if (!result.success) {
    // Convert Zod errors to our ValidationError format
    const errors: ValidationError[] = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

/**
 * Transforms raw query params into the structure expected by tracesPaginatedArgSchema.
 * Handles dot notation, comma-separated arrays, and type coercion.
 */
function transformQueryParams(params: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  const pagination: Record<string, unknown> = {};
  const nestedObjects: Record<string, Record<string, string>> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    const val = Array.isArray(value) ? value[0] : value;
    if (val === undefined) continue;

    // Pagination fields
    if (key === 'page') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) pagination.page = num;
      continue;
    }
    if (key === 'perPage') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) pagination.perPage = num;
      continue;
    }

    // Tags - comma-separated: tags=a,b → ["a", "b"]
    if (key === 'tags') {
      filters.tags = val
        .split(',')
        .map(t => t.trim())
        .filter(t => t !== '');
      continue;
    }

    // Boolean: hasChildError
    if (key === 'hasChildError') {
      if (val === 'true') filters.hasChildError = true;
      else if (val === 'false') filters.hasChildError = false;
      continue;
    }

    // Dot notation: dateRange.start, metadata.key, etc.
    if (key.includes('.')) {
      const parts = key.split('.');
      const prefix = parts[0]!;
      const nestedKey = parts.slice(1).join('.');

      // Special handling for dateRange - convert to Date
      if (prefix === 'dateRange') {
        if (!filters.dateRange) filters.dateRange = {};
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          (filters.dateRange as Record<string, Date>)[nestedKey] = date;
        }
        continue;
      }

      // Other nested objects (metadata, scope, versionInfo)
      if (!nestedObjects[prefix]) nestedObjects[prefix] = {};
      nestedObjects[prefix][nestedKey] = val;
      continue;
    }

    // All other fields go into filters
    filters[key] = val;
  }

  // Merge nested objects into filters
  for (const [prefix, nested] of Object.entries(nestedObjects)) {
    filters[prefix] = nested;
  }

  // Build the final structure
  const result: Record<string, unknown> = {};
  if (Object.keys(pagination).length > 0) result.pagination = pagination;
  if (Object.keys(filters).length > 0) result.filters = filters;

  return result;
}

// ============================================================================
// Query Parameter Serialization (Client-Side)
// ============================================================================

/**
 * Serializes TracesPaginatedArg to URLSearchParams for HTTP requests.
 *
 * Handles:
 * - Flattening nested objects with dot notation: { metadata: { key: "val" } } → metadata.key=val
 * - Expanding arrays to repeated params: { tags: ["a", "b"] } → tag=a&tag=b
 * - Converting dates to ISO strings
 * - Converting booleans to "true"/"false"
 *
 * @param args - The TracesPaginatedArg to serialize
 * @returns URLSearchParams ready to append to URL
 */
export function serializeTracesParams(args: TracesPaginatedArg): URLSearchParams {
  const searchParams = new URLSearchParams();
  const { pagination, filters } = args;

  // Pagination
  if (pagination?.page !== undefined) {
    searchParams.set('page', String(pagination.page));
  }
  if (pagination?.perPage !== undefined) {
    searchParams.set('perPage', String(pagination.perPage));
  }

  if (!filters) return searchParams;

  // Date range - use dot notation
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      searchParams.set('dateRange.start', filters.dateRange.start.toISOString());
    }
    if (filters.dateRange.end) {
      searchParams.set('dateRange.end', filters.dateRange.end.toISOString());
    }
  }

  // Simple string filters
  const stringFilters = [
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
  ] as const;

  for (const key of stringFilters) {
    const value = filters[key];
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  // Tags - comma-separated (tags=a,b,c)
  if (filters.tags && filters.tags.length > 0) {
    searchParams.set('tags', filters.tags.join(','));
  }

  // Nested objects - dot notation (metadata.key=val)
  const nestedFilters = ['metadata', 'scope', 'versionInfo'] as const;
  for (const prefix of nestedFilters) {
    const obj = filters[prefix];
    if (obj) {
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          searchParams.set(`${prefix}.${key}`, String(value));
        }
      }
    }
  }

  // Boolean
  if (filters.hasChildError !== undefined) {
    searchParams.set('hasChildError', String(filters.hasChildError));
  }

  return searchParams;
}
