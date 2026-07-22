import { injectJsonInstructionIntoMessages } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { APICallError } from '@internal/ai-sdk-v5';
import type { IdGenerator, ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import { prepareJsonSchemaForOpenAIStrictMode } from '@mastra/schema-compat';
import type { StructuredOutputOptions } from '../../../agent/types';
import type { ModelMethodType } from '../../../llm/model/model.loop.types';
import { modelSupportsStructuredOutput } from '../../../llm/model/provider-registry';
import type { MastraLanguageModel, SharedProviderOptions } from '../../../llm/model/shared.types';
import type { LoopOptions } from '../../../loop/types';
import { DEFAULT_MAX_RETRY_AFTER_MS, getRetryAfterMs, waitDelay } from '../../../utils/retry-after';
import { getResponseFormat } from '../../base/schema';
import type { LanguageModelV2StreamResult, OnResult } from '../../types';
import { prepareToolsAndToolChoice } from './compat';
import type { ModelSpecVersion } from './compat';
import { AISDKV5InputStream } from './input';

type JsonPromptInjection = StructuredOutputOptions<unknown>['jsonPromptInjection'];
type ResolvedJsonPromptInjection = Exclude<JsonPromptInjection, 'auto'>;

/**
 * p-retry's own defaults, pinned explicitly so the delay it schedules between
 * model-call attempts can be computed when honoring a provider `Retry-After`.
 */
const RETRY_MIN_TIMEOUT_MS = 1_000;
const RETRY_BACKOFF_FACTOR = 2;

/**
 * Whether a failed model call will be retried. Used by both `onFailedAttempt` and
 * `shouldRetry` so a terminal error never waits out a provider delay it will not use.
 */
function isRetryableModelError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    return error.isRetryable;
  }
  return true;
}

export function resolveJsonPromptInjection(
  value: JsonPromptInjection,
  capability: boolean | undefined,
): ResolvedJsonPromptInjection {
  if (value !== 'auto') return value;
  return capability === true ? undefined : 'inline';
}

function buildJsonInstruction(schema: unknown) {
  return `Return your response as JSON matching this schema:\n\n${JSON.stringify(schema)}\n\nReturn only valid JSON. Do not include markdown or explanatory text.`;
}

function injectJsonInstructionIntoLatestUserMessage({
  messages,
  schema,
}: {
  messages: LanguageModelV2Prompt;
  schema: unknown;
}): LanguageModelV2Prompt {
  const instruction = buildJsonInstruction(schema);
  const prompt = messages.map(message => ({
    ...message,
    content: Array.isArray(message.content) ? [...message.content] : message.content,
  })) as LanguageModelV2Prompt;

  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i];
    if (message?.role !== 'user') {
      continue;
    }

    message.content = Array.isArray(message.content)
      ? [...message.content, { type: 'text', text: instruction }]
      : [
          { type: 'text', text: String(message.content ?? '') },
          { type: 'text', text: instruction },
        ];
    return prompt;
  }

  return [...prompt, { role: 'user', content: [{ type: 'text', text: instruction }] }] as LanguageModelV2Prompt;
}

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const newObj = { ...obj };
  for (const key of keys) {
    delete newObj[key];
  }
  return newObj;
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
  // V3 (AI SDK v6) and V4 (AI SDK v7) models need 'provider' type, V2 models need 'provider-defined'
  const targetVersion: ModelSpecVersion =
    model.specificationVersion === 'v3' || model.specificationVersion === 'v4' ? 'v3' : 'v2';

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
  const jsonPromptInjection = structuredOutput?.jsonPromptInjection;
  const modelRoute = `${model.provider.split('.')[0]}/${model.modelId}`;
  const resolvedJsonPromptInjection = resolveJsonPromptInjection(
    jsonPromptInjection,
    jsonPromptInjection === 'auto' ? modelSupportsStructuredOutput(modelRoute) : undefined,
  );
  const injectionMode = resolvedJsonPromptInjection === true ? 'system' : resolvedJsonPromptInjection;

  // For direct mode (no model provided for structuring agent), inject JSON schema instruction if opting out of native response format with jsonPromptInjection
  if (structuredOutputMode === 'direct' && responseFormat?.type === 'json' && injectionMode) {
    prompt =
      injectionMode === 'inline'
        ? injectJsonInstructionIntoLatestUserMessage({
            messages: inputMessages,
            schema: responseFormat.schema,
          })
        : injectJsonInstructionIntoMessages({
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
  const isOpenAIStrictMode = model.provider.startsWith('openai') && responseFormat?.type === 'json' && !injectionMode;

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
      try {
        const filteredModelSettings = omit(modelSettings || {}, ['maxRetries', 'headers']);
        const abortSignal = options?.abortSignal;

        const pRetry = await import('p-retry');
        return await pRetry.default(
          async () => {
            const fn = (methodType === 'stream' ? model.doStream : model.doGenerate).bind(model);

            // Cast needed: V2 and V3 call options are structurally compatible but typed differently
            // (e.g., tool types differ: V2 uses 'provider-defined', V3 uses 'provider')
            const streamResult = await (fn as Function)({
              ...toolsAndToolChoice,
              prompt,
              providerOptions: providerOptionsToUse,
              abortSignal,
              includeRawChunks,
              responseFormat: structuredOutputMode === 'direct' && !injectionMode ? responseFormat : undefined,
              ...filteredModelSettings,
              headers,
            });

            // We have to cast this because doStream is missing the warnings property in its return type even though it exists
            return streamResult as unknown as LanguageModelV2StreamResult;
          },
          {
            retries: modelSettings?.maxRetries ?? 2,
            signal: abortSignal,
            // Pinned to p-retry's own defaults so the backoff it schedules stays
            // unchanged while remaining computable in onFailedAttempt below.
            minTimeout: RETRY_MIN_TIMEOUT_MS,
            factor: RETRY_BACKOFF_FACTOR,
            async onFailedAttempt(context) {
              // Runs before shouldRetry, so bail on anything that will not be retried:
              // a terminal error must not wait out a provider delay it will never use.
              if (context.retriesLeft <= 0 || !isRetryableModelError(context.error)) return;

              const retryAfterMs = getRetryAfterMs(context.error);
              if (retryAfterMs === undefined) return;

              // p-retry applies its own exponential delay after this hook resolves, so
              // wait only the remainder. Total wait lands on
              // max(backoff, min(Retry-After, cap)), the same rule
              // StreamErrorRetryProcessor applies, keeping a hostile or very large
              // Retry-After from wedging the run.
              const boundedRetryAfterMs = Math.min(retryAfterMs, DEFAULT_MAX_RETRY_AFTER_MS);
              const scheduledBackoffMs = RETRY_MIN_TIMEOUT_MS * RETRY_BACKOFF_FACTOR ** (context.attemptNumber - 1);
              await waitDelay(boundedRetryAfterMs - scheduledBackoffMs, abortSignal);
            },
            shouldRetry(context) {
              return isRetryableModelError(context.error);
            },
          },
        );
      } catch (error) {
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
