import { executionSignal } from '../runtime/cancellation.ts';
import { normalizeModelFinish } from './model-protocol.ts';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import { z } from 'zod';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import type { UsageRecord } from '../contracts/processing.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { ProcessingFailure, OutputValidationFailure, providerFailure, globalFailures } from './failure.ts';
import { telemetryId } from '../observability/privacy.ts';
import type { ProcessingDiagnostic } from '../contracts/processing-diagnostic.ts';

// Types come from the installed public router, without importing its transitive SDK.
export type ModelCall = Parameters<ModelRouterLanguageModel['doStream']>[0];
export type ModelStream = Awaited<ReturnType<ModelRouterLanguageModel['doStream']>>;
export type ModelPart = ModelStream['stream'] extends ReadableStream<infer Part> ? Part : never;
export type ProviderModel = Pick<ModelRouterLanguageModel, 'doStream' | 'doGenerate'>;
export type ModelFactory = (phase: UsageRecord['phase'], questionId: string) => ProviderModel;
export const providerOptions = { openai: { reasoningEffort: 'medium' as const, serviceTier: 'default' as const } };
// Bound buffered bytes separately from tokens. This is a memory guard, not a tokenizer;
// provider-reported usage enforces the actual per-call token allowance at finish.
export const modelByteLimit = (tokens: number) => tokens * 4;
export function modelEnvelope(call: ModelCall) {
  return {
    inputBytes:
      Buffer.byteLength(
        JSON.stringify({ prompt: call.prompt, responseFormat: call.responseFormat, tools: call.tools }),
      ) + 256,
    promptBytes: Buffer.byteLength(JSON.stringify(call.prompt)),
    schemaBytes: Buffer.byteLength(JSON.stringify(call.responseFormat ?? null)),
    toolsBytes: Buffer.byteLength(JSON.stringify(call.tools ?? null)),
    messages: call.prompt.length,
    tools: call.tools?.length ?? 0,
  };
}

export function createProvider(policy: ExecutionPolicy): ProviderModel {
  if (!process.env.OPENAI_API_KEY) throw new ProcessingFailure('AUTHENTICATION_FAILURE');
  return new ModelRouterLanguageModel({ id: policy.model, api: policy.api, apiKey: process.env.OPENAI_API_KEY });
}

