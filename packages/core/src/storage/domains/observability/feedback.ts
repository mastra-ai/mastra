import { z } from 'zod';
import {
  dateRangeSchema,
  dbTimestamps,
  environmentField,
  experimentIdField,
  organizationIdField,
  paginationArgsSchema,
  paginationInfoSchema,
  serviceNameField,
  sortDirectionSchema,
  userIdField,
} from '../shared';
import { spanIdField, traceIdField } from './tracing';

// ============================================================================
// Helper utilities
// ============================================================================

const createOmitKeys = <T extends z.ZodRawShape>(shape: T): { [K in keyof T]: true } =>
  Object.fromEntries(Object.keys(shape).map(k => [k, true])) as { [K in keyof T]: true };

const omitDbTimestamps = createOmitKeys(dbTimestamps);

// ============================================================================
// Field Schemas
// ============================================================================

const feedbackSourceField = z.string().describe("Source of feedback (e.g., 'user', 'system', 'manual')");
const feedbackTypeField = z.string().describe("Type of feedback (e.g., 'thumbs', 'rating', 'correction')");
const feedbackValueField = z
  .union([z.number(), z.string()])
  .describe('Feedback value (rating number or correction text)');
const feedbackCommentField = z.string().describe('Additional comment or context');

// ============================================================================
// FeedbackRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for feedback as stored in the database.
 * Includes all fields from ExportedFeedback plus storage-specific fields.
 */
export const feedbackRecordSchema = z
  .object({
    id: z.string().describe('Unique feedback record identifier'),
    timestamp: z.date().describe('When the feedback was recorded'),

    // Target
    traceId: traceIdField,
    spanId: spanIdField.nullish().describe('Span ID this feedback applies to'),

    // Feedback data
    source: feedbackSourceField,
    feedbackType: feedbackTypeField,
    value: feedbackValueField,
    comment: feedbackCommentField.nullish(),
    experimentId: experimentIdField.nullish(),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.unknown()).nullish().describe('User-defined metadata'),

    // Database timestamps
    ...dbTimestamps,
  })
  .describe('Feedback record as stored in the database');

/** Feedback record type for storage */
export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;

// ============================================================================
// FeedbackInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided feedback input (minimal required fields).
 * The span/trace context adds traceId/spanId before emitting ExportedFeedback.
 */
export const feedbackInputSchema = z
  .object({
    source: feedbackSourceField,
    feedbackType: feedbackTypeField,
    value: feedbackValueField,
    comment: feedbackCommentField.optional(),
    userId: userIdField.optional(),
    metadata: z.record(z.unknown()).optional().describe('Additional feedback-specific metadata'),
    experimentId: experimentIdField.optional(),
  })
  .describe('User-provided feedback input');

/** User-facing feedback input type */
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

// ============================================================================
// Create Feedback Schemas
// ============================================================================

/** Schema for creating a feedback record (without db timestamps) */
export const createFeedbackRecordSchema = feedbackRecordSchema.omit(omitDbTimestamps);

/** Feedback record for creation (excludes db timestamps) */
export type CreateFeedbackRecord = z.infer<typeof createFeedbackRecordSchema>;

/** Schema for createFeedback operation arguments */
export const createFeedbackArgsSchema = z
  .object({
    feedback: createFeedbackRecordSchema,
  })
  .describe('Arguments for creating feedback');

/** Arguments for creating feedback */
export type CreateFeedbackArgs = z.infer<typeof createFeedbackArgsSchema>;

// ============================================================================
// Feedback Filter Schema
// ============================================================================

/** Schema for filtering feedback in list queries */
export const feedbackFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by feedback timestamp range'),

    // Target filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),

    // Feedback filters
    feedbackType: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Filter by feedback type(s)'),
    source: z.string().optional().describe('Filter by feedback source (e.g., user, system, manual)'),
    experimentId: z.string().optional().describe('Filter by experiment or eval run identifier'),

    // Attribution
    userId: userIdField.optional(),

    // Multi-tenancy filters
    organizationId: organizationIdField.optional(),

    // Environment filters
    serviceName: serviceNameField.optional(),
    environment: environmentField.optional(),
  })
  .describe('Filters for querying feedback');

/** Filters for querying feedback */
export type FeedbackFilter = z.infer<typeof feedbackFilterSchema>;

// ============================================================================
// List Feedback Schemas
// ============================================================================

/** Fields available for ordering feedback results */
export const feedbackOrderByFieldSchema = z.enum(['timestamp']).describe("Field to order by: 'timestamp'");

/** Order by configuration for feedback queries */
export const feedbackOrderBySchema = z
  .object({
    field: feedbackOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listFeedback operation arguments */
export const listFeedbackArgsSchema = z
  .object({
    filters: feedbackFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: feedbackOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing feedback');

/** Arguments for listing feedback */
export type ListFeedbackArgs = z.input<typeof listFeedbackArgsSchema>;

/** Schema for listFeedback operation response */
export const listFeedbackResponseSchema = z.object({
  pagination: paginationInfoSchema,
  feedback: z.array(feedbackRecordSchema),
});

/** Response containing paginated feedback */
export type ListFeedbackResponse = z.infer<typeof listFeedbackResponseSchema>;
