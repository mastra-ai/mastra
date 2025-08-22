import { isAbortError } from '@ai-sdk/provider-utils';
import type { LanguageModelV2, LanguageModelV2Prompt, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type { CallSettings, TelemetrySettings, ToolChoice, ToolSet } from 'ai-v5';
import { getResponseFormat } from '../../base/schema';
import type { OutputSchema } from '../../base/schema';
import { prepareToolsAndToolChoice } from './compat';
import { AISDKV5InputStream } from './input';

type ExecutionProps<OUTPUT extends OutputSchema | undefined = undefined> = {
  runId: string;
  model: LanguageModelV2;
  providerOptions?: SharedV2ProviderOptions;
  inputMessages: LanguageModelV2Prompt;
  tools?: ToolSet;
  toolChoice?: ToolChoice<ToolSet>;
  options?: {
    activeTools?: string[];
    abortSignal?: AbortSignal;
  };
  modelStreamSpan: Span;
  telemetry_settings?: TelemetrySettings;
  includeRawChunks?: boolean;
  modelSettings?: CallSettings;
  onResult: (result: { warnings: any; request: any; rawResponse: any }) => void;
  output?: OUTPUT;
  /**
  Additional HTTP headers to be sent with the request.
  Only applicable for HTTP-based providers.
  */
  headers?: Record<string, string | undefined>;
};

export function execute<OUTPUT extends OutputSchema | undefined = undefined>({
  runId,
  model,
  providerOptions,
  inputMessages,
  tools,
  toolChoice,
  options,
  onResult,
  modelStreamSpan,
  telemetry_settings,
  includeRawChunks,
  modelSettings,
  output,
  headers,
}: ExecutionProps<OUTPUT>) {
  const v5 = new AISDKV5InputStream({
    component: 'LLM',
    name: model.modelId,
  });

  const toolsAndToolChoice = prepareToolsAndToolChoice({
    tools,
    toolChoice,
    activeTools: options?.activeTools,
  });

  if (modelStreamSpan && toolsAndToolChoice?.tools?.length && telemetry_settings?.recordOutputs !== false) {
    modelStreamSpan.setAttributes({
      'stream.prompt.tools': toolsAndToolChoice?.tools?.map(tool => JSON.stringify(tool)),
    });
  }

  const stream = v5.initialize({
    runId,
    onResult,
    createStream: async () => {
      try {
        const stream = await model.doStream({
          ...toolsAndToolChoice,
          prompt: inputMessages,
          providerOptions,
          abortSignal: options?.abortSignal,
          includeRawChunks,
          responseFormat: output ? getResponseFormat(output) : undefined,
          ...(modelSettings ?? {}),
          headers,
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
                error: {
                  message: error instanceof Error ? error.message : JSON.stringify(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
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
