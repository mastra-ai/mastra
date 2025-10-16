import { injectJsonInstructionIntoMessages, isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Prompt, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { Span } from '@opentelemetry/api';
import type { CallSettings, TelemetrySettings, ToolChoice, ToolSet } from 'ai-v5';
import pRetry from 'p-retry';
import type { StructuredOutputOptions } from '../../../agent/types';
import { getResponseFormat } from '../../base/schema';
import type { OutputSchema } from '../../base/schema';
import type { LanguageModelV2StreamResult, OnResult } from '../../types';
import { prepareToolsAndToolChoice } from './compat';
import { AISDKV5InputStream } from './input';

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const newObj = { ...obj };
  for (const key of keys) {
    delete newObj[key];
  }
  return newObj;
}

type ExecutionProps<OUTPUT extends OutputSchema = undefined> = {
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
  modelSettings?: Omit<CallSettings, 'abortSignal'> & {
    /**
     * @deprecated Use top-level `abortSignal` instead.
     */
    abortSignal?: AbortSignal;
  };
  onResult: OnResult;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  /**
  Additional HTTP headers to be sent with the request.
  Only applicable for HTTP-based providers.
  */
  headers?: Record<string, string | undefined>;
  shouldThrowError?: boolean;
};

let hasLoggedModelSettingsAbortSignalDeprecation = false;

export function execute<OUTPUT extends OutputSchema = undefined>({
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
  structuredOutput,
  headers,
  shouldThrowError,
}: ExecutionProps<OUTPUT>) {
  // Deprecation warning for modelSettings.abortSignal
  if (modelSettings?.abortSignal && !hasLoggedModelSettingsAbortSignalDeprecation) {
    console.warn(
      '[Deprecation Warning] Using `modelSettings.abortSignal` is deprecated. ' +
        'Please use top-level `abortSignal` instead. ' +
        'The `modelSettings.abortSignal` option will be removed in a future version.',
    );
    hasLoggedModelSettingsAbortSignalDeprecation = true;
  }

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

  const structuredOutputMode = structuredOutput?.schema
    ? structuredOutput?.model
      ? 'processor'
      : 'direct'
    : undefined;

  const responseFormat = structuredOutput?.schema ? getResponseFormat(structuredOutput?.schema) : undefined;

  let prompt = inputMessages;
  if (structuredOutputMode === 'direct' && responseFormat?.type === 'json' && structuredOutput?.jsonPromptInjection) {
    prompt = injectJsonInstructionIntoMessages({
      messages: inputMessages,
      schema: responseFormat.schema,
    });
  }

  const providerOptionsToUse =
    model.provider === 'openai' && responseFormat?.type === 'json' && !structuredOutput?.jsonPromptInjection
      ? {
          ...(providerOptions ?? {}),
          openai: {
            strictJsonSchema: true,
            ...(providerOptions?.openai ?? {}),
          },
        }
      : providerOptions;

  const stream = v5.initialize({
    runId,
    onResult,
    createStream: async () => {
      try {
        const filteredModelSettings = omit(modelSettings || {}, ['maxRetries', 'headers', 'abortSignal']);
        const abortSignal = options?.abortSignal || modelSettings?.abortSignal;

        return await pRetry(
          async () => {
            const streamResult = await model.doStream({
              ...toolsAndToolChoice,
              prompt,
              providerOptions: providerOptionsToUse,
              abortSignal,
              includeRawChunks,
              responseFormat:
                structuredOutputMode === 'direct' && !structuredOutput?.jsonPromptInjection
                  ? responseFormat
                  : undefined,
              ...filteredModelSettings,
              headers,
            });

            // We have to cast this because doStream is missing the warnings property in its return type even though it exists
            return streamResult as unknown as LanguageModelV2StreamResult;
          },
          {
            retries: modelSettings?.maxRetries ?? 2,
            signal: abortSignal,
          },
        );
      } catch (error) {
        console.error('Error creating stream', error);
        const abortSignal = options?.abortSignal || modelSettings?.abortSignal;
        if (isAbortError(error) && abortSignal?.aborted) {
          console.error('Abort error', error);
        }

        if (shouldThrowError) {
          throw error;
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
