import type { LanguageModelV2CallWarning } from '@ai-sdk/provider-v5';
import type { LanguageModelRequestMetadata } from '@internal/ai-sdk-v5';
import type { MessageList } from '../../agent/message-list';
import { aiV5UIMessagesToAIV5ModelMessages } from '../../agent/message-list/conversion/output-converter';
import type { ChunkType, LanguageModelUsage } from '../../stream/types';
import { STEP_CONTENT_CHUNK_TYPES } from './step-content-chunk-types';

export interface TranscriptStep {
  messageId: string;
  start: number;
  end: number;
}

export function getTranscriptStepContent(messageList: MessageList, step: TranscriptStep) {
  const message = messageList.get.response.aiV5.ui().find(message => message.id === step.messageId);
  if (!message) return [];
  return aiV5UIMessagesToAIV5ModelMessages(
    [{ ...message, parts: message.parts.slice(step.start, step.end) }],
    messageList.get.all.db(),
  ).flatMap(messageList.get.response.aiV5.stepContent);
}

// A stream retains its own attempt, even after the run scope points at a replacement.
const attemptsByStream = new WeakMap<object, ModelAttempt>();

export function bindModelAttempt(stream: object, attempt: ModelAttempt): void {
  attemptsByStream.set(stream, attempt);
}

export function getModelAttempt(stream: object): ModelAttempt | undefined {
  return attemptsByStream.get(stream);
}

/** Private model-call cancellation; never cancels the owning run. */
export class ModelAttempt {
  readonly id = crypto.randomUUID();
  readonly controller = new AbortController();
  usage: LanguageModelUsage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
  warnings: LanguageModelV2CallWarning[] = [];
  request?: LanguageModelRequestMetadata;
  messageId?: string;
  transcriptStep?: TranscriptStep;
  fallbackModelIndex?: number;
  modelId?: string;
  #state: 'waiting' | 'armed' | 'accepted' | 'discarded' = 'waiting';
  #unsubscribe?: () => void;
  #runSignal?: AbortSignal;
  #processing = new Set<Promise<unknown>>();
  #parts = new Map<unknown[], number>();
  #discardCleanups = new Map<object, () => void>();
  #openReasoning = new Map<string, Extract<ChunkType, { type: 'reasoning-start' }>>();
  #onRunAbort = () => {
    this.controller.abort(this.#runSignal?.reason);
    this.#detach();
  };

  constructor(runSignal?: AbortSignal, subscribe?: (listener: () => void) => () => void) {
    this.#runSignal = runSignal;
    if (runSignal?.aborted) {
      this.#onRunAbort();
    } else {
      runSignal?.addEventListener('abort', this.#onRunAbort, { once: true });
    }
    this.#unsubscribe = subscribe?.(() => {
      if (this.#state !== 'armed' || this.#runSignal?.aborted) return;
      this.#state = 'discarded';
      this.controller.abort();
      this.#detach();
    });
  }

  get discarded(): boolean {
    return this.#state === 'discarded';
  }

  startModel(modelId: string, fallbackModelIndex: number): void {
    this.throwIfDiscarded();
    this.modelId = modelId;
    this.fallbackModelIndex = fallbackModelIndex;
    this.usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
    this.warnings = [];
    this.request = undefined;
  }

  // Subscribe before draining, then arm synchronously before any processor await.
  arm(): void {
    if (this.#state === 'waiting') this.#state = 'armed';
  }

  accept(): void {
    if (this.#state !== 'discarded') this.#state = 'accepted';
    this.#detach();
  }

  /** Observe provider boundaries before processors can delay or suppress them. */
  observe(chunk: { type: string }): boolean {
    if (this.discarded) return false;
    if (
      (chunk.type !== 'reasoning-delta' && STEP_CONTENT_CHUNK_TYPES.has(chunk.type)) ||
      chunk.type === 'text-start' ||
      chunk.type === 'text-end' ||
      chunk.type === 'tool-call-input-streaming-start' ||
      chunk.type === 'tool-call-input-streaming-end' ||
      chunk.type === 'tool-error'
    ) {
      this.accept();
    }
    return true;
  }

  observeRaw<OUTPUT>(chunk: ChunkType<OUTPUT>): boolean {
    if (!this.observe(chunk)) return false;
    if (chunk.type === 'step-start') {
      this.warnings = chunk.payload.warnings ?? [];
      this.request = chunk.payload.request;
    }
    if (chunk.type === 'finish') this.usage = chunk.payload.output.usage;
    return true;
  }

  throwIfDiscarded(): void {
    if (this.discarded) throw this.controller.signal.reason;
  }

  /** A processor writer is committing output, not merely reporting provider diagnostics. */
  observeWriter(chunk: { type: string; transient?: boolean }): boolean {
    // Signal echoes are input, not assistant output. In particular, processor
    // sendSignal writes directly to history and must not protect its model call.
    if (chunk.type === 'data-signal' || chunk.type === 'data-user-message') return true;
    if (!this.observe(chunk)) return false;
    if (chunk.type.startsWith('data-') && !chunk.transient) this.accept();
    return true;
  }

  trackParts(parts: unknown[]): void {
    if (!this.#parts.has(parts)) this.#parts.set(parts, parts.length);
    bindModelAttempt(parts, this);
  }

  trackProcessing<T>(work: Promise<T>): Promise<T> {
    const pending = work.finally(() => this.#processing.delete(pending));
    this.#processing.add(pending);
    return pending;
  }

  async settleProcessing(): Promise<void> {
    while (this.#processing.size) await Promise.allSettled(this.#processing);
  }

  addDiscardCleanup(owner: object, cleanup: () => void): void {
    if (!this.#discardCleanups.has(owner)) this.#discardCleanups.set(owner, cleanup);
  }

  async discardOutput(): Promise<void> {
    await this.settleProcessing();
    if (!this.discarded) return;
    for (const [parts, start] of this.#parts) {
      parts.splice(start);
      if (getModelAttempt(parts) === this) attemptsByStream.delete(parts);
    }
    for (const cleanup of this.#discardCleanups.values()) cleanup();
    this.#parts.clear();
    this.#discardCleanups.clear();
  }

  recordEmitted<OUTPUT>(chunk: ChunkType<OUTPUT>): void {
    if (chunk.type === 'reasoning-start') this.#openReasoning.set(chunk.payload.id, chunk);
    if (chunk.type === 'reasoning-end') this.#openReasoning.delete(chunk.payload.id);
  }

  closeReasoning(emit: (chunk: Extract<ChunkType, { type: 'reasoning-end' }>) => void): void {
    for (const chunk of this.#openReasoning.values()) {
      emit({ type: 'reasoning-end', runId: chunk.runId, from: chunk.from, payload: { id: chunk.payload.id } });
    }
    this.#openReasoning.clear();
  }

  dispose(): void {
    this.#detach();
    this.#runSignal?.removeEventListener('abort', this.#onRunAbort);
    for (const parts of this.#parts.keys()) {
      if (getModelAttempt(parts) === this) attemptsByStream.delete(parts);
    }
    this.#parts.clear();
    this.#discardCleanups.clear();
  }

  #detach(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }
}
