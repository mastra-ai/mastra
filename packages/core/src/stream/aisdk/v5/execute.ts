import { injectJsonInstructionIntoMessages } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2Prompt, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import type { IdGenerator, ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import { prepareJsonSchemaForOpenAIStrictMode } from '@mastra/schema-compat';
import type { StructuredOutputOptions } from '../../../agent/types';
import type { ModelMethodType } from '../../../llm/model/model.loop.types';
import type { MastraLanguageModel, SharedProviderOptions } from '../../../llm/model/shared.types';
import {
  createTimeoutAbortSignal,
  getAbortReason,
  isMastraTimeoutError,
  raceAgainstAbort,
} from '../../../loop/timeout';
import type { LoopOptions } from '../../../loop/types';
import { getResponseFormat } from '../../base/schema';
import type { LanguageModelV2StreamResult, OnResult } from '../../types';
import { prepareToolsAndToolChoice } from './compat';
import type { ModelSpecVersion } from './compat';
import { AISDKV5InputStream } from './input';

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const newObj = { ...obj };
  for (const key of keys) {
    delete newObj[key];
  }
  return newObj;
}

/**
 * Keeps the step timeout alive until upstream tokens are drained or cancelled.
 * Without this, `timeoutSignal.cleanup()` runs as soon as `doStream()` resolves and `stepMs`
 * would only bound stream creation, not mid-stream stalls.
 *
 * Uses `timeoutPromise` in a race with upstream reads so `MastraTimeoutError` is surfaced
 * (reader.cancel surfaces Abort-like errors instead).
 */
function wrapStreamUntilStepTimeoutCleanup(
  result: LanguageModelV2StreamResult,
  timeoutBundle: ReturnType<typeof createTimeoutAbortSignal>,
): LanguageModelV2StreamResult {
  const upstream = result.stream;
  let reader: ReadableStreamDefaultReader<LanguageModelV2StreamPart> | undefined;
  let cleaned = false;
  const signal = timeoutBundle.signal;
  const timeoutPromise = timeoutBundle.timeoutPromise;

  const cleanupOnce = () => {
    if (cleaned) return;
    cleaned = true;
    signal?.removeEventListener('abort', onAbortUpstream);
    timeoutBundle.cleanup();
  };

  const onAbortUpstream = () => {
    const reason = signal ? getAbortReason(signal) : undefined;
    // Step timeout rejects `timeoutPromise` for Promise.race; canceling here would make many
    // upstream reads resolve `{ done: true }` before MastraTimeoutError reaches the wrapper.
    if (isMastraTimeoutError(reason)) {
      return;
    }
    reader?.cancel(reason).catch(() => {});
  };

  if (signal) {
    signal.addEventListener('abort', onAbortUpstream);
  }

  const readWithStepDeadline = async (): Promise<ReadableStreamReadResult<LanguageModelV2StreamPart>> => {
    const r = reader!;
    if (timeoutPromise === undefined) {
      return r.read();
    }
    try {
      return await Promise.race([r.read(), timeoutPromise]);
    } catch (raceErr) {
      if (isMastraTimeoutError(raceErr)) {
        await r.cancel(raceErr).catch(() => {});
        throw raceErr;
      }
      throw raceErr;
    }
  };

  return {
    ...result,
    stream: new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        reader = upstream.getReader();
        try {
          while (true) {
            if (signal?.aborted) {
              cleanupOnce();
              controller.error(getAbortReason(signal));
              return;
            }

            let readChunk: ReadableStreamReadResult<LanguageModelV2StreamPart>;

            try {
              readChunk = await readWithStepDeadline();
            } catch (e) {
              cleanupOnce();
              if (isMastraTimeoutError(e)) {
                controller.error(e);
                return;
              }
              if (signal?.aborted && isMastraTimeoutError(getAbortReason(signal))) {
                controller.error(getAbortReason(signal));
                return;
              }
              controller.error(e);
              return;
            }

            const { done, value } = readChunk;

            if (done) {
              cleanupOnce();
              controller.close();
              return;
            }

            if (signal?.aborted && isMastraTimeoutError(getAbortReason(signal))) {
              cleanupOnce();
              controller.error(getAbortReason(signal));
              return;
            }

            controller.enqueue(value);
          }
        } finally {
          try {
            reader.releaseLock();
          } catch {
            //
          }
        }
      },

      cancel(reason) {
        cleanupOnce();
        if (reader) {
          const r = reader;
          reader = undefined;
          return r.cancel(reason);
        }
        return upstream.cancel(reason);
      },
    }),
  };
}

