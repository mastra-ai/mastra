import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { classifyProviderError } from '@mastra/core/error';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { MemoryRunState } from '@mastra/core/memory';
import type { MemoryOperationAttributes, ObservabilityContext } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
  ProcessorSpanPhase,
} from '@mastra/core/processors';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { runOMCommit } from './commit-queue';
import { OBSERVATION_CONTINUATION_HINT } from './constants';
import { omDebug } from './debug';
import { getOmFailureMetadata } from './error';
import { findLastCompletedObservationBoundary, getObservableMessages } from './message-utils';
import type { ObservationTurn } from './observation-turn/index';
import { loadMemoryContextMessages } from './observation-turn/load-memory-context';
import { getPartKeys } from './observation-turn/step';
import type { ObservationalMemory } from './observational-memory';
import { isOmReproCaptureEnabled, safeCaptureJson, writeProcessInputStepReproCapture } from './repro-capture';
import { insertTemporalGapMarkers } from './temporal-markers';
import type { TokenCounterModelContext } from './token-counter';
import type { ObservationModelContext } from './types';

/**
 * Coerce a shared `state.__omTurn` value to a usable live turn.
 *
 * The turn is stashed in the shared processor-state map as a live `ObservationTurn`, but it
 * serializes (via `ObservationTurn.toJSON`) to a plain, method-less projection. If such a snapshot
 * were ever resumed back through here, `__omTurn` would be that plain object and calling `.end()`
 * on it would throw a synchronous TypeError the surrounding `.catch()` could not trap. Only treat a
 * value with a callable `end()` as a turn, so OM falls through to creating a fresh one. In practice
 * OM reads the live turn from the in-memory map, so this is defensive.
 */
function asLiveTurn(value: unknown): ObservationTurn | undefined {
  return value && typeof (value as ObservationTurn).end === 'function' ? (value as ObservationTurn) : undefined;
}

