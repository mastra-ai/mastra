import { injectJsonInstructionIntoMessages, isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Prompt, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import { APICallError } from 'ai-v5';
import type { ToolChoice, ToolSet } from 'ai-v5';
import type { StructuredOutputOptions } from '../../../agent/types';
import type { ModelMethodType } from '../../../llm/model/model.loop.types';
import type { LoopOptions } from '../../../loop/types';
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
  includeRawChunks?: boolean;
  modelSettings?: LoopOptions['modelSettings'];
  onResult: OnResult;
  structuredOutput?: StructuredOutputOptions<OUTPUT>;
  /**
  Additional HTTP headers to be sent with the request.
  Only applicable for HTTP-based providers.
  */
  headers?: Record<string, string | undefined>;
  shouldThrowError?: boolean;
  methodType: ModelMethodType;
};

export function execute<OUTPUT extends OutputSchema = undefined>({
  runId,
  model,
  providerOptions,
  inputMessages,
  tools,
  toolChoice,
  options,
  onResult,
  includeRawChunks,
  modelSettings,
  structuredOutput,
  headers,
  shouldThrowError,
  methodType,
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

  const structuredOutputMode = structuredOutput?.schema
    ? structuredOutput?.model
      ? 'processor'
      : 'direct'
    : undefined;

  const responseFormat = structuredOutput?.schema ? getResponseFormat(structuredOutput?.schema) : undefined;

  let prompt = inputMessages;

  // For direct mode (no model provided for structuring agent), inject JSON schema instruction if opting out of native response format with jsonPromptInjection
  if (structuredOutputMode === 'direct' && responseFormat?.type === 'json' && structuredOutput?.jsonPromptInjection) {
    prompt = injectJsonInstructionIntoMessages({
      messages: inputMessages,
      schema: responseFormat.schema,
    });
  }

  // For processor mode (model provided for structuring agent), inject a custom prompt to inform the main agent about the structured output schema that the structuring agent will use
  if (structuredOutputMode === 'processor' && responseFormat?.type === 'json' && responseFormat?.schema) {
    // Add a system message to inform the main agent about what data it needs to generate
    prompt = injectJsonInstructionIntoMessages({
      messages: inputMessages,
      schema: responseFormat.schema,
      schemaPrefix: `Your response will be processed by another agent to extract structured data. Please ensure your response contains comprehensive information for all the following fields that will be extracted:\n`,
      schemaSuffix: `\n\nYou don't need to format your response as JSON unless the user asks you to. Just ensure your natural language response includes relevant information for each field in the schema above.`,
    });
  }

  /**
   * Enable OpenAI's strict JSON schema mode to ensure schema compliance.
   * Without this, OpenAI may omit required fields or violate type constraints.
   * @see https://platform.openai.com/docs/guides/structured-outputs#structured-outputs-vs-json-mode
   * @see https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data#accessing-reasoning
   */
  const providerOptionsToUse =
    model.provider.startsWith('openai') && responseFormat?.type === 'json' && !structuredOutput?.jsonPromptInjection
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
        const filteredModelSettings = omit(modelSettings || {}, ['maxRetries', 'headers']);
        const abortSignal = options?.abortSignal;

        const pRetry = await import('p-retry');
        return await pRetry.default(
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
            shouldRetry(context) {
              if (APICallError.isInstance(context.error)) {
                return context.error.isRetryable;
              }
              return true;
            },
          },
        );
      } catch (error) {
        const abortSignal = options?.abortSignal;
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
