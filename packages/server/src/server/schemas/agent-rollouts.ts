import { z } from 'zod/v4';

// ============================================================================
// Shared Enums & Primitives
// ============================================================================

export const rolloutTypeSchema = z.enum(['canary', 'ab_test']);

export const rolloutStatusSchema = z.enum(['active', 'completed', 'rolled_back', 'cancelled']);

export const rolloutAllocationSchema = z.object({
  versionId: z.string().describe('Agent version ID for this allocation'),
  weight: z.number().min(0).max(1).describe('Fractional traffic weight (0-1, e.g. 0.05 for 5%)'),
  label: z.string().optional().describe('Human-readable label (e.g. "stable", "candidate", "control")'),
});

export const rolloutRuleSchema = z.object({
  scorerId: z.string().describe('Scorer ID to monitor'),
  threshold: z.number().min(0).max(1).describe('Minimum acceptable average score (0-1)'),
  windowSize: z.number().int().min(1).describe('Number of recent scores to evaluate'),
  action: z.enum(['rollback']).describe('Action to take when rule is breached'),
});

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const agentRolloutPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * POST /agents/:agentId/rollout — Start a rollout
 */
export const startRolloutBodySchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('canary'),
      candidateVersionId: z.string().describe('Version ID of the candidate'),
      candidateWeight: z
        .number()
        .gt(0)
        .lt(1)
        .describe('Initial fractional traffic for the candidate (0-1, e.g. 0.01 for 1%)'),
      routingKey: z
        .string()
        .optional()
        .describe('Request context field to hash for sticky routing (default: resourceId)'),
      rules: z.array(rolloutRuleSchema).optional().describe('Auto-rollback rules based on scorer thresholds'),
    }),
    z.object({
      type: z.literal('ab_test'),
      allocations: z.array(rolloutAllocationSchema).min(2).describe('Traffic allocations (weights must sum to 1)'),
      routingKey: z
        .string()
        .optional()
        .describe('Request context field to hash for sticky routing (default: resourceId)'),
    }),
  ])
  .describe('Start a new rollout or A/B test');

/**
 * PATCH /agents/:agentId/rollout — Update rollout weights
 */
export const updateRolloutBodySchema = z.object({
  candidateWeight: z.number().gt(0).lt(1).describe('New fractional traffic for the candidate (0-1, canary only)'),
});

/**
 * POST /agents/:agentId/rollout/promote — Promote / conclude
 */
export const promoteRolloutBodySchema = z
  .object({
    versionId: z
      .string()
      .optional()
      .describe('For A/B tests: which version to promote. Omit to keep the current stable version.'),
  })
  .optional();

// ============================================================================
// Score Summary Schema (used in responses)
// ============================================================================

export const scoreSummarySchema = z.object({
  avg: z.number().describe('Average score'),
  count: z.number().int().describe('Number of scores'),
});

export const allocationWithScoresSchema = rolloutAllocationSchema.extend({
  scores: z.record(z.string(), scoreSummarySchema).optional().describe('Per-scorer score summaries'),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const rolloutRecordSchema = z.object({
  id: z.string().describe('Rollout ID'),
  agentId: z.string().describe('Agent ID'),
  type: rolloutTypeSchema,
  status: rolloutStatusSchema,
  stableVersionId: z.string().describe('Version ID that was active when the rollout started'),
  allocations: z.array(allocationWithScoresSchema).describe('Traffic allocations with score summaries'),
  routingKey: z.string().optional().describe('Request context field used for sticky routing'),
  rules: z.array(rolloutRuleSchema).optional().describe('Auto-rollback rules (canary only)'),
  createdAt: z.coerce.date().describe('When the rollout was created'),
  updatedAt: z.coerce.date().describe('When the rollout was last updated'),
  completedAt: z.coerce.date().nullable().optional().describe('When the rollout was completed/rolled back/cancelled'),
});

export const rolloutResultsAllocationSchema = z.object({
  versionId: z.string(),
  label: z.string().optional(),
  requestCount: z.number().int(),
  scores: z.record(
    z.string(),
    z.object({
      avg: z.number(),
      stddev: z.number(),
      count: z.number().int(),
      min: z.number(),
      max: z.number(),
    }),
  ),
});

export const rolloutResultsSchema = z.object({
  rolloutId: z.string(),
  type: rolloutTypeSchema,
  allocations: z.array(rolloutResultsAllocationSchema),
});

export const listRolloutsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().describe('Page number (1-indexed)'),
  perPage: z.coerce.number().int().min(1).max(100).optional().describe('Results per page'),
});

export const listRolloutsResponseSchema = z.object({
  rollouts: z.array(rolloutRecordSchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});

/**
 * Simple success response for promote, rollback, cancel
 */
export const rolloutActionResponseSchema = z.object({
  success: z.boolean(),
  rollout: rolloutRecordSchema,
});
