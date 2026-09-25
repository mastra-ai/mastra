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
 * Returns the path of the first value that would not survive a JSON round trip
 * (functions, symbols, bigints, non-finite numbers, class instances, cycles, and
 * `undefined` array items), or undefined if the value is JSON-safe. Undefined
 * object properties are allowed (JSON drops them), and so are Dates: the workflow
 * snapshot codec round-trips them.
 */
function findNonJsonSafePath(value: unknown, path: string, ancestors: Set<object>): string | undefined {
  if (value === null || value === undefined) return undefined;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return undefined;
  if (type === 'number') return Number.isFinite(value) ? undefined : path || '<root>';
  if (type !== 'object') return path || '<root>';
  if (value instanceof Date) return undefined;
  // Only objects on the current path form a cycle; shared references are fine.
  if (ancestors.has(value as object)) return path || '<root>';
  ancestors.add(value as object);
  try {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemPath = `${path}[${i}]`;
        if (value[i] === undefined) return itemPath;
        const bad = findNonJsonSafePath(value[i], itemPath, ancestors);
        if (bad) return bad;
      }
      return undefined;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return path || '<root>';
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const bad = findNonJsonSafePath(child, path ? `${path}.${key}` : key, ancestors);
      if (bad) return bad;
    }
    return undefined;
  } finally {
    ancestors.delete(value as object);
  }
}

/**
 * Schema for the serialized durable options carried in workflow input. These
 * options cross step boundaries (and processes) as JSON, so live objects such
 * as Zod schemas must be converted before they get here — otherwise they are
 * silently mangled by the round trip.
 */
export const durableOptionsSchema = z.any().superRefine((value, ctx) => {
  const badPath = findNonJsonSafePath(value, '', new Set());
  if (badPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Durable agent options must be JSON-safe; found a non-serializable value at options.${badPath}`,
    });
  }
});

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
  options: durableOptionsSchema,
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
  options: durableOptionsSchema,
  state: z.any(),
  messageId: z.string(),
  // JSON-safe snapshot of the caller's requestContext.entries(), carried
  // across every iteration so steps that rebuild runtime state from the Mastra
  // instance resolve with the same request context on iteration N as on
  // iteration 1. Dropping it here silently falls back to an empty context.
  requestContextEntries: z.record(z.string(), z.any()).optional(),
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
