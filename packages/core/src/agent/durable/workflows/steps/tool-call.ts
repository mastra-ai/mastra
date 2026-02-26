import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import type { Mastra } from '../../../../mastra';
import type { MastraMemory } from '../../../../memory/memory';
import type { MemoryConfig } from '../../../../memory/types';
import { ChunkFrom } from '../../../../stream/types';
import { createStep } from '../../../../workflows';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { SuspendOptions } from '../../../../workflows/step';
import type { MessageList } from '../../../message-list';
import type { SaveQueueManager } from '../../../save-queue';
import { DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitSuspendedEvent, emitChunkEvent } from '../../stream-adapter';
import type { DurableToolCallInput, SerializableDurableOptions, AgentSuspendedEventData } from '../../types';
import { resolveTool, toolRequiresApproval } from '../../utils/resolve-runtime';
import { serializeError } from '../../utils/serialize-state';

/**
 * Input schema for the durable tool call step.
 * Each tool call flows through this schema when using .foreach()
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
 * Flush messages to memory before suspending.
 * Mirrors the base Agent's flushMessagesBeforeSuspension() to ensure
 * the thread exists and all pending messages are persisted.
 */
async function flushMessagesBeforeSuspension({
  saveQueueManager,
  messageList,
  memory,
  threadId,
  resourceId,
  memoryConfig,
  threadExists,
  onThreadCreated,
}: {
  saveQueueManager?: SaveQueueManager;
  messageList?: MessageList;
  memory?: MastraMemory;
  threadId?: string;
  resourceId?: string;
  memoryConfig?: MemoryConfig;
  threadExists?: boolean;
  onThreadCreated?: () => void;
}) {
  if (!saveQueueManager || !messageList || !threadId) {
    return;
  }

  try {
    // Ensure thread exists before flushing messages
    if (memory && !threadExists && resourceId) {
      const thread = await memory.getThreadById?.({ threadId });
      if (!thread) {
        await memory.createThread?.({
          threadId,
          resourceId,
          memoryConfig,
        });
      }
      onThreadCreated?.();
    }

    // Flush all pending messages immediately
    await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
  } catch {
    // Log but don't throw — suspension should proceed even if flush fails
  }
}

/**
 * Create a durable tool call step.
 *
 * This step mirrors the base Agent's createToolCallStep pattern:
 * 1. Resolves the tool from the run registry or Mastra
 * 2. Checks if approval is required (global or per-tool)
 * 3. If approval required, emits suspended event, persists messages, and suspends
 * 4. Executes the tool with a suspend callback for in-execution suspension
 * 5. Emits tool-result or tool-error chunks via PubSub
 * 6. Returns the result or error
 *
 * Tool suspension is handled via workflow suspend/resume mechanism:
 * - Tool approval: step suspends with approval payload
 * - In-execution suspension: tool calls suspend() callback, step suspends with suspension payload
 * - Message persistence: messages are flushed before any suspension
 */
