import type { ToolSet } from 'ai-v5';
import type { OutputSchema } from '../../../stream/base/schema';
import { ChunkFrom } from '../../../stream/types';
import type { MastraToolInvocationOptions } from '../../../tools/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { toolCallInputSchema, toolCallOutputSchema } from '../schema';

export function createToolCallStep<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  tools,
  messageList,
  options,
  writer,
  controller,
  runId,
  streamState,
  modelSpanTracker,
  _internal,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'toolCallStep',
    inputSchema: toolCallInputSchema,
    outputSchema: toolCallOutputSchema,
    execute: async ({ inputData, suspend, resumeData, requestContext }) => {
      // Helper function to flush messages and store suspension state in thread metadata
      const suspendWithMetadata = async (suspensionData?: {
        toolCallId: string;
        toolName: string;
        args: Record<string, any>;
        type: 'approval' | 'suspend';
      }) => {
        const { saveQueueManager, memoryConfig, threadId, resourceId, memory } = _internal || {};

        if (!saveQueueManager || !threadId) {
          return;
        }

        try {
          // Flush all pending messages immediately
          await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);

          // Update thread metadata with pending suspension data if provided
          if (memory && suspensionData) {
            let currentThread = await memory.getThreadById?.({ threadId });

            if (!currentThread && resourceId) {
              // Thread doesn't exist yet, create it now - this returns the thread with metadata
              currentThread = await memory.createThread?.({
                threadId,
                resourceId,
                memoryConfig,
              });
            }

            if (currentThread) {
              const currentMetadata = currentThread.metadata || {};
              const pendingSuspensions = (currentMetadata.pendingSuspensions as Record<string, any>) || {};

              await memory.updateThread({
                id: threadId,
                title: currentThread.title,
                metadata: {
                  ...currentMetadata,
                  pendingSuspensions: {
                    ...pendingSuspensions,
                    [suspensionData.toolCallId]: {
                      toolName: suspensionData.toolName,
                      args: suspensionData.args,
                      type: suspensionData.type,
                    },
                  },
                },
              });
            }
          }
        } catch (error) {
          console.error('Error during suspension with metadata:', error);
        }
      };

      const clearSuspensionMetadata = async (toolCallId: string) => {
        const { memory, threadId } = _internal || {};
        if (!memory || !threadId) {
          return;
        }

        try {
          const thread = await memory.getThreadById({ threadId });
          if (!thread) {
            return;
          }
          const currentMetadata = thread?.metadata || {};
          const pendingSuspensions = { ...((currentMetadata.pendingSuspensions as Record<string, any>) || {}) };
          delete pendingSuspensions[toolCallId];

          await memory.updateThread({
            id: threadId,
            title: thread?.title,
            metadata: {
              ...currentMetadata,
              pendingSuspensions,
            },
          });
        } catch (error) {
          console.error('Error clearing suspension metadata:', error);
        }
      };

      // If the tool was already executed by the provider, skip execution
      if (inputData.providerExecuted) {
        return {
          ...inputData,
          result: inputData.output,
        };
      }

      const tool =
        tools?.[inputData.toolName] ||
        Object.values(tools || {})?.find(tool => `id` in tool && tool.id === inputData.toolName);

      if (!tool) {
        throw new Error(`Tool ${inputData.toolName} not found`);
      }

      if (tool && 'onInputAvailable' in tool) {
        try {
          await tool?.onInputAvailable?.({
            toolCallId: inputData.toolCallId,
            input: inputData.args,
            messages: messageList.get.input.aiV5.model(),
            abortSignal: options?.abortSignal,
          });
        } catch (error) {
          console.error('Error calling onInputAvailable', error);
        }
      }

      if (!tool.execute) {
        return inputData;
      }

      try {
        const requireToolApproval = requestContext.get('__mastra_requireToolApproval');
        if (requireToolApproval || (tool as any).requireApproval) {
          if (!resumeData) {
            controller.enqueue({
              type: 'tool-call-approval',
              runId,
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args: inputData.args,
              },
            });

            // Flush messages and update thread metadata with pending approval
            await suspendWithMetadata({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              args: inputData.args,
              type: 'approval',
            });

            return suspend(
              {
                requireToolApproval: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                },
                __streamState: streamState.serialize(),
              },
              {
                resumeLabel: inputData.toolCallId,
              },
            );
          } else {
            // Clear the pending suspension from thread metadata
            await clearSuspensionMetadata(inputData.toolCallId);

            if (!resumeData.approved) {
              return {
                result: 'Tool call was not approved by the user',
                ...inputData,
              };
            }
          }
        }

        const toolOptions: MastraToolInvocationOptions = {
          abortSignal: options?.abortSignal,
          toolCallId: inputData.toolCallId,
          messages: messageList.get.input.aiV5.model(),
          writableStream: writer,
          // Pass current step span as parent for tool call spans
          tracingContext: modelSpanTracker?.getTracingContext(),
          suspend: async (suspendPayload: any) => {
            controller.enqueue({
              type: 'tool-call-suspended',
              runId,
              from: ChunkFrom.AGENT,
              payload: { toolCallId: inputData.toolCallId, toolName: inputData.toolName, suspendPayload },
            });

            // Flush messages and store suspension data in thread metadata
            await suspendWithMetadata({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              args: inputData.args,
              type: 'suspend',
            });
            return await suspend(
              {
                toolCallSuspended: suspendPayload,
                __streamState: streamState.serialize(),
              },
              {
                resumeLabel: inputData.toolCallId,
              },
            );
          },
          resumeData,
        };

        const result = await tool.execute(inputData.args, toolOptions);

        // Clear pending suspension if this was a resumed execution
        if (resumeData) {
          await clearSuspensionMetadata(inputData.toolCallId);
        }

        return { result, ...inputData };
      } catch (error) {
        return {
          error: error as Error,
          ...inputData,
        };
      }
    },
  });
}
