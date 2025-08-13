import type { ModelMessage } from 'ai-v5';
import { createStep } from '../../workflows';
import { getRootSpan } from '../telemetry';
import type { OuterLLMRun } from '../types';
import { toolCallInputSchema, toolCallOutputSchema } from './schema';

export function createToolCallStep({ tools, model, messageList, options, telemetry_settings }: OuterLLMRun) {
  return createStep({
    id: 'toolCallStep',
    inputSchema: toolCallInputSchema,
    outputSchema: toolCallOutputSchema,
    execute: async ({ inputData }) => {
      const tool =
        tools?.[inputData.toolName] ||
        Object.values(tools || {})?.find(tool => `id` in tool && tool.id === inputData.toolName);

      if (!tool) {
        throw new Error(`Tool ${inputData.toolName} not found`);
      }

      // const initialResult = getStepResult({
      //   id: 'generateText',
      // } as any);

      // messageList.add(initialResult.messages.user, 'input');

      if (tool && 'onInputAvailable' in tool) {
        try {
          await tool?.onInputAvailable?.({
            toolCallId: inputData.toolCallId,
            input: inputData.args,
            messages: messageList.get.input.core()?.map(message => ({
              role: message.role,
              content: message.content,
            })) as ModelMessage[],
            abortSignal: options?.abortSignal,
          });
        } catch (error) {
          console.error('Error calling onInputAvailable', error);
        }
      }

      if (!tool.execute) {
        return inputData;
      }

      const { rootSpan } = getRootSpan({
        operationId: 'mastra.stream.toolCall',
        model: {
          modelId: model.modelId,
          provider: model.provider,
        },
        telemetry_settings: telemetry_settings,
      });

      const span = rootSpan.setAttributes({
        'stream.toolCall.toolName': inputData.toolName,
        'stream.toolCall.toolCallId': inputData.toolCallId,
        'stream.toolCall.args': JSON.stringify(inputData.args),
      });

      try {
        const result = await tool.execute(inputData.args, {
          abortSignal: options?.abortSignal,
          toolCallId: inputData.toolCallId,
          messages: messageList.get.input.core() as ModelMessage[],
        });

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
