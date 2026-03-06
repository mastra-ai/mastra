import { z } from 'zod';
import {
  dateRangeSchema,
  dbTimestamps,
  entityIdField,
  entityNameField,
  entityTypeField,
  environmentField,
  organizationIdField,
  paginationArgsSchema,
  paginationInfoSchema,
  requestIdField,
  resourceIdField,
  runIdField,
  serviceNameField,
  sessionIdField,
  sortDirectionSchema,
  sourceField,
  threadIdField,
  userIdField,
} from '../shared';

// ============================================================================
// Helper utilities
// ============================================================================

const createOmitKeys = <T extends z.ZodRawShape>(shape: T): { [K in keyof T]: true } =>
  Object.fromEntries(Object.keys(shape).map(k => [k, true])) as { [K in keyof T]: true };

const omitDbTimestamps = createOmitKeys(dbTimestamps);

// ============================================================================
// Field Schemas
// ============================================================================

/** Log level schema for validation */
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);

const messageField = z.string().describe('Log message');
const logDataField = z.record(z.unknown()).describe('Structured data attached to the log');
const logTagsField = z.array(z.string()).describe('Labels for filtering logs');
const metadataField = z.record(z.unknown()).describe('User-defined metadata for custom filtering');
const scopeField = z
  .record(z.unknown())
  .describe('Arbitrary package/app version info (e.g., {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"})');

// ============================================================================
// Context Fields (same as tracing — first-class for filtering)
// ============================================================================

const contextFields = {
  // Entity identification
  entityType: entityTypeField.nullish(),
  entityId: entityIdField.nullish(),
  entityName: entityNameField.nullish(),

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
} as const;

// ============================================================================
// LogRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for logs as stored in the database.
 * Includes all fields from ExportedLog plus storage-specific fields.
 */
export const logRecordSchema = z
  .object({
    id: z.string().describe('Unique log record identifier'),
    timestamp: z.date().describe('When the log was created'),
    level: logLevelSchema.describe('Log severity level'),
    message: messageField,
    data: logDataField.nullish(),

    // Correlation
    traceId: z.string().nullish().describe('Trace ID for correlation'),
    spanId: z.string().nullish().describe('Span ID for correlation'),

    // Context fields (same as tracing)
    ...contextFields,

    // Filtering
    tags: logTagsField.nullish(),
    metadata: metadataField.nullish(),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Log record as stored in the database');

/** Log record type for storage */
export type LogRecord = z.infer<typeof logRecordSchema>;

// ============================================================================
// LogRecordInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided log input (minimal required fields).
 * The logger enriches this with context before emitting ExportedLog.
 */
export const logRecordInputSchema = z
  .object({
    level: logLevelSchema,
    message: messageField,
    data: logDataField.optional(),
    tags: logTagsField.optional(),
  })
  .describe('User-provided log input');

/** User-facing log input type */
export type LogRecordInput = z.infer<typeof logRecordInputSchema>;

// ============================================================================
// Create Log Schemas
// ============================================================================

/** Schema for creating a log record (without db timestamps) */
export const createLogRecordSchema = logRecordSchema.omit(omitDbTimestamps);

/** Log record for creation (excludes db timestamps) */
export type CreateLogRecord = z.infer<typeof createLogRecordSchema>;

/** Schema for batchCreateLogs operation arguments */
export const batchCreateLogsArgsSchema = z
  .object({
    logs: z.array(createLogRecordSchema),
  })
  .describe('Arguments for batch creating logs');

/** Arguments for batch creating logs */
export type BatchCreateLogsArgs = z.infer<typeof batchCreateLogsArgsSchema>;

// ============================================================================
// Log Filter Schema
// ============================================================================

/** Schema for filtering logs in list queries */
export const logsFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by log timestamp range'),

    // Level filtering
    level: z
      .union([logLevelSchema, z.array(logLevelSchema)])
      .optional()
      .describe('Filter by log level(s)'),

    // Correlation filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),
    runId: runIdField.optional(),
    sessionId: sessionIdField.optional(),
    threadId: threadIdField.optional(),
    requestId: requestIdField.optional(),

    // Entity filters
    entityType: entityTypeField.optional(),
    entityName: entityNameField.optional(),

    // Multi-tenancy filters
    userId: userIdField.optional(),
    organizationId: organizationIdField.optional(),
    resourceId: resourceIdField.optional(),

    // Environment filters
    serviceName: serviceNameField.optional(),
    environment: environmentField.optional(),
    source: sourceField.optional(),

    // Content filters
    search: z.string().optional().describe('Full-text search on message'),
    tags: z.array(z.string()).optional().describe('Filter by tags (logs must have all specified tags)'),
    dataKeys: z.array(z.string()).optional().describe('Filter logs that have specific data keys'),
  })
  .describe('Filters for querying logs');

/** Filters for querying logs */
export type LogsFilter = z.infer<typeof logsFilterSchema>;

// ============================================================================
// List Logs Schemas
// ============================================================================

/** Fields available for ordering log results */
export const logsOrderByFieldSchema = z.enum(['timestamp']).describe("Field to order by: 'timestamp'");

/** Order by configuration for log queries */
export const logsOrderBySchema = z
  .object({
    field: logsOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listLogs operation arguments */
export const listLogsArgsSchema = z
  .object({
    filters: logsFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: logsOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing logs');

/** Arguments for listing logs */
export type ListLogsArgs = z.input<typeof listLogsArgsSchema>;

/** Schema for listLogs operation response */
export const listLogsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  logs: z.array(logRecordSchema),
});

/** Response containing paginated logs */
export type ListLogsResponse = z.infer<typeof listLogsResponseSchema>;
