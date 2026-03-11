import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { OBSERVATION_CONTINUATION_HINT } from './constants';
import { omDebug } from './debug';
import type { ObservationalMemory } from './observational-memory';
import { isOmReproCaptureEnabled, safeCaptureJson, writeProcessInputStepReproCapture } from './repro-capture';
import { resolveRetentionFloor } from './thresholds';
import type { TokenCounterModelContext } from './token-counter';

/** Subset of Memory that the processor needs — avoids circular imports. */
export interface MemoryContextProvider {
  getContext(opts: {
    threadId: string;
    resourceId?: string;
  }): Promise<{
    systemMessage: string | undefined;
    messages: MastraDBMessage[];
    hasObservations: boolean;
    omRecord: ObservationalMemoryRecord | null;
    continuationMessage: MastraDBMessage | undefined;
    otherThreadsContext: string | undefined;
  }>;
}

/**
 * Processor adapter for ObservationalMemory.
 *
 * This class owns the agent-lifecycle orchestration — it decides *when* to
 * load history, check thresholds, trigger observation/reflection, inject
 * observations into context, and save messages. All the *how* — the actual
 * memory operations — is delegated to the ObservationalMemory engine via
 * high-level semantic methods.
 *
 * The processor never accesses engine internals (storage, tokenCounter, config,
 * static maps). It calls only public engine methods designed for external use.
 */
