import type { ToolSet } from 'ai-v5';
import z from 'zod';
import { convertMastraChunkToAISDKv5 } from '../../../stream/aisdk/v5/transform';
import type { OutputSchema } from '../../../stream/base/schema';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

export function createLLMMappingStep<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>(
  { models, telemetry_settings, _internal, modelStreamSpan, ...rest }: OuterLLMRun<Tools, OUTPUT>,
  llmExecutionStep: any,
) {
  return createStep({
    id: 'llmExecutionMappingStep',
    inputSchema: z.array(toolCallOutputSchema),
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData, getStepResult, bail }) => {
      const initialResult = getStepResult(llmExecutionStep);

      if (inputData?.every(toolCall => toolCall?.result === undefined)) {
        const errorResults = inputData.filter(toolCall => toolCall?.error);

        const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

        if (errorResults?.length) {
          errorResults.forEach(toolCall => {
            const chunk: ChunkType = {
              type: 'tool-error',
              runId: rest.runId,
              from: ChunkFrom.AGENT,
              payload: {
                error: toolCall.error,
                args: toolCall.args,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                providerMetadata: toolCall.providerMetadata,
              },
            };
            rest.controller.enqueue(chunk);
          });

          rest.messageList.add(
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
            runId: rest.runId,
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

          rest.controller.enqueue(chunk);

          if (initialResult?.metadata?.modelVersion === 'v2') {
            await rest.options?.onChunk?.({
              chunk: convertMastraChunkToAISDKv5({
                chunk,
              }),
            } as any);
          }

          const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

          rest.messageList.add(
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
            all: rest.messageList.get.all.aiV5.model(),
            user: rest.messageList.get.input.aiV5.model(),
            nonUser: rest.messageList.get.response.aiV5.model(),
          },
        };
      }
    },
  });
}