export function createDurableToolCallStep() {
  return createStep({
    id: DurableStepIds.TOOL_CALL,
    inputSchema: durableToolCallInputSchema,
    outputSchema: durableToolCallOutputSchema,
    execute: async params => {
      const { inputData, mastra, suspend, resumeData, requestContext, getInitData } = params;

      // Access pubsub via symbol
      const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

      const typedInput = inputData as DurableToolCallInput;
      const { toolCallId, toolName, args, providerExecuted, output } = typedInput;

      // Get context from init data (the parent workflow input)
      const initData = getInitData<{
        runId: string;
        agentId: string;
        options: SerializableDurableOptions;
        state: {
          threadId?: string;
          resourceId?: string;
          memoryConfig?: MemoryConfig;
          threadExists?: boolean;
        };
      }>();

      const { runId, options: agentOptions, state } = initData;

      // If the tool was already executed by the provider, return the output
      if (providerExecuted && output !== undefined) {
        return {
          ...typedInput,
          result: output,
        };
      }

      // 1. Resolve the tool from global registry first, then Mastra
      const registryEntry = globalRunRegistry.get(runId);
      let tool = registryEntry?.tools?.[toolName];

      if (!tool) {
        tool = resolveTool(toolName, mastra as Mastra);
      }

      if (!tool) {
        const error = {
          name: 'ToolNotFoundError',
          message: `Tool ${toolName} not found`,
        };
        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tool-error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { toolCallId, toolName, args, error },
          });
        }
        return {
          ...typedInput,
          error,
        };
      }

      // Get memory-related state for message persistence
      const saveQueueManager = registryEntry?.saveQueueManager;
      const memory = registryEntry?.memory;
      const workspace = registryEntry?.workspace;
      let threadExists = state?.threadExists ?? false;

      // Reconstruct MessageList from workflow state if available
      // Note: In foreach mode, the message list from the registry may be available
      // but for durability, we access what's available through the registry
      let messageList: MessageList | undefined;
      // For local execution, the globalRunRegistry might have an ExtendedRunRegistry entry
      // that stores the messageList. We cast and check safely.
      const extendedEntry = globalRunRegistry.get(runId) as any;
      if (extendedEntry?.messageList) {
        messageList = extendedEntry.messageList;
      }

      const doFlush = () =>
        flushMessagesBeforeSuspension({
          saveQueueManager,
          messageList,
          memory,
          threadId: state?.threadId,
          resourceId: state?.resourceId,
          memoryConfig: state?.memoryConfig,
          threadExists,
          onThreadCreated: () => {
            threadExists = true;
          },
        });

      // 2. Check if tool requires approval
      const requiresApproval = await toolRequiresApproval(tool, agentOptions.requireToolApproval, args);

      if (requiresApproval && !resumeData) {
        const resumeSchema = JSON.stringify({
          type: 'object',
          properties: {
            approved: { type: 'boolean' },
          },
          required: ['approved'],
        });

        // Emit approval chunk via PubSub (mirrors base agent's controller.enqueue)
        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tool-call-approval',
            runId,
            from: ChunkFrom.AGENT,
            payload: { toolCallId, toolName, args, resumeSchema },
          });
        }

        // Emit suspended event for the stream adapter
        if (pubsub) {
          await emitSuspendedEvent(pubsub, runId, {
            toolCallId,
            toolName,
            args,
            type: 'approval',
            resumeSchema,
          });
        }

        // Flush messages before suspension
        await doFlush();

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

      // Check if resuming from in-execution suspension
      // Pass resumeData through to the tool so it can continue from where it left off
      const isResumingFromSuspension =
        resumeData && typeof resumeData === 'object' && resumeData !== null && !('approved' in resumeData);

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
          workspace,
          requestContext,
          resumeData: isResumingFromSuspension ? resumeData : undefined,

          // In-execution suspend callback — allows tools to suspend mid-execution
          suspend: async (suspendPayload: any, suspendOptions?: SuspendOptions) => {
            if (suspendOptions?.requireToolApproval) {
              // Tool is requesting approval during execution
              const approvalResumeSchema = JSON.stringify({
                type: 'object',
                properties: {
                  approved: { type: 'boolean' },
                },
                required: ['approved'],
              });

              if (pubsub) {
                await emitChunkEvent(pubsub, runId, {
                  type: 'tool-call-approval',
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: { toolCallId, toolName, args, resumeSchema: approvalResumeSchema },
                });
              }

              if (pubsub) {
                await emitSuspendedEvent(pubsub, runId, {
                  toolCallId,
                  toolName,
                  args,
                  type: 'approval',
                  resumeSchema: approvalResumeSchema,
                });
              }

              await doFlush();

              return suspend(
                {
                  type: 'approval',
                  requireToolApproval: { toolCallId, toolName, args },
                },
                { resumeLabel: toolCallId },
              );
            } else {
              // General tool suspension (e.g., tool calls context.agent.suspend())
              const suspendedEventData: AgentSuspendedEventData = {
                toolCallId,
                toolName,
                args,
                suspendPayload,
                type: 'suspension',
                resumeSchema: suspendOptions?.resumeSchema,
              };

              if (pubsub) {
                await emitChunkEvent(pubsub, runId, {
                  type: 'tool-call-suspended',
                  runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    toolCallId,
                    toolName,
                    suspendPayload,
                    args,
                    resumeSchema: suspendOptions?.resumeSchema,
                  },
                });

                await emitSuspendedEvent(pubsub, runId, suspendedEventData);
              }

              await doFlush();

              return suspend(
                {
                  type: 'suspension',
                  toolCallSuspended: suspendPayload,
                  toolName,
                  resumeLabel: suspendOptions?.resumeLabel,
                },
                { resumeLabel: toolCallId },
              );
            }
          },
        });

        // Emit tool-result chunk
        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tool-result',
            runId,
            from: ChunkFrom.AGENT,
            payload: { toolCallId, toolName, args, result },
          });
        }

        return {
          ...typedInput,
          result,
        };
      } catch (error) {
        const toolError = serializeError(error);

        // Emit tool-error chunk
        if (pubsub) {
          await emitChunkEvent(pubsub, runId, {
            type: 'tool-error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { toolCallId, toolName, args, error: toolError },
          });
        }

        return {
          ...typedInput,
          error: toolError,
        };
      }
    },
  });
}