export class ObservationalMemoryProcessor implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  /** The underlying ObservationalMemory engine. */
  readonly engine: ObservationalMemory;

  /** Memory instance for loading context. */
  private readonly memory: MemoryContextProvider;

  constructor(engine: ObservationalMemory, memory: MemoryContextProvider) {
    this.engine = engine;
    this.memory = memory;
  }

  // ─── Processor lifecycle hooks ──────────────────────────────────────────

  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, stepNumber, state: _state, writer, abortSignal, model } = args;
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

    const actorModelContext = this.engine.getRuntimeModelContext(model);
    state.__omActorModelContext = actorModelContext;

    return this.engine.runWithTokenCounterModelContext(actorModelContext, async () => {
      let record = await this.engine.getOrCreateRecord(threadId, resourceId);
      const reproCaptureEnabled = isOmReproCaptureEnabled();
      const preRecordSnapshot = reproCaptureEnabled ? (safeCaptureJson(record) as ObservationalMemoryRecord) : null;
      const preMessagesSnapshot = reproCaptureEnabled
        ? (safeCaptureJson(messageList.get.all.db()) as MastraDBMessage[])
        : null;
      const preSerializedMessageList = reproCaptureEnabled
        ? (safeCaptureJson(messageList.serialize()) as ReturnType<MessageList['serialize']>)
        : null;
      const reproCaptureDetails: Record<string, unknown> = {
        step0Activation: null,
        thresholdCleanup: null,
        thresholdReached: false,
      };
      omDebug(
        `[OM:step] processInputStep step=${stepNumber}: recordId=${record.id}, genCount=${record.generationCount}, obsTokens=${record.observationTokenCount}`,
      );

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1: LOAD CONTEXT (messages + system message + continuation)
      // ════════════════════════════════════════════════════════════════════════
      if (!state.initialSetupDone) {
        state.initialSetupDone = true;

        const ctx = await this.memory.getContext({ threadId, resourceId });

        // Add historical messages to the MessageList, filtering out system messages
        for (const msg of ctx.messages) {
          if (msg.role !== 'system') {
            messageList.add(msg, 'memory');
          }
        }

        // Store context data for use in later steps
        state.__omContext = ctx;
      }

      const cachedContext = state.__omContext as Awaited<ReturnType<MemoryContextProvider['getContext']>> | undefined;
      const otherThreadsContext = cachedContext?.otherThreadsContext;

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1c: ACTIVATE BUFFERED OBSERVATIONS (step 0 only)
      // ════════════════════════════════════════════════════════════════════════
      if (stepNumber === 0 && !readOnly) {
        const step0Result = await this.engine.tryStep0Activation({
          messageList,
          record,
          threadId,
          resourceId,
          messages: messageList.get.all.db(),
          otherThreadContext: otherThreadsContext,
          currentObservationTokens: record.observationTokenCount ?? 0,
          writer,
          requestContext,
        });

        reproCaptureDetails.step0Activation = step0Result.activationDetails ?? null;

        if (step0Result.activated) {
          record = step0Result.record;
        } else if (!step0Result.activated) {
          // Check for standalone reflection even if activation didn't happen
          record = await this.engine.maybeStep0Reflect({
            record,
            threadId,
            resourceId,
            writer,
            messageList,
            requestContext,
          });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 2: THRESHOLD CHECKING & OBSERVATION
      // ════════════════════════════════════════════════════════════════════════
      let didThresholdCleanup = false;
      let threshold = 0;
      let effectiveObservationTokensThreshold = 0;
      let totalPendingTokens = 0;

      if (!readOnly) {
        const allMessages = messageList.get.all.db();
        const status = await this.engine.getObservationStatus({
          threadId,
          resourceId,
          messages: allMessages,
          otherThreadContext: otherThreadsContext,
          currentObservationTokens: record.observationTokenCount ?? 0,
        });

        record = status.record;
        totalPendingTokens = status.pendingTokens;
        threshold = status.threshold;
        effectiveObservationTokensThreshold = status.effectiveObservationTokensThreshold;

        // Merge sealed IDs from processor state with engine's sealed IDs
        const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();
        const staticSealed = this.engine.getSealedIds(threadId, resourceId);
        if (staticSealed) {
          for (const id of staticSealed) sealedIds.add(id);
        }
        state.sealedIds = sealedIds;

        omDebug(
          `[OM:step] step=${stepNumber}: totalPending=${totalPendingTokens}, unbuffered=${status.unbufferedPendingTokens}, threshold=${threshold}, sealedIds=${sealedIds.size}`,
        );

        // Trigger async buffering if we've crossed an interval boundary
        if (status.asyncObservationEnabled) {
          const unobservedMessages = this.engine.getUnobservedMessages(allMessages, status.record);
          await this.engine.triggerAsyncBuffering({
            threadId,
            resourceId,
            record: status.record,
            pendingTokens: totalPendingTokens,
            unbufferedPendingTokens: status.unbufferedPendingTokens,
            unobservedMessages,
            threshold,
            writer,
            requestContext,
          });
        }

        if (stepNumber > 0) {
          // Per-step save
          await this.engine.saveIncrementalMessages({
            messageList,
            sealedIds,
            threadId,
            resourceId,
            state,
          });

          if (status.shouldObserve) {
            reproCaptureDetails.thresholdReached = true;
            omDebug(
              `[OM:threshold] step=${stepNumber}: totalPending=${totalPendingTokens} >= threshold=${threshold}, triggering observation`,
            );

            const obsResult = await this.engine.observeWithActivation({
              threadId,
              resourceId,
              messages: messageList.get.all.db(),
              messageList,
              threshold,
              otherThreadContext: otherThreadsContext,
              writer,
              abortSignal,
              requestContext,
            });

            if (obsResult.succeeded) {
              didThresholdCleanup = true;
              const observedIds = obsResult.activatedMessageIds ?? obsResult.record.observedMessageIds ?? [];

              const minRemaining = resolveRetentionFloor(
                this.engine.getObservationConfig().bufferActivation ?? 1,
                threshold,
              );

              reproCaptureDetails.thresholdCleanup = {
                observationSucceeded: true,
                observedIdsCount: observedIds.length,
                observedIds: observedIds.map((id: string) => id.slice(0, 8)),
                minRemaining,
                updatedRecordObservedIds: obsResult.record.observedMessageIds?.length ?? 0,
              };

              omDebug(`[OM:cleanup] observedIds=${observedIds.length}, minRemaining=${minRemaining}`);

              await this.engine.cleanupObservedContext({
                messageList,
                sealedIds,
                threadId,
                resourceId,
                state,
                observedMessageIds: observedIds,
                retentionFloor: minRemaining,
              });

              if (status.asyncObservationEnabled) {
                await this.engine.resetBufferingState({
                  threadId,
                  resourceId,
                  recordId: obsResult.record.id,
                  activatedMessageIds: obsResult.activatedMessageIds,
                });
              }

              record = obsResult.record;
            }
          }
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 3: INJECT OBSERVATIONS & FILTER ALREADY-OBSERVED MESSAGES
      // ════════════════════════════════════════════════════════════════════════

      // Build fresh system message from the current record (may have changed during Step 2)
      const rawCurrentDate = requestContext?.get('currentDate');
      const currentDate =
        rawCurrentDate instanceof Date
          ? rawCurrentDate
          : typeof rawCurrentDate === 'string'
            ? new Date(rawCurrentDate)
            : new Date();
      const observationSystemMessage = await this.engine.buildContextSystemMessage({
        threadId,
        resourceId,
        record,
        unobservedContextBlocks: otherThreadsContext,
        currentDate,
      });

      if (observationSystemMessage) {
        messageList.clearSystemMessages('observational-memory');
        messageList.addSystem(observationSystemMessage, 'observational-memory');

        // Add continuation reminder from cached context, or build inline
        const contMsg = cachedContext?.continuationMessage ?? {
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

      if (!didThresholdCleanup) {
        await this.engine.filterObservedMessages({
          messageList,
          record,
          useMarkerBoundaryPruning: stepNumber === 0,
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 4: EMIT PROGRESS & PERSIST TOKENS
      // ════════════════════════════════════════════════════════════════════════
      const freshRecord = await this.engine.getOrCreateRecord(threadId, resourceId);
      const contextMessages = messageList.get.all.db().filter(m => m.id !== 'om-continuation' && m.role !== 'system');
      const freshUnobservedTokens = await this.engine.countMessageTokensAsync(contextMessages);
      const finalOtherThreadTokens = otherThreadsContext
        ? this.engine.countStringTokens(otherThreadsContext)
        : 0;
      const finalTotalPending = freshUnobservedTokens + finalOtherThreadTokens;

      await this.engine.emitProgress({
        record: freshRecord,
        pendingTokens: finalTotalPending,
        threshold,
        effectiveObservationTokensThreshold,
        currentObservationTokens: freshRecord.observationTokenCount ?? 0,
        writer,
        stepNumber,
        threadId,
        resourceId,
      });

      await this.engine.savePendingTokens(freshRecord.id, finalTotalPending);

      // Repro capture
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
          details: reproCaptureDetails,
        });
      }

      return messageList;
    });
  }

  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, state: _state } = args;
    const state = _state ?? ({} as Record<string, unknown>);

    const context = this.engine.getThreadContext(requestContext, messageList);
    if (!context) return messageList;

    const { threadId, resourceId } = context;

    return this.engine.runWithTokenCounterModelContext(
      state.__omActorModelContext as TokenCounterModelContext | undefined,
      async () => {
        const memoryContext = parseMemoryRequestContext(requestContext);
        if (memoryContext?.memoryConfig?.readOnly) return messageList;

        const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();

        await this.engine.saveFinalMessages({
          messageList,
          sealedIds,
          threadId,
          resourceId,
          state,
        });

        return messageList;
      },
    );
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

  static async awaitBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    scope: 'resource' | 'thread',
    timeoutMs?: number,
  ) {
    const { ObservationalMemory: OM } = await import('./observational-memory');
    return OM.awaitBuffering(threadId, resourceId, scope, timeoutMs);
  }
}
