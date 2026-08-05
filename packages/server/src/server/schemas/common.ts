import type { MessageInput } from '@mastra/core/agent/message-list';
import { z } from 'zod/v4';

/**
 * Brands a permissive runtime schema with a concrete compile-time type.
 *
 * Some request-body fields carry values the server cannot fully validate with
 * zod: functions (stop conditions, client tools), Zod schemas (structured
 * output), or complex core types that would drift if re-declared here. For
 * those fields runtime validation stays permissive and the receiving
 * agent/workflow API performs the real validation, while handlers and
 * generated route types still get the concrete type.
 *
 * Every call site is an intentional, documented gap between runtime
 * validation and the declared type. Prefer a real zod schema whenever the
 * shape can reasonably be expressed — only reach for this when it cannot.
 */
export function typedPermissive<T>(schema: z.ZodType): z.ZodType<T> {
  return schema as unknown as z.ZodType<T>;
}

// Path parameter schemas
export const runIdSchema = z.object({
  runId: z.string().describe('Unique identifier for the run'),
});

/**
 * Query parameter schema for runId (optional)
 * Used by create-run route where runId is optional
 */
export const optionalRunIdSchema = z.object({
  runId: z.string().optional(),
});

// ============================================================================
// Pagination Schemas
// ============================================================================

/**
 * Pagination response info
 * Used across all paginated endpoints
 */
export const paginationInfoSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.union([z.number(), z.literal(false)]),
  hasMore: z.boolean(),
});

/**
 * Factory function for page/perPage pagination query params
 * @param defaultPerPage - Default value for perPage (omit for no default)
 */
export const createPagePaginationSchema = (defaultPerPage?: number) => {
  const baseSchema = {
    page: z.coerce.number().optional().default(0),
  };

  if (defaultPerPage !== undefined) {
    return z.object({
      ...baseSchema,
      perPage: z.coerce.number().optional().default(defaultPerPage),
    });
  } else {
    return z.object({
      ...baseSchema,
      perPage: z.coerce.number().optional(),
    });
  }
};

/**
 * Factory function for pagination that supports both page/perPage and limit/offset
 * Use this when you need backwards compatibility with older clients using limit/offset
 */
export const createCombinedPaginationSchema = () => {
  return z.object({
    page: z.coerce.number().optional(),
    perPage: z.coerce.number().optional(),
    /**
     * @deprecated Use page and perPage instead
     */
    offset: z.coerce.number().optional(),
    /**
     * @deprecated Use page and perPage instead
     */
    limit: z.coerce.number().optional(),
  });
};

// ============================================================================
// Observability Schemas
// ============================================================================

/**
 * Tracing options for observability
 * Used by agents and workflows
 */
export const tracingOptionsSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  requestContextKeys: z.array(z.string()).optional(),
  traceId: z.string().optional(),
  parentSpanId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  hideInput: z.boolean().optional(),
  hideOutput: z.boolean().optional(),
});

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Core message schema from AI SDK
 * Represents messages exchanged with AI models
 * Content can be string, array of content parts, or object (for complex message types)
 */
// Runtime validation stays permissive (z.unknown()) so generated route types
// don't leak `any`; typedPermissive gives handlers the concrete message type
// expected by agent APIs (agent.generate/stream/network).
export const coreMessageSchema = typedPermissive<MessageInput>(z.unknown());
// .object({
//   role: z.enum(['system', 'user', 'assistant', 'tool']),
//   content: z.union([
//     z.string(),
//     z.array(
//       z
//         .object({
//           type: z.enum(['text', 'image', 'file', 'tool-call', 'tool-result']),
//         })
//         .passthrough(), // Preserve additional fields like text, image, toolCall, etc.
//     ),
//     z.unknown(), // For complex message content objects
//   ]),
// })
// .passthrough();

// ============================================================================
// Common Response Schemas
// ============================================================================

/**
 * Standard success response schema
 * Used by operations that return only a success boolean
 */
export const successResponseSchema = z.object({
  success: z.boolean(),
});

/**
 * Standard message response schema
 * Used by operations that return only a message string
 */
export const messageResponseSchema = z.object({
  message: z.string(),
});

/**
 * Partial data query parameter schema
 * Used by list endpoints to return minimal data without schemas
 */
export const partialQuerySchema = z.object({
  partial: z.string().optional(),
});

// ============================================================================
// Status Schemas
// ============================================================================

/**
 * Status filter for get-by-id endpoints.
 * Controls which version is resolved:
 * - 'published' (default) — resolve with the active (published) version.
 * - 'draft' — resolve with the latest version (which may be ahead of the published one).
 */
export const statusQuerySchema = z.object({
  status: z
    .enum(['draft', 'published', 'archived'])
    .optional()
    .default('published')
    .describe('Which version to resolve: published (active version) or draft (latest version)'),
});

// ============================================================================
// Logging Schemas
// ============================================================================

/**
 * Base log message schema
 */
export const baseLogMessageSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'silent']),
  msg: z.string(),
  time: z.date(),
  context: z.record(z.string(), z.unknown()).optional(),
  runId: z.string().optional(),
  pid: z.number(),
  hostname: z.string(),
  name: z.string(),
});
