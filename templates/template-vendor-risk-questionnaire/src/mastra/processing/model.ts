import { ModelRouterLanguageModel } from '@mastra/core/llm';
import { z } from 'zod';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import type { UsageRecord } from '../contracts/processing.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { ProcessingFailure, providerFailure, globalFailures } from './failure.ts';

// Types come from the installed public router, without importing its transitive SDK.
export type ModelCall = Parameters<ModelRouterLanguageModel['doStream']>[0];
export type ModelStream = Awaited<ReturnType<ModelRouterLanguageModel['doStream']>>;
export type ModelPart = ModelStream['stream'] extends ReadableStream<infer Part> ? Part : never;
export type ProviderModel = Pick<ModelRouterLanguageModel, 'doStream' | 'doGenerate'>;
export type ModelFactory = (phase: UsageRecord['phase'], questionId: string) => ProviderModel;
export const providerOptions = { openai: { reasoningEffort: 'medium' as const, serviceTier: 'default' as const } };

export function createProvider(policy: ExecutionPolicy): ProviderModel {
  if (!process.env.OPENAI_API_KEY) throw new ProcessingFailure('AUTHENTICATION_FAILURE');
  return new ModelRouterLanguageModel({ id: policy.model, api: policy.api, apiKey: process.env.OPENAI_API_KEY });
}

