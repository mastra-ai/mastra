import { isAbortError } from '@ai-sdk/provider-utils';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MessageList } from '../../../../../agent';
import type { ExecutionProps } from '../../types';
import { AISDKV5InputStream } from './input';
import { prepareToolsAndToolChoice } from './prepare-tools';

export function executeV5({
  runId,
  model,
  providerMetadata,
  inputMessages,
  tools,
  toolChoice,
  options,
  onResult,
  doStreamSpan,
  experimental_telemetry,
}: ExecutionProps & {
  model: LanguageModelV2;
  onResult: (result: { warnings: any; request: any; rawResponse: any }) => void;
}) {
  const v5 = new AISDKV5InputStream({
    component: 'LLM',
    name: model.modelId,
  });

  const toolsAndToolChoice = prepareToolsAndToolChoice({
    tools,
    toolChoice,
    activeTools: options?.activeTools,
  });

  if (doStreamSpan && toolsAndToolChoice?.tools?.length && experimental_telemetry?.recordOutputs !== false) {
    doStreamSpan.setAttributes({
      'stream.prompt.tools': toolsAndToolChoice?.tools?.map(tool => JSON.stringify(tool)),
    });
  }

  const stream = v5.initialize({
    runId,
    onResult,
    createStream: async () => {
      const messages = MessageList.fromArray(inputMessages);

      try {
        const stream = await model.doStream({
          ...toolsAndToolChoice,
          // TODO: fix prompt type
          prompt: messages.get.all.aiV5.model() as any,
          providerOptions: providerMetadata,
          abortSignal: options?.abortSignal,
        });
        return stream as any;
      } catch (error) {
        console.error('Error creating stream', error);
        if (isAbortError(error) && options?.abortSignal?.aborted) {
          console.log('Abort error', error);
        }

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