// Duplicate JSON object keys have no unambiguous identity/coverage meaning.
// Validate decoded syntax first, then reject duplicate keys (including escaped aliases).
function decodeStructuredJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const objects: Array<Set<string> | null> = [];
  const tokens = [...text.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:]/g)].map(match => match[0]);
  for (const [index, token] of tokens.entries()) {
    if (token === '{') objects.push(new Set());
    else if (token === '[') objects.push(null);
    else if (token === '}' || token === ']') objects.pop();
    else if (token.startsWith('"') && tokens[index + 1] === ':') {
      const keys = objects.at(-1),
        key = JSON.parse(token) as string;
      if (!keys || keys.has(key)) throw new Error('AMBIGUOUS_JSON_IDENTITY');
      keys.add(key);
    }
  }
  return value;
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
  boundary?: ProcessingDiagnostic['boundary'];
  onFinish?: (event: { turn: number }) => void;
}) {
  const { policy, store, runId, questionId, phase, provider } = options;
  const detector = phase === 'injection' || phase === 'pii';
  let turns = 0;
  let physicalAttempts = 0;
  const diagnostic = (
    category: ProcessingDiagnostic['category'],
    reason: ProcessingDiagnostic['reason'],
    origin: ProcessingDiagnostic['origin'],
    counts: Partial<ProcessingDiagnostic> = {},
  ) =>
    store.persistDiagnostic(runId, {
      ...counts,
      questionId: telemetryId(questionId)!,
      at: new Date().toISOString(),
      phase,
      boundary: options.boundary,
      origin,
      category,
      reason,
      turn: turns,
    });

  async function executeCall(callOptions: ModelCall): Promise<ModelStream> {
    const jobSignal = executionSignal(runId);
    jobSignal?.throwIfAborted();
    const signal = AbortSignal.any([
      ...(callOptions.abortSignal ? [callOptions.abortSignal] : []),
      ...(jobSignal ? [jobSignal] : []),
    ]);
    try {
      store.assertAdmission();
    } catch {
      throw new ProcessingFailure('STORAGE_FAILURE');
    }
    options.beforeCall?.();
    let state;
    try {
      state = await store.status(runId);
    } catch {
      throw new ProcessingFailure('STORAGE_FAILURE');
    }
    if (state?.run.stopReason) {
      await diagnostic('RUN_STOPPED', state.run.stopReason, 'sibling_cancelled');
      options.onFailure?.();
      throw new ProcessingFailure(state.run.stopReason);
    }
    if (++turns > options.maxTurns) {
      options.onFailure?.();
      await diagnostic('TURN_LIMIT', detector ? 'DETECTOR_FAILED' : 'BUDGET_EXHAUSTED', 'origin');
      throw new ProcessingFailure(detector ? 'DETECTOR_FAILED' : 'BUDGET_EXHAUSTED');
    }
    // Include serialized schemas/tools and prompt overhead in the input byte guard.
    const envelope = modelEnvelope(callOptions);
    if (envelope.inputBytes > modelByteLimit(policy.maxInputTokens)) {
      options.onFailure?.();
      await diagnostic('INPUT_ENVELOPE', 'TOKEN_LIMIT', 'origin', envelope);
      throw new ProcessingFailure('TOKEN_LIMIT');
    }

    let jsonSchema: z.ZodType | undefined;
    if (callOptions.responseFormat?.type === 'json' && callOptions.responseFormat.schema) {
      try {
        jsonSchema = z.fromJSONSchema(callOptions.responseFormat.schema as Parameters<typeof z.fromJSONSchema>[0]);
      } catch {
        options.onFailure?.();
        await diagnostic('MODEL_SCHEMA', 'INVALID_MODEL_OUTPUT', 'origin');
        throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
      }
    } else if (detector) {
      options.onFailure?.();
      throw new ProcessingFailure('DETECTOR_FAILED');
    }

    for (let retry = 0; ; retry++) {
      signal.throwIfAborted();
      if (
        detector &&
        options.detectorAttempts &&
        ++options.detectorAttempts.count > policy.maxDetectorAttemptsPerPayload
      ) {
        options.onFailure?.();
        throw new ProcessingFailure('DETECTOR_FAILED');
      }
      store.assertAdmission();
      const reserved = await store.reserve(runId, questionId, phase, ++physicalAttempts, policy.maxInputTokens);
      if ('failure' in reserved) {
        options.onFailure?.();
        await diagnostic('RUN_STOPPED', reserved.failure ?? 'STORAGE_FAILURE', 'sibling_cancelled', envelope);
        throw new ProcessingFailure(reserved.failure ?? 'STORAGE_FAILURE');
      }

      const reservation = reserved.record;
      options.onAttempt?.();
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let reader: ReadableStreamDefaultReader<ModelPart> | undefined;
      let observed: { inputTokens: number; outputTokens: number; reasoningTokens?: number } | undefined;
      let failureCategory: ProcessingDiagnostic['category'] = 'MODEL_STREAM';
      let schemaIssues: Pick<ProcessingDiagnostic, 'schemaInvariants' | 'schemaIssueCount'> = {};

      const collectResponse = async () => {
        store.assertAdmission();
        signal.throwIfAborted();
        const response = await provider.doStream({
          ...callOptions,
          abortSignal: controller.signal,
          maxOutputTokens: policy.maxOutputTokens,
          providerOptions: { ...callOptions.providerOptions, ...providerOptions },
        });
        reader = response.stream.getReader();
        const parts: ModelPart[] = [];
        let partCount = 0;
        let outputBytes = 0;
        let text = '';
        let finished = false;

        for (;;) {
          const next = await reader.read();
          signal.throwIfAborted();
          if (next.done) break;
          const part = next.value;
          if (++partCount > policy.maxOutputTokens * 2) throw new ProcessingFailure('TOKEN_LIMIT');
          if (part.type === 'error') throw providerFailure(part.error);
          if (part.type === 'text-delta' || part.type === 'reasoning-delta' || part.type === 'tool-input-delta')
            outputBytes += Buffer.byteLength(part.delta);
          if (part.type === 'tool-call') outputBytes += Buffer.byteLength(part.input);
          if (outputBytes > modelByteLimit(policy.maxOutputTokens)) throw new ProcessingFailure('TOKEN_LIMIT');
          if (part.type === 'text-delta') text += part.delta;
          // Reconstruct only consumer-required parts. No raw response, warnings, metadata or reasoning escapes.
          if (part.type === 'text-start' || part.type === 'text-end') parts.push({ type: part.type, id: 'text' });
          if (part.type === 'text-delta') parts.push({ type: part.type, id: 'text', delta: part.delta });
          if (part.type === 'tool-call') {
            await diagnostic('FINAL_TOOL_CALL', 'INVALID_MODEL_OUTPUT', 'downstream', envelope);
            throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
          }
          if (part.type === 'finish') {
            if (finished) throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
            finished = true;
            const finish = normalizeModelFinish(part, policy);
            observed = finish.observed;
            if (finish.limitExceeded) {
              throw new ProcessingFailure('TOKEN_LIMIT');
            }
            if (!finish.validFinish) throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
            parts.push({
              type: 'finish',
              finishReason: finish.finishReason!,
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
        if (jsonSchema) {
          let value: unknown;
          try {
            value = decodeStructuredJson(text);
          } catch {
            failureCategory = 'JSON_DECODE';
            throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
          }
          try {
            value = jsonSchema.parse(value);
          } catch {
            failureCategory = 'RESPONSE_SCHEMA';
            throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
          }
          try {
            options.validateOutput?.(value);
          } catch (error) {
            failureCategory = error instanceof OutputValidationFailure ? error.category : 'CALLBACK_SCHEMA';
            if (error instanceof OutputValidationFailure) schemaIssues = error.schemaIssues ?? {};
            throw new ProcessingFailure('INVALID_MODEL_OUTPUT');
          }
        }
        options.onFinish?.({ turn: turns });
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
        if (error.code === 'STORAGE_FAILURE') store.stopAdmission();
        options.onFailure?.();
        if (error.code === 'INVALID_MODEL_OUTPUT')
          await diagnostic(failureCategory, error.code, 'origin', { ...envelope, ...schemaIssues });
        await store.settle(reservation, observed, error.code);
        if (globalFailures.includes(error.code)) await store.stop(runId, error.code);
        signal.throwIfAborted();
        if (!detector && error.transient && retry < policy.transientRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.min(100 * 2 ** retry, 400)));
          continue;
        }
        // Safe errors have no provider cause/body/status or prompt-bearing metadata for native log paths.
        throw new ProcessingFailure(error.code);
      } finally {
        clearTimeout(timer);
        controller.abort();
        signal.removeEventListener('abort', abort);
        void reader?.cancel().catch(() => {});
      }
    }
  }
  async function call(callOptions: ModelCall) {
    const release = store.trackWork();
    try {
      return await executeCall(callOptions);
    } finally {
      release();
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
