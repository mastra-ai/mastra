import { z } from 'zod/v4';
import {
  commonFilterFields,
  contextFields,
  metadataField,
  paginationArgsSchema,
  paginationInfoSchema,
  parentEntityNameField,
  parentEntityTypeField,
  requestIdField,
  resourceIdField,
  rootEntityNameField,
  rootEntityTypeField,
  runIdField,
  sessionIdField,
  sortDirectionSchema,
  sourceField,
  tagsField,
  threadIdField,
} from '../shared';

// ============================================================================
// Field Schemas
// ============================================================================

/** Log level schema for validation */
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);

const messageField = z.string().describe('Log message');
const logDataField = z.record(z.string(), z.unknown()).describe('Structured data attached to the log');

// ============================================================================
// LogRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for logs as stored in the database.
 * Includes all fields from ExportedLog plus storage-specific fields.
 */
export const logRecordSchema = z
  .object({
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
    tags: tagsField.nullish(),
    metadata: metadataField.nullish(),
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
    tags: tagsField.optional(),
  })
  .describe('User-provided log input');

/** User-facing log input type */
export type LogRecordInput = z.infer<typeof logRecordInputSchema>;

// ============================================================================
// Create Log Schemas
// ============================================================================

/** Schema for creating a log record */
export const createLogRecordSchema = logRecordSchema;

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
    ...commonFilterFields,

    // Log-specific filters
    level: z
      .union([logLevelSchema, z.array(logLevelSchema)])
      .optional()
      .describe('Filter by log level(s)'),

    // Extended correlation filters
    runId: runIdField.optional(),
    sessionId: sessionIdField.optional(),
    threadId: threadIdField.optional(),
    requestId: requestIdField.optional(),

    // Parent/root entity filters
    parentEntityType: parentEntityTypeField.optional(),
    parentEntityName: parentEntityNameField.optional(),
    rootEntityType: rootEntityTypeField.optional(),
    rootEntityName: rootEntityNameField.optional(),

    // Multi-tenancy filters
    resourceId: resourceIdField.optional(),
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
    pagination: paginationArgsSchema.default({ page: 0, perPage: 10 }).describe('Pagination settings'),
    orderBy: logsOrderBySchema
      .default({ field: 'timestamp', direction: 'DESC' })
      .describe('Ordering configuration (defaults to timestamp desc)'),
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
