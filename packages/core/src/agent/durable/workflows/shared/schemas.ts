import { z } from 'zod';

/**
 * Shared Zod schemas for durable agentic workflows.
 *
 * These schemas are used by:
 * - Core DurableAgent workflow
 * - Inngest durable agent workflow
 * - Evented durable agent workflow (future)
 */

/**
 * Schema for model configuration
 */
export const modelConfigSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  specificationVersion: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  providerOptions: z.record(z.string(), z.any()).optional(),
});

/**
 * Schema for model list entry (fallback support)
 */
export const modelListEntrySchema = z.object({
  id: z.string(),
  config: z.object({
    provider: z.string(),
    modelId: z.string(),
    specificationVersion: z.string().optional(),
    originalConfig: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
    providerOptions: z.record(z.string(), z.any()).optional(),
  }),
  maxRetries: z.number(),
  enabled: z.boolean(),
});

/**
 * Schema for accumulated usage across iterations
 */
export const accumulatedUsageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
});

/**
 * Schema for output from the durable agentic workflow
 */
export const durableAgenticOutputSchema = z.object({
  messageListState: z.any(),
  messageId: z.string(),
  stepResult: z.any(),
  output: z.object({
    text: z.string().optional(),
    usage: z.any(),
    steps: z.array(z.any()),
  }),
  state: z.any(),
});

/**
 * Base schema for durable agentic workflow input.
 * Implementations can extend this with additional fields.
 */
export const baseDurableAgenticInputSchema = z.object({
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: modelConfigSchema,
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
});

/**
 * Base schema for iteration state.
 * Implementations can extend this with additional fields.
 */
export const baseIterationStateSchema = z.object({
  // Original input fields
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: z.any(),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // Iteration tracking
  iterationCount: z.number(),
  accumulatedSteps: z.array(z.any()),
  accumulatedUsage: accumulatedUsageSchema,
  // Last step result for continuation check
  lastStepResult: z.any().optional(),
  // Background task tracking
  backgroundTaskPending: z.boolean().optional(),
  // Set when a delegation hook calls ctx.bail() — signals the loop to stop
  delegationBailed: z.boolean().optional(),
  // Set when onIterationComplete returns { continue: false, feedback } — allows
  // one more LLM turn with the feedback, then stops on the next predicate eval.
  pendingFeedbackStop: z.boolean().optional(),
  // Span data, carried unchanged so every iteration shares one trace
  agentSpanData: z.any().optional(),
  modelSpanData: z.any().optional(),
});

/**
 * Type for the base iteration state
 */
export type BaseIterationState = z.infer<typeof baseIterationStateSchema>;

/**
 * Type for accumulated usage
 */
export type AccumulatedUsage = z.infer<typeof accumulatedUsageSchema>;
