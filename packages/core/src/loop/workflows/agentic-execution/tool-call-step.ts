import type { ToolSet } from 'ai-v5';
import type { MastraMessageV2 } from '../../../memory';
import type { OutputSchema } from '../../../stream/base/schema';
import { ChunkFrom } from '../../../stream/types';
import type { MastraToolInvocationOptions } from '../../../tools/types';
import { createStep } from '../../../workflows';
import { assembleOperationName, getTracer } from '../../telemetry';
import type { OuterLLMRun } from '../../types';
import { toolCallInputSchema, toolCallOutputSchema } from '../schema';

export function createToolCallStep<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  tools,
  messageList,
  options,
  telemetry_settings,
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
    execute: async ({ inputData, suspend, resumeData, runtimeContext }) => {
      // Helper function to add tool approval metadata to the assistant message
      const addToolApprovalMetadata = (toolCallId: string, toolName: string, args: unknown) => {
        // Find the last assistant message in the response (which should contain this tool call)
        const responseMessages = messageList.get.response.v2();
        const lastAssistantMessage = [...responseMessages].reverse().find(msg => msg.role === 'assistant');

        if (lastAssistantMessage) {
          const content = lastAssistantMessage.content;
          if (!content) return;
          // Add metadata to indicate this tool call is pending approval
          const metadata =
            typeof lastAssistantMessage.content.metadata === 'object' && lastAssistantMessage.content.metadata !== null
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

        const getMetadata = (message: MastraMessageV2) => {
          const content = message.content;
          if (!content) return undefined;
          const metadata =
            typeof content.metadata === 'object' && content.metadata !== null
              ? (content.metadata as Record<string, any>)
              : undefined;
          return metadata;
        };

        // Find and update the assistant message to remove approval metadata
        // At this point, messages have been persisted, so we look in all messages
        const allMessages = messageList.get.all.v2();
        const lastAssistantMessage = [...allMessages].reverse().find(msg => {
          const metadata = getMetadata(msg);
          const pendingToolApprovals = metadata?.pendingToolApprovals as Record<string, any> | undefined;
          return !!pendingToolApprovals?.[toolCallId];
        });

        if (lastAssistantMessage) {
          const metadata = getMetadata(lastAssistantMessage);
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
        // Still emit telemetry for provider-executed tools
        const tracer = getTracer({
          isEnabled: telemetry_settings?.isEnabled,
          tracer: telemetry_settings?.tracer,
        });

        const span = tracer.startSpan('mastra.stream.toolCall').setAttributes({
          ...assembleOperationName({
            operationId: 'mastra.stream.toolCall',
            telemetry: telemetry_settings,
          }),
          'stream.toolCall.toolName': inputData.toolName,
          'stream.toolCall.toolCallId': inputData.toolCallId,
          'stream.toolCall.args': JSON.stringify(inputData.args),
          'stream.toolCall.providerExecuted': true,
        });

        if (inputData.output) {
          span.setAttributes({
            'stream.toolCall.result': JSON.stringify(inputData.output),
          });
        }

        span.end();

        // Return the provider-executed result
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

      const tracer = getTracer({
        isEnabled: telemetry_settings?.isEnabled,
        tracer: telemetry_settings?.tracer,
      });

      const span = tracer.startSpan('mastra.stream.toolCall').setAttributes({
        ...assembleOperationName({
          operationId: 'mastra.stream.toolCall',
          telemetry: telemetry_settings,
        }),
        'stream.toolCall.toolName': inputData.toolName,
        'stream.toolCall.toolCallId': inputData.toolCallId,
        'stream.toolCall.args': JSON.stringify(inputData.args),
      });

      try {
        const requireToolApproval = runtimeContext.get('__mastra_requireToolApproval');
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
              span.end();
              span.setAttributes({
                'stream.toolCall.result': 'Tool call was not approved by the user',
              });
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

        span.setAttributes({
          'stream.toolCall.result': JSON.stringify(result),
        });

        span.end();

        return { result, ...inputData };
      } catch (error) {
        span.setStatus({
          code: 2,
          message: (error as Error)?.message ?? error,
        });
        span.recordException(error as Error);
        return {
          error: error as Error,
          ...inputData,
        };
      }
    },
  });
}
