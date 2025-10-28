import type { ToolSet } from 'ai-v5';
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
>() {
  return createStep({
    id: 'toolCallStep',
    inputSchema: toolCallInputSchema,
    outputSchema: toolCallOutputSchema,
    execute: async ({ inputData, suspend, resumeData, runtimeContext, state }) => {
      console.log('[DEBUG] Tool-call-step executing:', {
        toolName: inputData.toolName,
        toolCallId: inputData.toolCallId,
        hasResumeData: !!resumeData,
        resumeData,
        inputData,
        hasController: !!state.controller,
        hasWriter: !!state.writer,
        hasStreamState: !!state.streamState,
        stateKeys: Object.keys(state).slice(0, 10), // Limit to first 10 keys
      });

      // Access dynamic data from workflow state (shared across nested workflows)
      const {
        telemetry_settings,
        tools,
        messageList,
        options,
        runId,
        streamState,
        modelSpanTracker,
        controller,
        writer,
      } = state;
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
        Object.values(tools || {})?.find((tool: any) => `id` in tool && tool.id === inputData.toolName);

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

      console.log('tool.execute', tool.execute, tool);
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

      console.log('try');
      try {
        const requireToolApproval = runtimeContext.get('__mastra_requireToolApproval');
        console.log('[DEBUG] Tool approval check:', {
          requireToolApproval,
          toolRequiresApproval: (tool as any).requireApproval,
          hasResumeData: !!resumeData,
          willEnterApprovalBlock: !!(requireToolApproval || (tool as any).requireApproval),
        });
        if (requireToolApproval || (tool as any).requireApproval) {
          if (!resumeData) {
            console.log('[DEBUG] Entering suspension for tool approval');
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
            console.log('[DEBUG] Tool approval resume:', {
              approved: resumeData.approved,
              hasController: !!controller,
              hasWriter: !!writer,
              hasStreamState: !!streamState,
            });
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
            console.log('[DEBUG] Tool approved, proceeding to execute');
          }
        }
        const toolOptions: MastraToolInvocationOptions = {
          abortSignal: options?.abortSignal,
          toolCallId: inputData.toolCallId,
          messages: messageList.get.input.aiV5.model(),
          writableStream: writer,
          // Pass current step span as parent for tool call spans
          tracingContext: { currentSpan: modelSpanTracker?.getCurrentStepSpan() },
          suspend: async (suspendPayload: any) => {
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

        console.log('[DEBUG] About to execute tool:', inputData.toolName);
        const result = await tool.execute(inputData.args, toolOptions);
        console.log('[DEBUG] Tool execution completed:', {
          toolName: inputData.toolName,
          hasResult: !!result,
          resultType: typeof result,
          result: result,
        });

        span.setAttributes({
          'stream.toolCall.result': JSON.stringify(result),
        });

        span.end();

        const returnValue = { result, ...inputData };
        console.log('[DEBUG] Returning from tool-call-step:', {
          toolName: returnValue.toolName,
          toolCallId: returnValue.toolCallId,
          hasResult: !!returnValue.result,
        });
        return returnValue;
      } catch (error) {
        console.error('[DEBUG] Tool execution error:', error);
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
