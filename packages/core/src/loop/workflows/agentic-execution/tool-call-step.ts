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
      // Helper function to add tool approval metadata to the assistant message
      const addToolApprovalMetadata = (toolCallId: string, toolName: string, args: unknown) => {
        // Find the last assistant message in the response (which should contain this tool call)
        const responseMessages = messageList.get.response.db();
        const lastAssistantMessage = [...responseMessages].reverse().find(msg => msg.role === 'assistant');

        if (lastAssistantMessage) {
          const content = lastAssistantMessage.content;
          if (!content) return;
          // Add metadata to indicate this tool call is pending approval
          const metadata =
            typeof lastAssistantMessage.content.metadata === 'object'
              ? (lastAssistantMessage.content.metadata as Record<string, any>)
              : {};
          metadata.pendingToolApprovals = metadata.pendingToolApprovals || {};
          metadata.pendingToolApprovals[toolCallId] = {
            toolName,
            args,
            type: 'approval',
            runId, // Store the runId so we can resume after page refresh
          };
          lastAssistantMessage.content.metadata = metadata;
        }
      };

      // Helper function to remove tool approval metadata after approval/decline
      const removeToolApprovalMetadata = async (toolCallId: string) => {
        const { saveQueueManager, memoryConfig, threadId } = _internal || {};

        if (!saveQueueManager || !threadId) {
          return;
        }

        // Find and update the assistant message to remove approval metadata
        // At this point, messages have been persisted, so we look in all messages
        const allMessages = messageList.get.all.db();
        const lastAssistantMessage = [...allMessages].reverse().find(msg => msg.role === 'assistant');

        if (lastAssistantMessage) {
          const metadata = lastAssistantMessage.content.metadata as Record<string, any> | undefined;
          const pendingToolApprovals = metadata?.pendingToolApprovals as Record<string, any> | undefined;

          if (pendingToolApprovals && typeof pendingToolApprovals === 'object') {
            delete pendingToolApprovals[toolCallId];

            // If no more pending suspensions, remove the whole object
            if (metadata && Object.keys(pendingToolApprovals).length === 0) {
              delete metadata.pendingToolApprovals;
            }

            // Flush to persist the metadata removal
            try {
              await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
            } catch (error) {
              console.error('Error removing tool approval metadata:', error);
            }
          }
        }
      };

      // Helper function to flush messages before suspension
      const flushMessagesBeforeSuspension = async () => {
        const { saveQueueManager, memoryConfig, threadId, resourceId, memory } = _internal || {};

        if (!saveQueueManager || !threadId) {
          console.warn('flushMessagesBeforeSuspension: saveQueueManager or threadId is missing');
          return;
        }

        try {
          // Ensure thread exists before flushing messages
          if (memory && !_internal.threadExists && resourceId) {
            const thread = await memory.getThreadById?.({ threadId });
            if (!thread) {
              // Thread doesn't exist yet, create it now
              await memory.createThread?.({
                threadId,
                resourceId,
                memoryConfig,
              });
            }
            _internal.threadExists = true;
          }

          // Flush all pending messages immediately
          await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
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

            // Add approval metadata to message before persisting
            addToolApprovalMetadata(inputData.toolCallId, inputData.toolName, inputData.args);

            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

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
            // Remove approval metadata since we're resuming (either approved or declined)
            await removeToolApprovalMetadata(inputData.toolCallId);

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

            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

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

        // Call onOutput hook after successful execution
        if (tool && 'onOutput' in tool && typeof (tool as any).onOutput === 'function') {
          try {
            await (tool as any).onOutput({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              output: result,
              abortSignal: options?.abortSignal,
            });
          } catch (error) {
            console.error('Error calling onOutput', error);
          }
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
