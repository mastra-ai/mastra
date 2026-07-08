import type { MastraDBMessage } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';

import type { Memory } from '../..';
import { OBSERVATIONAL_MEMORY_DEFAULTS } from './constants';
import { applyExtractorHooks } from './extracted-values';
import type { ExtractionFailure } from './extracted-values';
import type { Extractor } from './extractor';
import type { ModelByInputTokens } from './model-by-input-tokens';
import { ObserverRunner } from './observer-runner';
import { TokenCounter } from './token-counter';
import type { ObservationalMemoryModel, ResolvedObservationConfig } from './types';

/** A concrete model config — token-based model routing is not supported for one-shot summarization. */
export type SummarizeModel = Exclude<ObservationalMemoryModel, ModelByInputTokens>;

/** Defaults for how `Memory.summarizeThread()` loads a thread's messages from storage. */
export const SUMMARIZE_THREAD_DEFAULTS = {
  /** Stop loading older messages once the collected messages exceed this estimated token count. */
  maxInputTokens: 1_000_000,
  /** Number of messages fetched per storage page while paginating backwards from the newest message. */
  pageSize: 100,
} as const;

export interface SummarizeConversationOptions {
  /** Model that runs the summarization (e.g. a router string like `'openai/gpt-4.1-mini'`). */
  model: SummarizeModel;
  /** The conversation to summarize. */
  messages: MastraDBMessage[];
  /** Extra guidance appended to the summarizer's system prompt (e.g. what to focus on, audience). */
  instructions?: string;
  /** Extractors to run over the conversation. Structured (with a schema) or inline. `onExtracted` hooks fire. */
  extract?: Extractor<any>[];
  /** Thread the conversation belongs to. Defaults to the first `threadId` found on `messages`. Passed to extractor contexts. */
  threadId?: string;
  /** Resource (user) the conversation belongs to. Defaults to the first `resourceId` found on `messages`. Passed to extractor contexts. */
  resourceId?: string;
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
  abortSignal?: AbortSignal;
  /** Memory instance forwarded to extractor contexts (set automatically by `Memory.summarizeThread()`). */
  memory?: Memory;
  /** Mastra instance for custom gateway model resolution (set automatically by `Memory.summarizeThread()`). */
  mastra?: Mastra;
}

export interface SummarizeConversationResult {
  /** The distilled observations produced from the conversation (dense bullet form). */
  summary: string;
  /** Values produced by `extract` extractors, keyed by extractor slug (after `onExtracted` hooks ran). */
  extracted: Record<string, unknown>;
  /** Extractors that failed to produce a valid value, with the reason. */
  extractionFailures?: ExtractionFailure[];
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

/**
 * Summarize a conversation in one shot, without Observational Memory attached to an agent.
 *
 * Reuses Observational Memory's Observer plumbing — the same distillation prompt, output
 * parsing, retry handling, and extractor pipeline — as a standalone call over the messages
 * you pass in. Nothing is read from or written to storage: the summary and extracted values
 * are returned to you (and to each extractor's `onExtracted` hook), so you decide where they
 * go.
 *
 * Use this when a session ends and you want a summary or structured extraction of the whole
 * conversation — for example a voice call at hang-up. If Observational Memory is configured
 * on a `Memory` instance and you want to summarize one of its threads, use
 * `memory.summarizeThread()` instead, which loads the messages for you.
 *
 * @example
 * ```ts
 * import { summarizeConversation, Extractor } from '@mastra/memory';
 * import { z } from 'zod';
 *
 * const result = await summarizeConversation({
 *   model: 'openai/gpt-4.1-mini',
 *   messages,
 *   instructions: 'Summarize this voicemail call for the business owner.',
 *   extract: [
 *     new Extractor({
 *       name: 'call-summary',
 *       instructions: 'Return a concise summary of the call.',
 *       schema: z.object({
 *         summary: z.string(),
 *         sentiment: z.enum(['positive', 'neutral', 'negative']),
 *       }),
 *       metadataKeyPath: false,
 *     }),
 *   ],
 * });
 * result.extracted['call-summary']; // { summary, sentiment }
 * ```
 */
export async function summarizeConversation(opts: SummarizeConversationOptions): Promise<SummarizeConversationResult> {
  const { messages } = opts;
  if (messages.length === 0) {
    return { summary: '', extracted: {} };
  }

  const extractors = opts.extract ?? [];
  const observationConfig: ResolvedObservationConfig = {
    model: opts.model,
    messageTokens: OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
    shareTokenBudget: false,
    modelSettings: { ...OBSERVATIONAL_MEMORY_DEFAULTS.observation.modelSettings },
    providerOptions: OBSERVATIONAL_MEMORY_DEFAULTS.observation.providerOptions,
    maxTokensPerBatch: OBSERVATIONAL_MEMORY_DEFAULTS.observation.maxTokensPerBatch,
    bufferOnIdle: false,
    observeAttachments: 'auto',
    instruction: opts.instructions,
    threadTitle: false,
    extractors,
  };

  const runner = new ObserverRunner({
    observationConfig,
    observedMessageIds: new Set(),
    resolveModel: () => ({ model: opts.model }),
    tokenCounter: new TokenCounter({ model: typeof opts.model === 'string' ? opts.model : undefined }),
    mastra: opts.mastra,
    memory: opts.memory,
  });

  const threadId = opts.threadId ?? messages.find(message => message.threadId)?.threadId;
  const resourceId = opts.resourceId ?? messages.find(message => message.resourceId)?.resourceId;

  const result = await runner.call(undefined, messages, opts.abortSignal, {
    skipContinuationHints: true,
    requestContext: opts.requestContext,
    observabilityContext: opts.observabilityContext,
    resourceId,
  });

  const hooked = await applyExtractorHooks({
    source: 'observer',
    extractors: result.extractors ?? extractors,
    values: result.extractedValues,
    failures: result.extractionFailures,
    threadId: threadId ?? '',
    resourceId,
    memory: opts.memory,
    requestContext: opts.requestContext,
  });

  return {
    summary: result.observations,
    extracted: hooked.values ?? {},
    extractionFailures: hooked.failures,
    usage: result.usage,
  };
}
