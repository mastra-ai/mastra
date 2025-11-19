import type { ToolSet } from 'ai-v5';
import z from 'zod';
import type { MastraDBMessage } from '../../../memory';
import { convertMastraChunkToAISDKv5 } from '../../../stream/aisdk/v5/transform';
import type { OutputSchema } from '../../../stream/base/schema';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema, toolCallOutputSchema } from '../schema';

export function createLLMMappingStep<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>(
  { models, _internal, ...rest }: OuterLLMRun<Tools, OUTPUT>,
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

          const msg: MastraDBMessage = {
            id: toolResultMessageId || '',
            role: 'assistant',
            content: {
              format: 2,
              parts: errorResults.map(toolCallErrorResult => {
                return {
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: toolCallErrorResult.toolCallId,
                    toolName: toolCallErrorResult.toolName,
                    args: toolCallErrorResult.args,
                    result: toolCallErrorResult.error?.message ?? toolCallErrorResult.error,
                  },
                  ...(toolCallErrorResult.providerMetadata
                    ? { providerMetadata: toolCallErrorResult.providerMetadata }
                    : {}),
                };
              }),
            },
            createdAt: new Date(),
          };
          rest.messageList.add(msg, 'response');
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
        }

        const toolResultMessageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

        const toolResultMessage: MastraDBMessage = {
          id: toolResultMessageId || '',
          role: 'assistant',
          content: {
            format: 2,
            parts: inputData.map(toolCall => {
              return {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                  result: toolCall.result,
                },
                ...(toolCall.providerMetadata ? { providerMetadata: toolCall.providerMetadata } : {}),
              };
            }),
          },
          createdAt: new Date(),
        };

        rest.messageList.add(toolResultMessage, 'response');

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
