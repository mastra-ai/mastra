import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { OBSERVATION_CONTINUATION_HINT } from './constants';
import { omDebug, omError } from './debug';
import type { ObservationTurn } from './observation-turn/index';
import type { ObservationalMemory } from './observational-memory';
import { isOmReproCaptureEnabled, safeCaptureJson, writeProcessInputStepReproCapture } from './repro-capture';
import type { TokenCounterModelContext } from './token-counter';

// ── Circuit breaker for OM observation failures ──────────────────────────────
// After consecutive failures (e.g. rate limits), temporarily skip OM to avoid
// spamming a broken API and blocking the user experience.
const OM_CIRCUIT_BREAKER_THRESHOLD = 3; // failures before opening the circuit
const OM_CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 60 seconds cooldown

class ObservationCircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  /** Record a failure. Returns true if the circuit just opened. */
  recordFailure(): boolean {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= OM_CIRCUIT_BREAKER_THRESHOLD && !this.openedAt) {
      this.openedAt = Date.now();
      return true;
    }
    return false;
  }

  /** Record a success — resets the breaker. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  /** Returns true if the circuit is open (should skip OM). */
  isOpen(): boolean {
    if (!this.openedAt) return false;
    if (Date.now() - this.openedAt > OM_CIRCUIT_BREAKER_COOLDOWN_MS) {
      // Cooldown expired — move to half-open (allow one attempt)
      this.openedAt = null;
      this.consecutiveFailures = OM_CIRCUIT_BREAKER_THRESHOLD - 1; // one more failure re-opens
      return false;
    }
    return true;
  }

  get failures(): number {
    return this.consecutiveFailures;
  }
}

/** Subset of Memory that the processor needs — avoids circular imports. */
export interface MemoryContextProvider {
  getContext(opts: { threadId: string; resourceId?: string }): Promise<{
    systemMessage: string | undefined;
    messages: MastraDBMessage[];
    hasObservations: boolean;
    omRecord: ObservationalMemoryRecord | null;
    continuationMessage: MastraDBMessage | undefined;
    otherThreadsContext: string | undefined;
  }>;
  /** Raw message upsert — persist sealed messages to storage without embedding or working memory processing. */
  persistMessages(messages: MastraDBMessage[]): Promise<void>;
}

/**
 * Processor adapter for ObservationalMemory.
 *
 * This class owns the agent-lifecycle orchestration — it decides *when* to
 * load history, check thresholds, trigger observation/reflection, inject
 * observations into context, and save messages. The actual OM operations
 * are delegated to the Turn/Step handles which compose OM primitives.
 *
 * Processor-specific concerns (repro capture, progress emission, token
 * persistence, continuation message) stay here — they're not part of the
 * Turn/Step abstraction.
 */
