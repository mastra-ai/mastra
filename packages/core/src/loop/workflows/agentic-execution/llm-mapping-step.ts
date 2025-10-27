import type { ToolSet } from 'ai-v5';
import z from 'zod';
import { convertMastraChunkToAISDKv5 } from '../../../stream/aisdk/v5/transform';
import type { OutputSchema } from '../../../stream/base/schema';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

interface CreateLLMMappingStepOptions {
  telemetry_settings: any;
}

export function createLLMMappingStep<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>(
  { telemetry_settings }: CreateLLMMappingStepOptions,
  llmExecutionStep: any,
) {
  return createStep({
    id: 'llmExecutionMappingStep',
    inputSchema: z.array(toolCallOutputSchema),
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, getStepResult, bail, state, runtimeContext }) => {
      // Access dynamic data from workflow state (shared across nested workflows)
      const { messageList, options, runId, experimental_generateMessageId, controller, _internal } = state;

      const initialResult = getStepResult(llmExecutionStep);

      if (inputData?.every(toolCall => toolCall?.result === undefined)) {
        const errorResults = inputData.filter(toolCall => toolCall?.error);

        const toolResultMessageId = experimental_generateMessageId?.() || _internal?.generateId?.();

        if (errorResults?.length) {
          errorResults.forEach(toolCall => {
            const chunk: ChunkType = {
              type: 'tool-error',
              runId,
              from: ChunkFrom.AGENT,
              payload: {
                error: toolCall.error,
                args: toolCall.args,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                providerMetadata: toolCall.providerMetadata,
              },
            };
            controller.enqueue(chunk);
          });

          messageList.add(
            {
              id: toolResultMessageId,
              role: 'tool',
              content: errorResults.map(toolCall => {
                return {
                  type: 'tool-result',
                  args: toolCall.args,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: {
                    tool_execution_error: toolCall.error?.message ?? toolCall.error,
                  },
                };
              }),
            },
            'response',
          );
        }

        initialResult.stepResult.isContinued = false;
        return bail(initialResult);
      }

      if (inputData?.length) {
        for (const toolCall of inputData) {
          const chunk: ChunkType = {
            type: 'tool-result',
            runId,
            from: ChunkFrom.AGENT,
            payload: {
              args: toolCall.args,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: toolCall.result,
              providerMetadata: toolCall.providerMetadata,
              providerExecuted: toolCall.providerExecuted,
            },
          };

          controller.enqueue(chunk);

          if (initialResult?.metadata?.modelVersion === 'v2') {
            await options?.onChunk?.({
              chunk: convertMastraChunkToAISDKv5({
                chunk,
              }),
            } as any);
          }

          const toolResultMessageId = experimental_generateMessageId?.() || _internal?.generateId?.();

          messageList.add(
            {
              id: toolResultMessageId,
              role: 'tool',
              content: inputData.map(toolCall => {
                return {
                  type: 'tool-result',
                  args: toolCall.args,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: toolCall.result,
                };
              }),
            },
            'response',
          );
        }

        return {
          ...initialResult,
          messages: {
            all: messageList.get.all.aiV5.model(),
            user: messageList.get.input.aiV5.model(),
            nonUser: messageList.get.response.aiV5.model(),
          },
        };
      }
    },
  });
}
