import { z } from 'zod';
import { createStep } from '../../../../workflows';
import type { PubSub } from '../../../../events/pubsub';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { Mastra } from '../../../../mastra';
import { DurableStepIds } from '../../constants';
import { emitChunkEvent, emitSuspendedEvent } from '../../stream-adapter';
import { resolveTool, toolRequiresApproval } from '../../utils/resolve-runtime';
import { serializeError } from '../../utils/serialize-state';
import type { RunRegistry } from '../../run-registry';
import type { DurableToolCallInput, DurableToolCallOutput, SerializableDurableOptions } from '../../types';

/**
 * Input schema for the durable tool call step
 */
const durableToolCallInputSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.any()),
  providerMetadata: z.record(z.any()).optional(),
  providerExecuted: z.boolean().optional(),
  output: z.any().optional(),
});

/**
 * Output schema for the durable tool call step
 */
const durableToolCallOutputSchema = durableToolCallInputSchema.extend({
  result: z.any().optional(),
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});

/**
 * Context passed to the tool call step via workflow state
 */
interface ToolCallStepContext {
  runId: string;
  agentId: string;
  options: SerializableDurableOptions;
}

/**
 * Options for creating the durable tool call step
 */
export interface DurableToolCallStepOptions {
  /** Run registry for accessing non-serializable state */
  runRegistry: RunRegistry;
  /** Context from the parent workflow */
  context: ToolCallStepContext;
}

/**
 * Create a durable tool call step.
 *
 * This step:
 * 1. Resolves the tool from the run registry or Mastra
 * 2. Checks if approval is required
 * 3. If approval required, suspends and waits for resume
 * 4. Executes the tool with the provided arguments
 * 5. Returns the result or error
 *
 * Tool suspension is handled via workflow suspend/resume mechanism.
 */
export function createDurableToolCallStep(options: DurableToolCallStepOptions) {
  const { runRegistry, context } = options;

  return createStep({
    id: DurableStepIds.TOOL_CALL,
    inputSchema: durableToolCallInputSchema,
    outputSchema: durableToolCallOutputSchema,
    execute: async params => {
      const { inputData, mastra, suspend, resumeData } = params;

      // Access pubsub via symbol
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub;

      const typedInput = inputData as DurableToolCallInput;
      const { toolCallId, toolName, args, providerExecuted, output } = typedInput;

      // If the tool was already executed by the provider, return the output
      if (providerExecuted && output !== undefined) {
        return {
          ...typedInput,
          result: output,
        };
      }

      // 1. Resolve the tool from Mastra's global tool registry
      const tool = resolveTool(toolName, mastra as Mastra);

      if (!tool) {
        return {
          ...typedInput,
          error: {
            name: 'ToolNotFoundError',
            message: `Tool ${toolName} not found`,
          },
        };
      }

      // 2. Check if tool requires approval
      const requiresApproval = toolRequiresApproval(tool, context.options.requireToolApproval);

      if (requiresApproval && !resumeData) {
        // Emit suspended event
        await emitSuspendedEvent(pubsub, context.runId, {
          toolCallId,
          toolName,
          args,
          type: 'approval',
          resumeSchema: JSON.stringify({
            type: 'object',
            properties: {
              approved: { type: 'boolean' },
            },
            required: ['approved'],
          }),
        });

        // Suspend and wait for approval
        return suspend(
          {
            type: 'approval',
            toolCallId,
            toolName,
            args,
          },
          {
            resumeLabel: toolCallId,
          },
        );
      }

      // Check if resuming from approval
      if (resumeData && typeof resumeData === 'object' && resumeData !== null && 'approved' in resumeData) {
        if (!(resumeData as { approved: boolean }).approved) {
          return {
            ...typedInput,
            result: 'Tool call was not approved by the user',
          };
        }
      }

      // 3. Execute the tool
      if (!tool.execute) {
        return {
          ...typedInput,
          result: undefined,
        };
      }

      try {
        const result = await tool.execute(args, {
          toolCallId,
          messages: [],
          // Note: In the full implementation, we'd pass more context here
        });

        return {
          ...typedInput,
          result,
        };
      } catch (error) {
        return {
          ...typedInput,
          error: serializeError(error),
        };
      }
    },
  });
}
