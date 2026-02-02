import { z } from 'zod';
import type { MastraScorer, MastraScorerEntry } from '../../../../evals/base';
import { runScorer } from '../../../../evals/hooks';
import type { Mastra } from '../../../../mastra';
import { RequestContext } from '../../../../request-context';
import { createStep } from '../../../../workflows';
import { DurableStepIds } from '../../constants';
import type { SerializableScorersConfig, SerializableDurableState } from '../../types';

/**
 * Input schema for the durable scorer execution step
 */
const durableScorerInputSchema = z.object({
  /** Scorers configuration (serialized scorer names and sampling) */
  scorers: z.record(
    z.object({
      scorerName: z.string(),
      sampling: z
        .union([z.object({ type: z.literal('none') }), z.object({ type: z.literal('ratio'), rate: z.number() })])
        .optional(),
    }),
  ),
  /** Run identifier */
  runId: z.string(),
  /** Agent identifier */
  agentId: z.string(),
  /** Agent name */
  agentName: z.string().optional(),
  /** Input messages for scoring (serialized) */
  scorerInput: z.any(),
  /** Output messages for scoring (serialized) */
  scorerOutput: z.any(),
  /** Whether output is structured */
  structuredOutput: z.boolean().optional(),
  /** Thread ID if using memory */
  threadId: z.string().optional(),
  /** Resource ID if using memory */
  resourceId: z.string().optional(),
  /** State for context */
  state: z.any(),
});

/**
 * Output schema for the durable scorer execution step
 */
const durableScorerOutputSchema = z.object({
  /** Number of scorers executed */
  scorersExecuted: z.number(),
  /** List of scorer names that were executed */
  executedScorerNames: z.array(z.string()),
  /** Whether scorer execution was skipped (no scorers configured) */
  skipped: z.boolean(),
});

/**
 * Input type for scorer execution
 */
export interface DurableScorerInput {
  scorers: SerializableScorersConfig;
  runId: string;
  agentId: string;
  agentName?: string;
  scorerInput: {
    inputMessages: any[];
    rememberedMessages: any[];
    systemMessages: any[];
    taggedSystemMessages: Record<string, any[]>;
  };
  scorerOutput: any[];
  structuredOutput?: boolean;
  threadId?: string;
  resourceId?: string;
  state: SerializableDurableState;
}

/**
 * Create a durable scorer execution step.
 *
 * This step:
 * 1. Takes the serialized scorers configuration
 * 2. Resolves each scorer from Mastra at runtime
 * 3. Calls runScorer for each configured scorer
 *
 * Scorer execution is fire-and-forget - it doesn't affect the main execution result.
 * Scorers are used for evaluation and monitoring purposes.
 */
export function createDurableScorerStep() {
  return createStep({
    id: DurableStepIds.SCORER_EXECUTION,
    inputSchema: durableScorerInputSchema,
    outputSchema: durableScorerOutputSchema,
    execute: async ({ inputData, mastra, requestContext, tracingContext }) => {
      const typedInput = inputData as DurableScorerInput;
      const { scorers, runId, agentId, agentName, scorerInput, scorerOutput, structuredOutput, threadId, resourceId } =
        typedInput;

      // If no scorers configured, skip
      if (!scorers || Object.keys(scorers).length === 0) {
        return {
          scorersExecuted: 0,
          executedScorerNames: [],
          skipped: true,
        };
      }

      const logger = mastra?.getLogger?.();
      const executedScorerNames: string[] = [];

      // Create a request context for scorer resolution
      const resolveContext = requestContext ?? new RequestContext();

      // Execute each scorer
      for (const [scorerKey, scorerEntry] of Object.entries(scorers)) {
        const { scorerName, sampling } = scorerEntry;

        try {
          // Resolve the scorer from Mastra
          const scorer = (mastra as Mastra)?.getScorer?.(scorerName) as MastraScorer | undefined;

          if (!scorer) {
            logger?.warn?.(`Scorer ${scorerName} not found in Mastra, skipping`, { runId, scorerKey });
            continue;
          }

          // Create the scorer entry expected by runScorer
          const scorerObject: MastraScorerEntry = {
            scorer,
            sampling,
          };

          // Call runScorer (fire-and-forget via hooks)
          runScorer({
            runId,
            scorerId: scorerKey,
            scorerObject,
            input: scorerInput,
            output: scorerOutput,
            requestContext: resolveContext as any,
            entity: {
              id: agentId,
              name: agentName ?? agentId,
            },
            structuredOutput: structuredOutput ?? false,
            source: 'LIVE',
            entityType: 'AGENT',
            threadId,
            resourceId,
            tracingContext,
          });

          executedScorerNames.push(scorerName);
        } catch (error) {
          // Log but don't fail - scorer errors shouldn't affect main execution
          logger?.warn?.(`Error executing scorer ${scorerName}`, { error, runId, scorerKey });
        }
      }

      return {
        scorersExecuted: executedScorerNames.length,
        executedScorerNames,
        skipped: false,
      };
    },
  });
}
