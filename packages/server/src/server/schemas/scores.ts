import z from 'zod';

/**
 * Schema for sampling configuration
 * Using passthrough to allow various sampling config shapes
 */
const scoringSamplingConfigSchema = z.object({}).passthrough();

/**
 * Schema for MastraScorer properties
 */
const mastraScorerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.unknown().optional(), // Can be string or object with schemas
});

/**
 * Schema for scorer entry with associations to agents and workflows
 */
const scorerEntrySchema = z.object({
  scorer: mastraScorerSchema,
  sampling: scoringSamplingConfigSchema.optional(),
  agentIds: z.array(z.string()),
  agentNames: z.array(z.string()),
  workflowIds: z.array(z.string()),
  isRegistered: z.boolean(),
});

/**
 * Response schema for list scorers endpoint
 * Returns a record of scorer ID to scorer entry with associations
 */
export const listScorersResponseSchema = z.record(scorerEntrySchema);
