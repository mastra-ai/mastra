import type { LanguageModelV1, ToolSet } from 'ai';
import type { ExecutionProps } from '../../types';
import { AISDKV4InputStream } from './input';
import { prepareToolsAndToolChoice } from './prepare-tools';

export function executeV4({
  runId,
  model,
  headers,
  providerMetadata,
  providerOptions,
  inputMessages,
  tools,
  activeTools,
  toolChoice,
  onResult,
}: Omit<ExecutionProps, 'inputMessages'> & {
  model: LanguageModelV1;
  inputMessages: LanguageModelV1Prompt;
  onResult: (result: { warnings: any; request: any; rawResponse: any }) => void;
}) {
  const v4 = new AISDKV4InputStream({
    component: 'LLM',
    name: model.modelId,
  });

  const preparedTools = prepareToolsAndToolChoice({
    tools: tools as ToolSet,
    toolChoice: toolChoice,
    activeTools: activeTools,
  });

  const stream = v4.initialize({
    runId,
    onResult,
    createStream: async () => {
      try {
        const stream = await model.doStream({
          inputFormat: 'messages',
          mode: {
            type: 'regular',
            ...preparedTools,
          },
          providerMetadata: providerOptions ? { ...(providerMetadata ?? {}), ...providerOptions } : providerMetadata,
          prompt: inputMessages,
          headers,
        });

        return stream as any;
      } catch (error) {
        return {
          stream: new ReadableStream({
            start: async controller => {
              controller.enqueue({
                type: 'error',
                error,
              });
              controller.close();
            },
          }),
          warnings: [],
          request: {},
          rawResponse: {},
        };
      }
    },
  });

  return stream;
}