export function boundedModel(options: {
  runId: string;
  questionId: string;
  phase: UsageRecord['phase'];
  policy: ExecutionPolicy;
  store: ProcessingStore;
  provider: ProviderModel;
  maxTurns: number;
  detectorAttempts?: { count: number };
  onAttempt?: () => void;
  onFailure?: () => void;
  beforeCall?: () => void;
  validateOutput?: (value: unknown) => unknown;
  validateToolInput?: (input: string) => Promise<void>;
}) {
  const { policy, store, runId, questionId, phase, provider } = options;
  const detector = phase === 'injection' || phase === 'pii';
  let turns = 0;
  let physicalAttempts = 0;

  async function call(callOptions: ModelCall): Promise<ModelStream> {
    options.beforeCall?.();
    if (++turns > options.maxTurns) {
      options.onFailure?.();
      throw new ProcessingFailure(detector ? 'DETECTOR_FAILED' : 'BUDGET_EXHAUSTED');
    }
    // A byte-based upper bound includes serialized schemas/tools and prompt overhead.
    const inputBytes =
      Buffer.byteLength(
        JSON.stringify({
          prompt: callOptions.prompt,
          responseFormat: callOptions.responseFormat,
          tools: callOptions.tools,
        }),
      ) + 256;
    if (inputBytes > policy.maxInputTokens) {
      options.onFailure?.();
      await store.stop(runId, 'TOKEN_LIMIT');
      throw new ProcessingFailure('TOKEN_LIMIT');
    }

    let jsonSchema: z.ZodType | undefined;
    if (callOptions.responseFormat?.type === 'json' && callOptions.responseFormat.schema) {
      try {
        jsonSchema = z.fromJSONSchema(callOptions.responseFormat.schema as Parameters<typeof z.fromJSONSchema>[0]);
      } catch {
        options.onFailure?.();
        throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
      }
    } else if (detector) {
      options.onFailure?.();
      throw new ProcessingFailure('DETECTOR_FAILED');
    }

    for (let retry = 0; ; retry++) {
      if (
        detector &&
        options.detectorAttempts &&
        ++options.detectorAttempts.count > policy.maxDetectorAttemptsPerPayload
      ) {
        options.onFailure?.();
        throw new ProcessingFailure('DETECTOR_FAILED');
      }
      const reserved = await store.reserve(runId, questionId, phase, ++physicalAttempts, policy.maxInputTokens);
      if ('failure' in reserved) {
        options.onFailure?.();
        throw new ProcessingFailure(reserved.failure ?? 'STORAGE_FAILURE');
      }

      const reservation = reserved.record;
      options.onAttempt?.();
      const controller = new AbortController();
      const abort = () => controller.abort();
      callOptions.abortSignal?.addEventListener('abort', abort, { once: true });
      if (callOptions.abortSignal?.aborted) abort();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let reader: ReadableStreamDefaultReader<ModelPart> | undefined;
      let observed: { inputTokens: number; outputTokens: number; reasoningTokens?: number } | undefined;

      const collectResponse = async () => {
        const response = await provider.doStream({
          ...callOptions,
          abortSignal: controller.signal,
          maxOutputTokens: policy.maxOutputTokens,
          providerOptions: { ...callOptions.providerOptions, ...providerOptions },
        });
        reader = response.stream.getReader();
        const parts: ModelPart[] = [];
        let partCount = 0;
        let toolCount = 0;
        let outputBytes = 0;
        let text = '';
        let finished = false;
        let hasTools = false;

        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          const part = next.value;
          if (++partCount > policy.maxOutputTokens * 2) throw new ProcessingFailure('TOKEN_LIMIT');
          if (part.type === 'error') throw providerFailure(part.error);
          if (part.type === 'text-delta' || part.type === 'reasoning-delta' || part.type === 'tool-input-delta')
            outputBytes += Buffer.byteLength(part.delta);
          if (part.type === 'tool-call') outputBytes += Buffer.byteLength(part.input);
          if (outputBytes > policy.maxOutputTokens) throw new ProcessingFailure('TOKEN_LIMIT');
          if (part.type === 'text-delta') text += part.delta;
          // Reconstruct only consumer-required parts. No raw response, warnings, metadata or reasoning escapes.
          if (part.type === 'text-start' || part.type === 'text-end') parts.push({ type: part.type, id: 'text' });
          if (part.type === 'text-delta') parts.push({ type: part.type, id: 'text', delta: part.delta });
          if (part.type === 'tool-call') {
            if (detector || !['evidence_search', 'evidence_read'].includes(part.toolName) || part.providerExecuted)
              throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
            await options.validateToolInput?.(part.input);
            hasTools = true;
            parts.push({
              type: 'tool-call',
              toolCallId: `vrq-tool-${turns}-${++toolCount}`,
              toolName: part.toolName,
              input: part.input,
            });
          }
          if (part.type === 'finish') {
            if (finished) throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
            finished = true;
            const reportedUsage = part.usage;
            if (
              reportedUsage.inputTokens !== undefined &&
              reportedUsage.outputTokens !== undefined &&
              [
                reportedUsage.inputTokens,
                reportedUsage.outputTokens,
                reportedUsage.reasoningTokens,
                reportedUsage.totalTokens,
              ].every(n => n === undefined || (Number.isSafeInteger(n) && n >= 0))
            ) {
              // totalTokens can include reasoning beyond outputTokens. Charge that larger total conservatively.
              const outputTokens = Math.max(
                reportedUsage.outputTokens,
                reportedUsage.reasoningTokens ?? 0,
                reportedUsage.totalTokens === undefined ? 0 : reportedUsage.totalTokens - reportedUsage.inputTokens,
              );
              observed = {
                inputTokens: reportedUsage.inputTokens,
                outputTokens,
                reasoningTokens: reportedUsage.reasoningTokens,
              };
              if (observed.inputTokens > policy.maxInputTokens || outputTokens > policy.maxOutputTokens) {
                await store.stop(runId, 'TOKEN_LIMIT');
                throw new ProcessingFailure('TOKEN_LIMIT');
              }
            }
            if (
              part.finishReason === 'length' ||
              part.finishReason === 'error' ||
              part.finishReason === 'content-filter'
            )
              throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
            parts.push({
              type: 'finish',
              finishReason: part.finishReason,
              usage: {
                inputTokens: observed?.inputTokens,
                outputTokens: observed?.outputTokens,
                totalTokens: observed ? observed.inputTokens + observed.outputTokens : undefined,
                reasoningTokens: observed?.reasoningTokens,
              },
            });
          }
        }
        if (!finished) throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
        if (jsonSchema && !hasTools) {
          try {
            const value = jsonSchema.parse(JSON.parse(text));
            options.validateOutput?.(value);
          } catch {
            throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
          }
        }
        if (hasTools && text.trim()) throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
        return {
          stream: new ReadableStream<ModelPart>({
            start(streamController) {
              for (const part of parts) streamController.enqueue(part);
              streamController.close();
            },
          }),
        };
      };
      try {
        const runLimited = reserved.remainingRunMs <= policy.callTimeoutMs;
        const result = await Promise.race([
          collectResponse(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => {
                controller.abort();
                reject(new ProcessingFailure(runLimited ? 'TIME_LIMIT' : 'CALL_TIMEOUT', !runLimited));
              },
              Math.min(policy.callTimeoutMs, reserved.remainingRunMs),
            );
          }),
        ]);
        await store.settle(reservation, observed, null);
        return result;
      } catch (rawError) {
        const error = providerFailure(rawError);
        options.onFailure?.();
        await store.settle(reservation, observed, error.code);
        if (globalFailures.includes(error.code)) await store.stop(runId, error.code);
        if (!detector && error.transient && retry < policy.transientRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.min(100 * 2 ** retry, 400)));
          continue;
        }
        // Safe errors have no provider cause/body/status or prompt-bearing metadata for native log paths.
        throw new ProcessingFailure(error.code);
      } finally {
        clearTimeout(timer);
        controller.abort();
        callOptions.abortSignal?.removeEventListener('abort', abort);
        void reader?.cancel().catch(() => {});
      }
    }
  }
  // Mastra recognizes its public router class as a stream-returning model.
  // A plain V2-shaped object would instead be adapted as an SDK generate result.
  class BoundedRouter extends ModelRouterLanguageModel {
    override readonly supportedUrls = Promise.resolve({});
    override doStream = call;
    override doGenerate = call;
  }
  return new BoundedRouter({ id: policy.model, api: policy.api });
}
