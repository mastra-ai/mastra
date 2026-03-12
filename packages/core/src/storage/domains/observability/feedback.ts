import { z } from 'zod/v4';
import {
  commonFilterFields,
  experimentIdField,
  paginationArgsSchema,
  paginationInfoSchema,
  sortDirectionSchema,
  userIdField,
} from '../shared';
import { spanIdField, traceIdField } from './tracing';

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

    // Identity
    userId: userIdField.nullish(),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.string(), z.unknown()).nullish().describe('User-defined metadata'),
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
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional feedback-specific metadata'),
    experimentId: experimentIdField.optional(),
  })
  .describe('User-provided feedback input');

/** User-facing feedback input type */
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

// ============================================================================
// Create Feedback Schemas
// ============================================================================

/** Schema for creating a feedback record (without db timestamps) */
export const createFeedbackRecordSchema = feedbackRecordSchema;

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

/** Schema for createFeedback operation response */
export const createFeedbackResponseSchema = z
  .object({ success: z.boolean() })
  .describe('Response from creating feedback');

/** Response from creating feedback */
export type CreateFeedbackResponse = z.infer<typeof createFeedbackResponseSchema>;

/** Schema for batchCreateFeedback operation arguments */
export const batchCreateFeedbackArgsSchema = z
  .object({
    feedbacks: z.array(createFeedbackRecordSchema),
  })
  .describe('Arguments for batch recording feedback');

/** Arguments for batch creating feedback */
export type BatchCreateFeedbackArgs = z.infer<typeof batchCreateFeedbackArgsSchema>;

// ============================================================================
// Feedback Filter Schema
// ============================================================================

/** Schema for filtering feedback in list queries */
export const feedbackFilterSchema = z
  .object({
    ...commonFilterFields,

    // Feedback-specific filters
    feedbackType: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Filter by feedback type(s)'),
    source: z.string().optional().describe('Filter by feedback source (e.g., user, system, manual)'),
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
    pagination: paginationArgsSchema.default({ page: 0, perPage: 10 }).describe('Pagination settings'),
    orderBy: feedbackOrderBySchema
      .default({ field: 'timestamp', direction: 'DESC' })
      .describe('Ordering configuration (defaults to timestamp desc)'),
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