type ExecutionProps<OUTPUT = undefined> = {
  runId: string;
  model: MastraLanguageModel;
  providerOptions?: SharedProviderOptions;
  inputMessages: LanguageModelV2Prompt;
  tools?: ToolSet;
  toolChoice?: ToolChoice<ToolSet>;
  activeTools?: string[];
  options?: {
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
  generateId?: IdGenerator;
};

export function execute<OUTPUT = undefined>({
  runId,
  model,
  providerOptions,
  inputMessages,
  tools,
  toolChoice,
  activeTools,
  options,
  onResult,
  includeRawChunks,
  modelSettings,
  structuredOutput,
  headers,
  shouldThrowError,
  methodType,
  generateId,
}: ExecutionProps<OUTPUT>) {
  const v5 = new AISDKV5InputStream({
    component: 'LLM',
    name: model.modelId,
    generateId,
  });

  // Determine target version based on model's specificationVersion
  // V3 models (AI SDK v6) need 'provider' type, V2 models need 'provider-defined'
  const targetVersion: ModelSpecVersion = model.specificationVersion === 'v3' ? 'v3' : 'v2';

  const toolsAndToolChoice = prepareToolsAndToolChoice({
    tools,
    toolChoice,
    activeTools,
    targetVersion,
  });

  const structuredOutputMode = structuredOutput?.schema
    ? structuredOutput?.model
      ? 'processor'
      : 'direct'
    : undefined;

  const responseFormat = structuredOutput?.schema
    ? getResponseFormat(structuredOutput?.schema, {
        model: {
          provider: model.provider,
          modelId: model.modelId,
          supportsStructuredOutputs: true,
        },
      })
    : undefined;

  let prompt = inputMessages;

  // For direct mode (no model provided for structuring agent), inject JSON schema instruction if opting out of native response format with jsonPromptInjection
  if (structuredOutputMode === 'direct' && responseFormat?.type === 'json' && structuredOutput?.jsonPromptInjection) {
    prompt = injectJsonInstructionIntoMessages({
      messages: inputMessages,
      schema: responseFormat.schema,
    });
  }

  // For processor mode without agent reuse, inject a custom prompt to inform the main agent
  // about the structured output schema that the structuring agent will use.
  if (
    structuredOutputMode === 'processor' &&
    responseFormat?.type === 'json' &&
    responseFormat?.schema &&
    !structuredOutput?.useAgent
  ) {
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
  const isOpenAIStrictMode =
    model.provider.startsWith('openai') && responseFormat?.type === 'json' && !structuredOutput?.jsonPromptInjection;

  // For OpenAI strict mode, ensure all properties are required and additionalProperties: false
  if (isOpenAIStrictMode && responseFormat?.schema) {
    responseFormat.schema = prepareJsonSchemaForOpenAIStrictMode(responseFormat.schema);
  }

  const providerOptionsToUse: SharedProviderOptions | undefined = isOpenAIStrictMode
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
      let timeoutSignal: ReturnType<typeof createTimeoutAbortSignal> | undefined;
      try {
        const filteredModelSettings = omit(modelSettings || {}, ['maxRetries', 'headers', 'timeout']);
        timeoutSignal = createTimeoutAbortSignal({
          parentSignal: options?.abortSignal,
          timeoutMs: modelSettings?.timeout?.stepMs,
          timeoutType: 'step',
        });
        const abortSignal = timeoutSignal.signal;

        const pRetry = await import('p-retry');
        try {
          const streamResult = await pRetry.default(
            async () => {
              const fn = (methodType === 'stream' ? model.doStream : model.doGenerate).bind(model);

              // Cast needed: V2 and V3 call options are structurally compatible but typed differently
              // (e.g., tool types differ: V2 uses 'provider-defined', V3 uses 'provider')
              const streamResultInner = await raceAgainstAbort(
                (fn as Function)({
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
                }),
                abortSignal,
              );

              // We have to cast this because doStream is missing the warnings property in its return type even though it exists
              return streamResultInner as unknown as LanguageModelV2StreamResult;
            },
            {
              retries: modelSettings?.maxRetries ?? 2,
              signal: abortSignal,
              shouldRetry(context) {
                if (isMastraTimeoutError(context.error)) {
                  return false;
                }
                if (APICallError.isInstance(context.error)) {
                  return context.error.isRetryable;
                }
                return true;
              },
            },
          );

          const result = streamResult as unknown as LanguageModelV2StreamResult;
          const deferStreamCleanup = methodType === 'stream' && modelSettings?.timeout?.stepMs !== undefined;

          if (!deferStreamCleanup) {
            timeoutSignal.cleanup();
          }

          if (deferStreamCleanup) {
            return wrapStreamUntilStepTimeoutCleanup(result, timeoutSignal);
          }

          return result;
        } catch (retryError) {
          timeoutSignal.cleanup();
          throw retryError;
        }
      } catch (error) {
        timeoutSignal?.cleanup();
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
