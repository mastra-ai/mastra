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
      // Helper function to flush messages before suspension
      const flushMessagesBeforeSuspension = async () => {
        const { saveQueueManager, memoryConfig, threadId, resourceId, memory } = _internal || {};

        console.log('[DEBUG] flushMessagesBeforeSuspension called', {
          hasSaveQueueManager: !!saveQueueManager,
          hasMemory: !!memory,
          threadId,
          resourceId,
          threadExists: _internal?.threadExists,
        });

        if (!saveQueueManager || !threadId) {
          console.log('[DEBUG] Early return: missing saveQueueManager or threadId');
          return;
        }

        try {
          // Ensure thread exists before flushing messages
          if (memory && !_internal.threadExists && resourceId) {
            console.log('[DEBUG] Checking if thread exists...');
            const thread = await memory.getThreadById?.({ threadId });
            if (!thread) {
              console.log('[DEBUG] Thread does not exist, creating it...');
              // Thread doesn't exist yet, create it now
              await memory.createThread?.({
                threadId,
                resourceId,
                memoryConfig,
              });
              _internal.threadExists = true;
              console.log('[DEBUG] Thread created successfully');
            } else {
              _internal.threadExists = true;
              console.log('[DEBUG] Thread already exists');
            }
          }

          // Flush all pending messages immediately
          console.log('[DEBUG] Flushing messages...');
          console.log('[DEBUG] MessageList state:', {
            allMessages: messageList.get.all.core().length,
            unsavedCount: messageList.getEarliestUnsavedMessageTimestamp() ? 'has unsaved' : 'no unsaved',
          });
          await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
          console.log('[DEBUG] Messages flushed successfully');
        } catch (error) {
          console.error('Error flushing messages before suspension:', error);
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
            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

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
            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

            controller.enqueue({
              type: 'tool-call-suspended',
              runId,
              from: ChunkFrom.AGENT,
              payload: { toolCallId: inputData.toolCallId, toolName: inputData.toolName, suspendPayload },
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