/** Subset of Memory that the processor needs — avoids circular imports. */
export interface MemoryContextProvider {
  getContext(opts: { threadId: string; resourceId?: string; runState?: MemoryRunState }): Promise<{
    systemMessage: string | undefined;
    messages: MastraDBMessage[];
    hasObservations: boolean;
    omRecord: ObservationalMemoryRecord | null;
    continuationMessage: MastraDBMessage | undefined;
    otherThreadsContext: string | undefined;
  }>;
  /** Raw message upsert — persist sealed messages to storage without embedding or working memory processing. */
  persistMessages(messages: MastraDBMessage[]): Promise<void>;
  getPersistedMessages?(threadId: string, ids: string[]): Promise<MastraDBMessage[]>;
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
function getOmObservabilityContext(
  args: ProcessInputStepArgs | ProcessOutputResultArgs | ProcessAPIErrorArgs,
): ObservabilityContext | undefined {
  if (!args.tracing || !args.tracingContext || !args.loggerVNext || !args.metrics) {
    return undefined;
  }

  return {
    tracing: args.tracing,
    tracingContext: args.tracingContext,
    loggerVNext: args.loggerVNext,
    metrics: args.metrics,
  };
}

/** Key used to store whether the gateway manages memory for the current step in per-processor state. */
const GATEWAY_STATE_KEY = '__isGatewayMemoryManaged';

/** Step number OM last recovered from a context-overflow error, so each step retries at most once. */
const CONTEXT_OVERFLOW_STEP_KEY = '__omContextOverflowStep';

/**
 * Whether the Mastra gateway serves Observational Memory for this step's model.
 *
 * Gateway models only get memory from the gateway when the credential is a Gateway project
 * key. Organization keys (`msk-gateway-…`, `mskv2_…`) are served by a gateway without the
 * memory API, so memory has to stay local. Newer `@mastra/core` exposes that decision on the
 * router model; when it is absent (older core, or a plain model) fall back to the historical
 * `mastra/` prefix check so gateway-side memory is never double-processed.
 *
 * A model that fails the check is not treated as local. Core answers `false` for a credential
 * that is missing and throws for any other failure; letting that through keeps the two sides in
 * agreement.
 */
async function isGatewayMemoryManaged(model: ProcessInputStepArgs['model']): Promise<boolean> {
  if (typeof model === 'object' && model !== null && typeof (model as any).isGatewayMemoryManaged === 'function') {
    return Boolean(await (model as any).isGatewayMemoryManaged());
  }
  return typeof model === 'object' && model !== null && 'gatewayId' in model && (model as any).gatewayId === 'mastra';
}

function injectObservationContextMessages({
  messageList,
  systemMessages,
  continuationMessage,
  hasObservations,
  threadId,
  resourceId,
}: {
  messageList: MessageList;
  systemMessages: string[] | undefined;
  continuationMessage: MastraDBMessage | undefined;
  /** Whether observations have replaced earlier messages. The continuation hint only makes sense then. */
  hasObservations: boolean;
  threadId: string;
  resourceId?: string;
}): void {
  if (!systemMessages?.length) {
    return;
  }

  messageList.clearSystemMessages('observational-memory');
  for (const msg of systemMessages) {
    messageList.addSystem(msg, 'observational-memory');
  }

  // Before the first observation the system messages are only retrieval guidance — no earlier
  // context was summarized away, so the continuation hint would be an empty instruction (and an
  // extra synthetic user message) on every turn of a fresh thread.
  if (!continuationMessage && !hasObservations) {
    return;
  }

  const contMsg = continuationMessage ?? {
    id: 'om-continuation',
    role: 'user' as const,
    createdAt: new Date(0),
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>` }],
    },
    threadId,
    resourceId,
  };
  messageList.add(contMsg, 'memory');
}

/**
 * Observational memory runs on the processor pipeline, but a user configures
 * `memory`, not a processor — so its spans are labelled as memory operations
 * rather than as anonymous pipeline entries.
 *
 * The two phases do different things and are named separately: the input step
 * builds observation context into the system messages (a recall), and the
 * output result persists what the turn produced (a save).
 */
const OM_PHASE_OPERATION: Partial<Record<ProcessorSpanPhase, NonNullable<MemoryOperationAttributes['operationType']>>> =
  {
    inputStep: 'recall',
    output: 'save',
    outputStep: 'save',
  };

export class ObservationalMemoryProcessor implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  readonly spanType = SpanType.MEMORY_OPERATION;

  readonly spanName = (phase: ProcessorSpanPhase): string => `memory: ${OM_PHASE_OPERATION[phase] ?? 'observational'}`;

  readonly spanAttributes = (phase: ProcessorSpanPhase): Partial<MemoryOperationAttributes> => {
    const operationType = OM_PHASE_OPERATION[phase];
    return operationType ? { operationType } : {};
  };

  /** The underlying ObservationalMemory engine. */
  readonly engine: ObservationalMemory;

  /** Memory instance for loading context. */
  private readonly memory: MemoryContextProvider;

  /** Whether temporal-gap reminder markers should be inserted. */
  private readonly temporalMarkers: boolean;

  /** Active turn — created on first processInputStep, ended on processOutputResult. */
  private turn?: ObservationTurn;

  constructor(engine: ObservationalMemory, memory: MemoryContextProvider, options?: { temporalMarkers?: boolean }) {
    this.engine = engine;
    this.memory = memory;
    this.temporalMarkers = options?.temporalMarkers ?? false;
  }

  /**
   * End any locally started turn without leaving it dangling.
   *
   * A gateway-managed step short-circuits both processor phases, so a turn started on an
   * earlier step of the same run — a delegation run whose model changed, or a run whose key
   * changed — would otherwise never be ended and its messages never persisted. `end()` with
   * no arguments flushes what the turn already tracked; finalization passes the accepted
   * terminal list for the same reason the regular output path does.
   *
   * A rejected write is not swallowed. `end()` marks the turn ended before it persists, so a
   * failed write leaves the turn unusable and its messages would be lost silently while the run
   * reported success. The drain persists those messages directly and rethrows, so a storage
   * failure surfaces instead of dropping the turn.
   */
  private async endActiveTurn(state: Record<string, unknown>, messageList?: MessageList): Promise<void> {
    const activeTurn = asLiveTurn(state.__omTurn) ?? this.turn;
    this.turn = undefined;
    state.__omTurn = undefined;
    if (!activeTurn || activeTurn.ended) return;

    const terminalList = messageList ?? activeTurn.messageList;
    const unsavedMessages = [...terminalList.get.input.db(), ...terminalList.get.response.db()];

    try {
      await activeTurn.end(terminalList);
    } catch (error) {
      if (unsavedMessages.length > 0) {
        await this.engine.persistMessages(unsavedMessages, activeTurn.threadId, activeTurn.resourceId).catch(() => {});
      }
      throw error;
    }
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
      messageId,
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

    // When the gateway serves Observational Memory for this model it handles OM
    // (observation, reflection, context injection) server-side, so running it locally would
    // double-process messages and cause history duplication. We ask the model itself (not
    // requestContext) so the answer stays per-step: a delegation run can move from a
    // gateway-managed model to a directly-configured one, and the flag must not stay sticky.
    // Gateway organization keys resolve to `false` here — the gateway has no memory API for
    // them, so memory stays local.
    const gatewayMemoryManaged = await isGatewayMemoryManaged(model);
    state[GATEWAY_STATE_KEY] = gatewayMemoryManaged;
    if (gatewayMemoryManaged) {
      // A turn started on an earlier step of this run would otherwise never end, because
      // processOutputResult short-circuits on the same flag — flush it before skipping.
      await this.endActiveTurn(state);
      omDebug(`[OM:processInputStep:GATEWAY] gateway manages memory — skipping local processing`);
      return messageList;
    }

    const { threadId, resourceId } = context;
    const memoryContext = parseMemoryRequestContext(requestContext);
    const runState = memoryContext?.runState?.();
    const readOnly = memoryContext?.memoryConfig?.readOnly;

    const actorModelContext = model
      ? {
          provider: model.provider,
          modelId: model.modelId,
          providerOptions: args.providerOptions,
          model,
        }
      : undefined;
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

      // ── Read-only path: load existing context, skip observation lifecycle ──
      if (readOnly) {
        const ctx = await loadMemoryContextMessages({
          memory: this.memory,
          messageList,
          threadId,
          resourceId,
          runState,
        });
        // Recall guidance is useful even with no record; null preserves read-only behavior.
        const systemMessages = await this.engine.buildContextSystemMessages({
          threadId,
          resourceId,
          record: ctx.omRecord,
          unobservedContextBlocks: ctx.otherThreadsContext,
        });

        injectObservationContextMessages({
          messageList,
          systemMessages,
          continuationMessage: ctx.continuationMessage,
          hasObservations: Boolean(ctx.omRecord?.activeObservations),
          threadId,
          resourceId,
        });

        return messageList;
      }

      // ── Create turn on first step (or when state is reset) ──
      // The turn is stashed in customState so that the output processor instance
      // (which is a separate ObservationalMemoryProcessor) can retrieve it in
      // processOutputResult. In production, getInputProcessors() and
      // getOutputProcessors() each call createOMProcessor(), producing two
      // different instances that share only the processorStates map.
      const activeTurn = asLiveTurn(state.__omTurn) ?? this.turn;
      if (activeTurn && activeTurn.messageList !== messageList) {
        // Durable runs may deserialize a fresh MessageList between loop iterations. End the
        // old turn first so any messages tracked on that list are flushed before OM moves on.
        await activeTurn.end().catch(() => {});
        if (this.turn === activeTurn) {
          this.turn = undefined;
        }
        state.__omTurn = undefined;
      }

      // A turn can be sealed before the loop reaches its next step — for example when a
      // sub-agent's `finish` / `step-finish` chunks are forwarded into the parent writer.
      // Reusing an ended turn throws "Turn already ended" from `step()` below, so discard it
      // and let beginTurn() start a fresh one, mirroring the message-list cleanup above.
      if (activeTurn?.ended || this.turn?.ended) {
        if (this.turn?.ended) {
          this.turn = undefined;
        }
        state.__omTurn = undefined;
      }

      let responseMessageId = messageId;
      if (!this.turn || !state.__omTurn) {
        // End previous turn if state was reset mid-flow
        if (this.turn && !state.__omTurn) {
          await this.turn.end().catch(() => {});
        }
        this.turn = this.engine.beginTurn({
          abortSignal,
          threadId,
          resourceId,
          messageList,
          agent: args.agent,
          observabilityContext: getOmObservabilityContext(args),
          hooks: {
            onBufferChunkSealed: rotateResponseMessageId,
            onSyncObservationComplete: rotateResponseMessageId,
          },
        });
        this.turn.writer = writer;
        this.turn.sendSignal = args.sendSignal;
        this.turn.sendStateSignal = args.sendStateSignal;
        this.turn.agent = args.agent;
        this.turn.requestContext = requestContext;
        await this.turn.start(this.memory, runState);
        if (stepNumber > 0) {
          // A background result may have landed in storage after the durable snapshot was saved.
          // Reconcile those response messages before the unread-part scan; the snapshot's part
          // keys represent what was seen.
          if (this.memory?.getPersistedMessages) {
            const responseIds = messageList.getPersisted.response.db().map(message => message.id);
            const snapshotMessages = new Map(messageList.get.all.db().map(message => [message.id, message]));
            const storedMessages = await this.memory.getPersistedMessages(threadId, responseIds);
            for (const stored of storedMessages) {
              const snapshot = snapshotMessages.get(stored.id);
              if (!snapshot) continue;
              const snapshotTools = snapshot.content.parts.filter(part => part.type === 'tool-invocation');
              const storedHasNewResult = stored.content.parts.some(part => {
                if (part.type !== 'tool-invocation' || part.toolInvocation.state !== 'result') return false;
                const previous = snapshotTools.find(
                  candidate => candidate.toolInvocation.toolCallId === part.toolInvocation.toolCallId,
                );
                if (!previous || previous.toolInvocation.state !== 'result') return true;
                const previousTask = previous.providerMetadata?.mastra?.backgroundTask as
                  | { status?: string }
                  | undefined;
                const storedTask = part.providerMetadata?.mastra?.backgroundTask as { status?: string } | undefined;
                return (
                  previousTask?.status === 'running' &&
                  (storedTask?.status === 'completed' || storedTask?.status === 'failed')
                );
              });
              if (storedHasNewResult) {
                this.turn.drainedPartKeys.set(stored.id, new Set(getPartKeys(snapshot)));
                messageList.add(stored, 'memory');
              }
            }
          }
        }
        // A run recovered by another worker can continue a response message that the dead
        // worker already observed. That worker rotated the id in memory, but the rotation was
        // lost with it. Seal and rotate again so the rest of the turn isn't merged into the observed message.
        // observedMessageIds alone misses responses observed before an activation or a reflection,
        // neither of which keeps their ids. What survives is on the message itself: buffering
        // persists OM's seal before the Observer runs, and sync observation persists its end
        // marker on the observed message before it may reflect.
        // When only the ids say so, persist the seal too: a later reflection drops the ids, and
        // the message would otherwise look unobserved if this worker also dies.
        const observedIds = this.turn.record.observedMessageIds;
        const response = messageId ? messageList.get.all.db().find(message => message.id === messageId) : undefined;
        const responseSealed =
          (response?.content?.metadata as { mastra?: { sealed?: boolean } } | undefined)?.mastra?.sealed === true;
        const responseObserved =
          responseSealed ||
          (!!response && findLastCompletedObservationBoundary(response) >= 0) ||
          (!!messageId && Array.isArray(observedIds) && observedIds.includes(messageId));
        if (messageId && responseObserved) {
          if (response && !responseSealed) {
            // Persist first, and fail the step rather than continue: without the stored seal, a later
            // reflection erases the only evidence, and the next recovery would merge into this message.
            await this.engine.persistMessageSeal(response);
            this.engine.sealMessagesForBuffering([response]);
          }
          responseMessageId = rotateResponseMessageId?.() ?? messageId;
        }
        if (stepNumber === 0 && this.temporalMarkers) {
          await insertTemporalGapMarkers({ messageList, sendSignal: args.sendSignal });
        }
        state.__omTurn = this.turn;
      }

      this.turn.addHooks({
        onBufferChunkSealed: rotateResponseMessageId,
        onSyncObservationComplete: rotateResponseMessageId,
      });

      const observabilityContext = getOmObservabilityContext(args);
      state.__omObservabilityContext = observabilityContext;
      this.turn.observabilityContext = observabilityContext;
      this.turn.actorModelContext = actorModelContext;
      this.turn.responseMessageId = responseMessageId;

      // ── Run step preparation (activation, threshold, observation, filtering) ──
      {
        const step = this.turn.step(stepNumber);
        let ctx;
        try {
          ctx = await step.prepare();
        } catch (error) {
          // Map observation errors through abort (processor-specific concern)
          const err = error instanceof Error ? error : new Error(String(error));
          // Name the abort's reason (e.g. a lost thread lease): the tripwire replaces the run's abort chunk.
          const abortReason: unknown = abortSignal?.reason;
          const abortMessage = abortSignal?.aborted
            ? abortReason instanceof Error && abortReason.name !== 'AbortError'
              ? `Agent execution was aborted: ${abortReason.message}`
              : 'Agent execution was aborted'
            : `Encountered error during memory observation: ${err.message}`;
          // A tripwire skips output processors, so end the turn here to save the user message and
          // finished steps. The step that failed never reached the model, so nothing blocked is saved.
          const failedTurn = this.turn;
          await failedTurn.end().catch(() => {});
          if (this.turn === failedTurn) {
            this.turn = undefined;
          }
          state.__omTurn = undefined;
          if (typeof abort === 'function') {
            abort(abortMessage, { metadata: getOmFailureMetadata(error, 'abort') });
          }
          throw err;
        }

        // Inject system messages (one per cache-stable chunk) + continuation
        injectObservationContextMessages({
          messageList,
          systemMessages: ctx.systemMessage,
          continuationMessage: this.turn.context.continuation,
          hasObservations: Boolean(this.turn.record.activeObservations),
          threadId,
          resourceId,
        });

        // ── Progress emission (processor-specific) ──────────
        const turnRecord = this.turn.record;
        await this.engine.emitProgress({
          record: turnRecord,
          stepNumber,
          pendingTokens: ctx.status.pendingTokens,
          threshold: ctx.status.threshold,
          effectiveObservationTokensThreshold: ctx.status.effectiveObservationTokensThreshold,
          currentObservationTokens: turnRecord.observationTokenCount ?? 0,
          writer,
          threadId,
          resourceId,
        });

        // ── Token persistence (processor-specific) ──────────
        // prepare() already counted the current unobserved window and resource context.
        const finalTotalPending = ctx.status.pendingTokens;
        try {
          await runOMCommit(
            this.engine.buffering.getLockKey(threadId, resourceId),
            () => this.engine.getStorage().setPendingMessageTokens(turnRecord.id, finalTotalPending),
            { abortSignal },
          );
          this.turn.patchRecord({ pendingMessageTokens: finalTotalPending });
        } catch {
          // Token persistence is intentionally non-fatal for streaming UX.
        }

        // ── Repro capture (processor-specific) ──────────────
        if (reproCaptureEnabled) {
          writeProcessInputStepReproCapture({
            threadId,
            resourceId,
            stepNumber,
            args,
            preRecord: preRecordSnapshot!,
            postRecord: safeCaptureJson(turnRecord) as ObservationalMemoryRecord,
            preMessages: preMessagesSnapshot!,
            preBufferedChunks: [],
            preContextTokenCount: 0,
            preSerializedMessageList: preSerializedMessageList!,
            postBufferedChunks: [],
            postContextTokenCount: finalTotalPending,
            messageList,
            details: {},
            observerExchange: ctx.observerExchange,
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

    // Gateway manages memory for the current step — skip local output processing (see
    // processInputStep). Never leave an open local turn behind on the way out: a turn started
    // on an earlier, locally-managed step of the same run would otherwise never be ended and
    // its messages would never persist. Persist from the accepted terminal list, exactly like
    // the regular finalization path below.
    if (state[GATEWAY_STATE_KEY]) {
      await this.endActiveTurn(state, messageList.cloneForPersistence());
      return messageList;
    }

    const observabilityContext = getOmObservabilityContext(args);
    state.__omObservabilityContext = observabilityContext;

    return this.engine
      .getTokenCounter()
      .runWithModelContext(state.__omActorModelContext as TokenCounterModelContext | undefined, async () => {
        const memoryContext = parseMemoryRequestContext(requestContext);
        if (memoryContext?.memoryConfig?.readOnly) return messageList;

        const persistenceMessageList = messageList.cloneForPersistence();

        // Retrieve the turn from shared processor state — in production, the input
        // and output processors are separate instances (see comment in processInputStep).
        const turn = asLiveTurn(state.__omTurn) ?? this.turn;
        // The turn can already be sealed by the time the loop finalizes — for example when a
        // sub-agent's `finish` / `step-finish` chunks are forwarded into the parent writer, or
        // when a mid-loop seal left the shared state pointing at an ended turn. `end()` throws
        // on an ended turn, and the refs are only cleared after it resolves, so a stale ended
        // turn would reject finalization and never reach the direct-persist path below. Treat it
        // as absent, mirroring the ended-turn cleanup in processInputStep.
        const liveTurn = turn && !turn.ended ? turn : undefined;

        if (liveTurn) {
          // Use the pipeline's accepted terminal list as the persistence authority,
          // rather than relying on the list captured when the turn began.
          await liveTurn.end(persistenceMessageList);
        }
        this.turn = undefined;
        state.__omTurn = undefined;

        if (!liveTurn) {
          // No live turn exists — this happens during a resumed stream where input processors
          // were skipped (isResume=true), so processInputStep never created a turn, or when the
          // turn was already sealed before finalization. Directly persist any new response
          // messages so the final assistant text from the resumed turn is not lost.
          const newOutput = persistenceMessageList.get.response.db();
          const newInput = persistenceMessageList.get.input.db();
          const messagesToSave = [...newInput, ...newOutput];
          if (messagesToSave.length > 0 && context.threadId) {
            await this.engine.persistMessages(messagesToSave, context.threadId, context.resourceId);
          }
        }

        return messageList;
      });
  }

  async processAPIError(args: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    const { error, messageList, requestContext, stepNumber, state } = args;

    if (!this.engine.getObservationConfig().observeOnContextOverflow) return;
    // Gateway-served memory means the gateway owns the prompt and its compaction.
    if (state[GATEWAY_STATE_KEY]) return;
    // One recovery per step: if the retry overflows again, observing more won't help.
    if (state[CONTEXT_OVERFLOW_STEP_KEY] === stepNumber) return;
    if (classifyProviderError(error) !== 'context_overflow') return;

    const context = this.engine.getThreadContext(requestContext, messageList);
    if (!context) return;
    if (parseMemoryRequestContext(requestContext)?.memoryConfig?.readOnly) return;

    state[CONTEXT_OVERFLOW_STEP_KEY] = stepNumber;
    omDebug(`[OM:processAPIError] context overflow at step ${stepNumber} — observing pending messages`);

    // The provider counted more tokens than OM's estimate, so pending tokens can be below the
    // threshold. Activate buffered observations and observe what's left regardless of it; the
    // retry's input step then drops the observed messages from the prompt.
    const { threadId, resourceId } = context;
    await this.engine.waitForBuffering(threadId, resourceId, undefined, args.abortSignal);
    const messages = getObservableMessages(messageList);
    const { activated } = await this.engine.activate({
      abortSignal: args.abortSignal,
      threadId,
      resourceId,
      messages,
      messageList,
      writer: args.writer,
    });
    const { observed } = await this.engine
      .getTokenCounter()
      .runWithModelContext(state.__omActorModelContext as TokenCounterModelContext | undefined, () =>
        this.engine.observe({
          abortSignal: args.abortSignal,
          threadId,
          resourceId,
          messages: getObservableMessages(messageList),
          messageList,
          force: true,
          agent: args.agent,
          sendSignal: args.sendSignal,
          sendStateSignal: args.sendStateSignal,
          requestContext,
          currentModel: state.__omActorModelContext as ObservationModelContext | undefined,
          writer: args.writer,
          observabilityContext: getOmObservabilityContext(args),
        }),
      );

    // The run goes on writing its response after the retry. Under the id just observed, the rest of the
    // run would count as observed and never be observed or dropped, so the next overflow could not recover.
    if (observed) args.rotateResponseMessageId?.();

    return { retry: activated || observed };
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