export class ObservationalMemoryProcessor implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  /** The underlying ObservationalMemory engine. */
  readonly engine: ObservationalMemory;

  /** Memory instance for loading context. */
  private readonly memory: MemoryContextProvider;

  /** Active turn — created on first processInputStep, ended on processOutputResult. */
  private turn?: ObservationTurn;

  /** Circuit breaker to skip OM after consecutive failures. */
  private circuitBreaker = new ObservationCircuitBreaker();

  constructor(engine: ObservationalMemory, memory: MemoryContextProvider) {
    this.engine = engine;
    this.memory = memory;
  }

  // ─── Processor lifecycle hooks ──────────────────────────────────────────

  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const {
      messageList,
      requestContext,
      stepNumber,
      state: _state,
      writer,
      model,
      abortSignal,
      abort,
      rotateResponseMessageId,
    } = args;
    const state = _state ?? ({} as Record<string, unknown>);

    omDebug(
      `[OM:processInputStep:ENTER] step=${stepNumber}, hasMastraMemory=${!!requestContext?.get('MastraMemory')}, hasMemoryInfo=${!!messageList?.serialize()?.memoryInfo?.threadId}`,
    );

    const context = this.engine.getThreadContext(requestContext, messageList);
    if (!context) {
      omDebug(`[OM:processInputStep:NO-CONTEXT] getThreadContext returned null — returning early`);
      return messageList;
    }

    const { threadId, resourceId } = context;
    const memoryContext = parseMemoryRequestContext(requestContext);
    const readOnly = memoryContext?.memoryConfig?.readOnly;

    const actorModelContext = model?.modelId ? { provider: model.provider, modelId: model.modelId } : undefined;
    state.__omActorModelContext = actorModelContext;

    return this.engine.getTokenCounter().runWithModelContext(actorModelContext, async () => {
      // Repro capture setup
      const reproCaptureEnabled = isOmReproCaptureEnabled();
      const preRecordSnapshot = reproCaptureEnabled
        ? (safeCaptureJson(await this.engine.getOrCreateRecord(threadId, resourceId)) as ObservationalMemoryRecord)
        : null;
      const preMessagesSnapshot = reproCaptureEnabled
        ? (safeCaptureJson(messageList.get.all.db()) as MastraDBMessage[])
        : null;
      const preSerializedMessageList = reproCaptureEnabled
        ? (safeCaptureJson(messageList.serialize()) as ReturnType<MessageList['serialize']>)
        : null;

      // ── Read-only fast path: skip turn creation and observation lifecycle ──
      if (readOnly) {
        return messageList;
      }

      // ── Circuit breaker: skip OM if it has been failing repeatedly ──
      if (this.circuitBreaker.isOpen()) {
        omDebug(
          `[OM:processInputStep:CIRCUIT-OPEN] Skipping OM — circuit breaker open after ${this.circuitBreaker.failures} consecutive failures. Will retry after cooldown.`,
        );
        return messageList;
      }

      // ── Create turn on first step (or when state is reset) ──
      // The turn is stashed in customState so that the output processor instance
      // (which is a separate ObservationalMemoryProcessor) can retrieve it in
      // processOutputResult. In production, getInputProcessors() and
      // getOutputProcessors() each call createOMProcessor(), producing two
      // different instances that share only the processorStates map.
      if (!this.turn || !state.__omTurn) {
        // End previous turn if state was reset mid-flow
        if (this.turn && !state.__omTurn) {
          await this.turn.end().catch(() => {});
        }
        this.turn = this.engine.beginTurn({
          threadId,
          resourceId,
          messageList,
          hooks: {
            onBufferChunkSealed: rotateResponseMessageId,
          },
        });
        this.turn.writer = writer;
        this.turn.requestContext = requestContext;
        await this.turn.start(this.memory);
        state.__omTurn = this.turn;
      }

      // ── Run step preparation (activation, threshold, observation, filtering) ──
      {
        const step = this.turn.step(stepNumber);
        let ctx;
        try {
          ctx = await step.prepare();
        } catch (error) {
          // If the agent was explicitly aborted, propagate as before.
          if (abortSignal?.aborted) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (typeof abort === 'function') {
              abort('Agent execution was aborted');
            }
            throw err;
          }

          // For all other OM errors (rate limits, model failures, network issues):
          // degrade gracefully — log the error, emit a warning via the stream
          // writer, and let the agent continue without observations.
          // This prevents a failing OM model from blocking the main agent response.
          const err = error instanceof Error ? error : new Error(String(error));
          omError(`[OM] Observation failed during step preparation, continuing without observations: ${err.message}`);

          // Track failure in circuit breaker
          const circuitJustOpened = this.circuitBreaker.recordFailure();

          // Emit a non-blocking warning event so the UI can display it
          if (writer) {
            const warningMessage = circuitJustOpened
              ? `${err.message} (memory temporarily disabled after ${this.circuitBreaker.failures} failures, will retry in ${OM_CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s)`
              : err.message;
            void writer
              .custom({
                type: 'data-om-observation-failed',
                data: {
                  cycleId: `processor-error-${Date.now()}`,
                  operationType: 'observation',
                  startedAt: new Date().toISOString(),
                  error: warningMessage,
                  recordId: '',
                  threadId,
                  nonBlocking: true,
                },
              })
              .catch(() => {});
          }

          // Return messageList as-is — the agent proceeds without OM context
          return messageList;
        }

        // OM step preparation succeeded — reset circuit breaker
        this.circuitBreaker.recordSuccess();

        // Inject system messages (one per cache-stable chunk) + continuation
        if (ctx.systemMessage) {
          messageList.clearSystemMessages('observational-memory');
          for (const msg of ctx.systemMessage) {
            messageList.addSystem(msg, 'observational-memory');
          }

          const contMsg = this.turn.context.continuation ?? {
            id: 'om-continuation',
            role: 'user' as const,
            createdAt: new Date(0),
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>` },
              ],
            },
            threadId,
            resourceId,
          };
          messageList.add(contMsg, 'memory');
        }

        // ── Progress emission (processor-specific) ──────────
        // Fetch a fresh record from storage so buffering flags (e.g.
        // isBufferingObservation set by fire-and-forget buffer()) are visible.
        // The cached this.turn.record is stale in production DBs where each
        // query returns a new row object.
        const freshRecord = await this.engine.getOrCreateRecord(threadId, resourceId);
        await this.engine.emitProgress({
          record: freshRecord,
          stepNumber,
          pendingTokens: ctx.status.pendingTokens,
          threshold: ctx.status.threshold,
          effectiveObservationTokensThreshold: ctx.status.effectiveObservationTokensThreshold,
          currentObservationTokens: freshRecord.observationTokenCount ?? 0,
          writer,
          threadId,
          resourceId,
        });

        // ── Token persistence (processor-specific) ──────────
        const allDbMsgs = messageList.get.all.db();
        const tokenCounter = this.engine.getTokenCounter();
        const contextTokens = await tokenCounter.countMessagesAsync(allDbMsgs);
        const otherThreadsContext = this.turn.context.otherThreadsContext;
        const otherThreadTokens = otherThreadsContext ? tokenCounter.countString(otherThreadsContext) : 0;
        const finalTotalPending = contextTokens + otherThreadTokens;

        await this.engine
          .getStorage()
          .setPendingMessageTokens(freshRecord.id, finalTotalPending)
          .catch(() => {});

        // ── Repro capture (processor-specific) ──────────────
        if (reproCaptureEnabled) {
          writeProcessInputStepReproCapture({
            threadId,
            resourceId,
            stepNumber,
            args,
            preRecord: preRecordSnapshot!,
            postRecord: safeCaptureJson(freshRecord) as ObservationalMemoryRecord,
            preMessages: preMessagesSnapshot!,
            preBufferedChunks: [],
            preContextTokenCount: 0,
            preSerializedMessageList: preSerializedMessageList!,
            postBufferedChunks: [],
            postContextTokenCount: finalTotalPending,
            messageList,
            details: {},
          });
        }
      }

      return messageList;
    });
  }

  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, state: _state } = args;
    const state = _state ?? ({} as Record<string, unknown>);

    const context = this.engine.getThreadContext(requestContext, messageList);
    if (!context) return messageList;

    return this.engine
      .getTokenCounter()
      .runWithModelContext(state.__omActorModelContext as TokenCounterModelContext | undefined, async () => {
        const memoryContext = parseMemoryRequestContext(requestContext);
        if (memoryContext?.memoryConfig?.readOnly) return messageList;

        // Retrieve the turn from shared processor state — in production, the input
        // and output processors are separate instances (see comment in processInputStep).
        const turn = (state.__omTurn as ObservationTurn | undefined) ?? this.turn;
        if (turn) {
          await turn.end();
          this.turn = undefined;
          state.__omTurn = undefined;
        }

        return messageList;
      });
  }

  // ─── Passthrough API ────────────────────────────────────────────────────

  get config() {
    return this.engine.config;
  }

  async waitForBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    timeoutMs?: number,
  ) {
    return this.engine.waitForBuffering(threadId, resourceId, timeoutMs);
  }

  async getResolvedConfig(requestContext?: any) {
    return this.engine.getResolvedConfig(requestContext);
  }
}
