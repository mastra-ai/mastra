import type { ToolSet } from 'ai-v5';
import type { MastraToolInvocationOptions } from '../../../tools/types';
import type { OutputSchema } from '../../../stream/base/schema';
import { ChunkFrom } from '../../../stream/types';
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
  requireToolApproval,
  controller,
  runId,
  streamState,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'toolCallStep',
    inputSchema: toolCallInputSchema,
    outputSchema: toolCallOutputSchema,
    execute: async ({ inputData, suspend, resumeData }) => {
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
            await suspend({
              requireToolApproval: {
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args: inputData.args,
              },
              __streamState: streamState.serialize(),
            });
          } else {
            if (!resumeData.approved) {
              const error = new Error(
                'Tool call was declined: ' +
                  JSON.stringify({
                    toolCallId: inputData.toolCallId,
                    toolName: inputData.toolName,
                    args: inputData.args,
                  }),
              );

              return {
                error,
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
          suspend: async (suspendPayload: any) => {
            controller.enqueue({
              type: 'tool-call-suspended',
              runId,
              from: ChunkFrom.AGENT,
              payload: { toolCallId: inputData.toolCallId, toolName: inputData.toolName, suspendPayload },
            });

            return await suspend({
              toolCallSuspended: suspendPayload,
              __streamState: streamState.serialize(),
            });
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
