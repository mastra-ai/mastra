import { z } from 'zod/v4';

/**
 * Schema for agent default options.
 * Based on StorageDefaultOptions type from @mastra/core.
 *
 * This schema represents the serializable subset of AgentExecutionOptionsBase,
 * excluding callbacks, runtime objects, and function references.
 */
export const defaultOptionsSchema = z
  .object({
    /** Unique identifier for this execution run */
    runId: z.string().optional(),

    /** Save messages incrementally after each stream step completes (default: false) */
    savePerStep: z.boolean().optional(),

    /** Maximum number of steps to run */
    maxSteps: z.number().optional(),

    /** Provider-specific options passed to the language model */

    /** Tools that are active for this execution (stored as tool IDs) */
    activeTools: z.array(z.string()).optional(),

    /** Maximum number of times processors can trigger a retry */
    maxProcessorRetries: z.number().optional(),

    /** Tool selection strategy: 'auto', 'none', 'required', or specific tools */
    toolChoice: z
      .union([
        z.literal('auto'),
        z.literal('none'),
        z.literal('required'),
        z.object({ type: z.literal('tool'), toolName: z.string() }),
      ])
      .optional(),

    /** Model-specific settings like temperature, maxTokens, topP, etc. */
    modelSettings: z
      .object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        topP: z.number().optional(),
        topK: z.number().optional(),
        frequencyPenalty: z.number().optional(),
        presencePenalty: z.number().optional(),
        stopSequences: z.array(z.string()).optional(),
        seed: z.number().optional(),
        maxRetries: z.number().optional(),
      })
      .optional(),

    /** Whether to return detailed scoring data in the response */
    returnScorerData: z.boolean().optional(),

    /** Tracing options for starting new traces */
    tracingOptions: z
      .object({
        traceName: z.string().optional(),
        attributes: z.record(z.string(), z.unknown()).optional(),
        spanId: z.string().optional(),
        traceId: z.string().optional(),
      })
      .optional(),

    /** Require approval for all tool calls */
    requireToolApproval: z.boolean().optional(),

    /** Automatically resume suspended tools */
    autoResumeSuspendedTools: z.boolean().optional(),

    /**
     * Concurrency for parallel tool calls. A number sets the limit; an object
     * `{ limit?, strategy? }` also selects the strategy ('available' default,
     * or 'called' to only serialize when the batch actually calls a suspend/approval tool).
     */
    toolCallConcurrency: z
      .union([
        z.number(),
        z.object({
          limit: z.number().optional(),
          strategy: z.enum(['available', 'called']).optional(),
        }),
      ])
      .optional(),

    /** Whether to include raw chunks in the stream output */
    includeRawChunks: z.boolean().optional(),
  })
  .passthrough() // Allow additional provider-specific options
  .describe('Default options for agent execution');
