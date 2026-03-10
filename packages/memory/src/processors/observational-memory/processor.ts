import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { getThreadOMMetadata, parseMemoryRequestContext, setThreadOMMetadata } from '@mastra/core/memory';
import type {
  Processor,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
  ProcessorStreamWriter,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { ObservationalMemory, OBSERVATION_CONTINUATION_HINT, omDebug } from './observational-memory';
import { isOpActiveInProcess } from './operation-registry';
import { isOmReproCaptureEnabled, safeCaptureJson, writeProcessInputStepReproCapture } from './repro-capture';
import {
  calculateDynamicThreshold,
  calculateProjectedMessageRemoval,
  getMaxThreshold,
  resolveRetentionFloor,
} from './thresholds';
import { TokenCounter } from './token-counter';
import type { TokenCounterModelContext } from './token-counter';
import type { DataOmStatusPart, ThresholdRange } from './types';

/**
 * Processor adapter for ObservationalMemory.
 *
 * This class owns the agent-lifecycle orchestration — it decides *when* to
 * load history, check thresholds, trigger observation/reflection, inject
 * observations into context, and save messages. All the *how* — the actual
 * memory operations — is delegated to the ObservationalMemory engine.
 *
 * Consumers that resolve this processor via
 * `agent.resolveProcessorById('observational-memory')` can access engine
 * methods through the `engine` property or via passthrough methods.
 */
export class ObservationalMemoryProcessor implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  /** The underlying ObservationalMemory engine. */
  readonly engine: ObservationalMemory;

  constructor(engine: ObservationalMemory) {
    this.engine = engine;
  }

  // ─── Processor lifecycle hooks ──────────────────────────────────────────

  /**
   * Process input at each step - check threshold, observe if needed, save, inject observations.
   *
   * Flow:
   * 1. Load historical messages (step 0 only)
   * 2. Check if observation threshold is reached
   * 3. If threshold reached: observe, save messages with markers
   * 4. Inject observations into context
   * 5. Filter out already-observed messages
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, stepNumber, state: _state, writer, abortSignal, abort, model } = args;
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
      // Fetch fresh record
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
        `[OM:step] processInputStep step=${stepNumber}: recordId=${record.id}, genCount=${record.generationCount}, obsTokens=${record.observationTokenCount}, bufferedReflection=${record.bufferedReflection ? 'present (' + record.bufferedReflection.length + ' chars)' : 'empty'}, activeObsLen=${record.activeObservations?.length}`,
      );

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1: LOAD HISTORICAL MESSAGES (step 0 only)
      // ════════════════════════════════════════════════════════════════════════
      await this.loadHistoricalMessagesIfNeeded(messageList, state, threadId, resourceId, record.lastObservedAt);

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1b: LOAD OTHER THREADS' UNOBSERVED CONTEXT (resource scope, every step)
      // ════════════════════════════════════════════════════════════════════════
      let unobservedContextBlocks: string | undefined;
      if (this.engine.scope === 'resource' && resourceId) {
        unobservedContextBlocks = await this.loadOtherThreadsContext(resourceId, threadId);
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1c: ACTIVATE BUFFERED OBSERVATIONS (step 0 only)
      // At the start of a new turn, check if buffered observations should be activated.
      // Only activates if message tokens have reached the observation threshold,
      // preventing premature activation of partially-buffered content.
      // ════════════════════════════════════════════════════════════════════════
      if (stepNumber === 0 && !readOnly && this.engine.isAsyncObservationEnabled()) {
        const lockKey = this.engine.getLockKey(threadId, resourceId);
        const bufferedChunks = this.engine.getBufferedChunks(record);
        omDebug(
          `[OM:step0-activation] asyncObsEnabled=true, bufferedChunks=${bufferedChunks.length}, isBufferingObs=${record.isBufferingObservation}`,
        );

        // Reset stale lastBufferedBoundary at the start of a new turn.
        // After activation+reflection on a previous turn, the context may have shrunk
        // significantly (e.g., 51k → 3k) but the DB boundary stays at 51k. This makes
        // shouldTriggerAsyncObservation think we're still in interval 5, preventing any
        // new buffering triggers until tokens grow past 51k again.
        {
          const bufKey = this.engine.getObservationBufferKey(lockKey);
          const dbBoundary = record.lastBufferedAtTokens ?? 0;
          const currentContextTokens = this.engine.tokenCounter.countMessages(messageList.get.all.db());
          if (dbBoundary > 0 && currentContextTokens < dbBoundary * 0.5) {
            omDebug(
              `[OM:step0-activation] resetting stale lastBufferedBoundary: dbBoundary=${dbBoundary}, currentContextTokens=${currentContextTokens}`,
            );
            ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
            await this.engine.storage.setBufferingObservationFlag(record.id, false, 0).catch(() => {});
          }
        }

        if (bufferedChunks.length > 0) {
          const unobservedMessages = this.engine.getUnobservedMessages(messageList.get.all.db(), record);
          const step0ContextTokens = await this.engine.tokenCounter.countMessagesAsync(unobservedMessages);
          const step0OtherThreadTokens = unobservedContextBlocks
            ? this.engine.tokenCounter.countString(unobservedContextBlocks)
            : 0;
          const step0PendingTokens = step0ContextTokens + step0OtherThreadTokens;

          const { threshold: step0Threshold } = await this.calculateObservationThresholds(
            messageList.get.all.db(),
            unobservedMessages,
            step0PendingTokens,
            step0OtherThreadTokens,
            record.observationTokenCount ?? 0,
            record,
          );

          omDebug(
            `[OM:step0-activation] pendingTokens=${step0PendingTokens}, threshold=${step0Threshold}, blockAfter=${this.engine.observationConfig.blockAfter}, shouldActivate=${step0PendingTokens >= step0Threshold}, allMsgs=${messageList.get.all.db().length}`,
          );

          if (step0PendingTokens >= step0Threshold) {
            const activationResult = await this.engine.tryActivateBufferedObservations(
              record,
              lockKey,
              step0PendingTokens,
              writer,
              messageList,
            );
            reproCaptureDetails.step0Activation = {
              attempted: true,
              success: activationResult.success,
              messageTokensActivated: activationResult.messageTokensActivated,
              activatedMessageIds: activationResult.activatedMessageIds,
              hadUpdatedRecord: !!activationResult.updatedRecord,
            };

            if (activationResult.success) {
              omDebug(
                `[OM:step0-activation] activation succeeded, messageTokensActivated=${activationResult.messageTokensActivated}, activatedIds=${activationResult.activatedMessageIds?.map(id => id.slice(0, 8)).join(',')}`,
              );

              // Remove activated messages from context
              const activatedIds = activationResult.activatedMessageIds ?? [];
              if (activatedIds.length > 0) {
                const dbMsgs = messageList.get.all.db();
                const toRemove = dbMsgs.filter(m => m.id && activatedIds.includes(m.id) && m.id !== 'om-continuation');
                if (toRemove.length > 0) {
                  messageList.removeByIds(toRemove.map(m => m.id!));
                }
              }

              // Clean up static maps for activated IDs
              this.engine.cleanupStaticMaps(threadId, resourceId, activatedIds);

              // Reset lastBufferedBoundary so new buffering can start fresh
              const bufKey = this.engine.getObservationBufferKey(lockKey);
              ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
              await this.engine.storage.setBufferingObservationFlag(record.id, false, 0).catch(() => {});

              // Update thread metadata with continuation hints
              const thread = await this.engine.storage.getThreadById({ threadId });
              if (thread) {
                const activatedMessages =
                  activatedIds.length > 0
                    ? messageList.get.all.db().filter(m => m.id && activatedIds.includes(m.id))
                    : [];
                const newMetadata = setThreadOMMetadata(thread.metadata, {
                  suggestedResponse: activationResult.suggestedContinuation,
                  currentTask: activationResult.currentTask,
                  lastObservedMessageCursor: this.engine.getLastObservedMessageCursor(activatedMessages),
                });
                await this.engine.storage.updateThread({
                  id: threadId,
                  title: thread.title ?? '',
                  metadata: newMetadata,
                });
              }

              // Check if reflection should be triggered after activation
              await this.engine.maybeReflect({
                record: activationResult.updatedRecord ?? record,
                observationTokens:
                  activationResult.updatedRecord?.observationTokenCount ?? record.observationTokenCount ?? 0,
                writer,
                messageList,
                requestContext,
              });

              // Re-fetch record after potential reflection
              record = await this.engine.getOrCreateRecord(threadId, resourceId);
            }
          }
        }

        // Step 0 reflection: check if we need to reflect now (not after activation)
        if (
          !reproCaptureDetails.step0Activation ||
          !(reproCaptureDetails.step0Activation as Record<string, unknown>)?.success
        ) {
          const obsTokens = record.observationTokenCount ?? 0;
          if (this.shouldReflect(obsTokens)) {
            omDebug(`[OM:step0-reflect] obsTokens=${obsTokens} over reflection threshold, triggering maybeReflect`);
            await this.engine.maybeReflect({
              record,
              observationTokens: obsTokens,
              writer,
              messageList,
              requestContext,
            });
            record = await this.engine.getOrCreateRecord(threadId, resourceId);
          } else if (
            this.engine.isAsyncReflectionEnabled() &&
            this.shouldTriggerAsyncReflection(obsTokens, this.engine.getLockKey(threadId, resourceId), record)
          ) {
            omDebug(`[OM:step0-reflect] obsTokens=${obsTokens} above activation point for async reflection`);
            await this.maybeAsyncReflect(record, obsTokens, writer, messageList, requestContext);
            record = await this.engine.getOrCreateRecord(threadId, resourceId);
          }
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 2: CALCULATE THRESHOLDS & TRIGGER OBSERVATION IF NEEDED
      // ════════════════════════════════════════════════════════════════════════
      let didThresholdCleanup = false;
      if (!readOnly) {
        const allMessages = messageList.get.all.db();
        const unobservedMessages = this.engine.getUnobservedMessages(allMessages, record);
        const otherThreadTokens = unobservedContextBlocks
          ? this.engine.tokenCounter.countString(unobservedContextBlocks)
          : 0;
        const currentObservationTokens = record.observationTokenCount ?? 0;

        const { totalPendingTokens, threshold, effectiveObservationTokensThreshold } =
          await this.calculateObservationThresholds(
            allMessages,
            unobservedMessages,
            0,
            otherThreadTokens,
            currentObservationTokens,
            record,
          );

        // Calculate buffered chunk tokens to subtract from threshold checking
        const bufferedChunks = this.engine.getBufferedChunks(record);
        const bufferedChunkTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
        const unbufferedPendingTokens = Math.max(0, totalPendingTokens - bufferedChunkTokens);

        // Merge sealed IDs from processor state with static sealed IDs
        const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();
        const lockKey = this.engine.getLockKey(threadId, resourceId);
        const bufKey = this.engine.getObservationBufferKey(lockKey);
        const staticSealed = ObservationalMemory.sealedMessageIds.get(bufKey);
        if (staticSealed) {
          for (const id of staticSealed) {
            sealedIds.add(id);
          }
        }
        state.sealedIds = sealedIds;

        omDebug(
          `[OM:step] step=${stepNumber}: totalPending=${totalPendingTokens}, unbuffered=${unbufferedPendingTokens}, threshold=${threshold}, bufferedChunkTokens=${bufferedChunkTokens}, sealedIds=${sealedIds.size}`,
        );

        // Trigger async buffered observation if enabled and threshold interval crossed
        // IMPORTANT: Use totalPendingTokens for interval checking (shouldTrigger), but
        // unbufferedPendingTokens for the actual buffering context window (startAsyncBufferedObservation).
        // totalPendingTokens determines which interval we're in, unbuffered is how many tokens
        // need to be processed (excluding already-buffered content).
        if (this.engine.isAsyncObservationEnabled()) {
          const shouldTrigger = this.shouldTriggerAsyncObservation(totalPendingTokens, lockKey, record, threshold);
          omDebug(
            `[OM:async-obs] pending=${totalPendingTokens}, unbuffered=${unbufferedPendingTokens}, threshold=${threshold}, shouldTrigger=${shouldTrigger}, isBufferingObs=${record.isBufferingObservation}, lastBufferedAt=${ObservationalMemory.lastBufferedBoundary.get(bufKey) ?? 0}`,
          );
          if (shouldTrigger) {
            void this.engine.startAsyncBufferedObservation(
              record,
              threadId,
              unobservedMessages,
              lockKey,
              writer,
              unbufferedPendingTokens,
              requestContext,
            );
          }
        }

        if (stepNumber > 0) {
          // Per-step save: persist messages incrementally
          await this.handlePerStepSave(messageList, sealedIds, threadId, resourceId, state);

          if (totalPendingTokens >= threshold) {
            reproCaptureDetails.thresholdReached = true;
            omDebug(
              `[OM:threshold] step=${stepNumber}: totalPending=${totalPendingTokens} >= threshold=${threshold}, triggering observation`,
            );

            const { observationSucceeded, updatedRecord, activatedMessageIds } = await this.handleThresholdReached(
              messageList,
              record,
              threadId,
              resourceId,
              threshold,
              lockKey,
              writer,
              abortSignal,
              abort,
              requestContext,
            );

            if (observationSucceeded) {
              didThresholdCleanup = true;

              // Determine which message IDs to use for cleanup
              const observedIds = activatedMessageIds ?? updatedRecord.observedMessageIds ?? [];

              // Calculate retention floor for cleanup
              const minRemaining = resolveRetentionFloor(
                this.engine.observationConfig.bufferActivation ?? 1,
                threshold,
              );

              reproCaptureDetails.thresholdCleanup = {
                observationSucceeded,
                observedIdsCount: observedIds.length,
                observedIds: observedIds.map((id: string) => id.slice(0, 8)),
                minRemaining,
                updatedRecordObservedIds: updatedRecord.observedMessageIds?.length ?? 0,
              };

              omDebug(`[OM:cleanup] observedIds=${observedIds.length}, minRemaining=${minRemaining}`);

              // Clean up observed messages from context
              await this.cleanupAfterObservation(
                messageList,
                sealedIds,
                threadId,
                resourceId,
                state,
                observedIds,
                minRemaining,
              );

              // Clean up static maps for activated IDs
              if (activatedMessageIds && activatedMessageIds.length > 0) {
                this.engine.cleanupStaticMaps(threadId, resourceId, activatedMessageIds);
              }

              // Reset lastBufferedBoundary after threshold activation
              if (this.engine.isAsyncObservationEnabled()) {
                ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
                await this.engine.storage.setBufferingObservationFlag(updatedRecord.id, false, 0).catch(() => {});
              }

              record = updatedRecord;
            }
          }
        }

        // ════════════════════════════════════════════════════════════════════════
        // STEP 3: INJECT OBSERVATIONS & FILTER ALREADY-OBSERVED MESSAGES
        // ════════════════════════════════════════════════════════════════════════
        await this.injectObservationsIntoContext(
          messageList,
          record,
          threadId,
          resourceId,
          unobservedContextBlocks,
          requestContext,
        );

        if (!didThresholdCleanup) {
          // Filter out messages that have already been observed (only if we didn't just do cleanup)
          await this.filterAlreadyObservedMessages(messageList, record, {
            useMarkerBoundaryPruning: stepNumber === 0,
          });
        }

        // ════════════════════════════════════════════════════════════════════════
        // STEP 4: EMIT PROGRESS & PERSIST TOKENS
        // ════════════════════════════════════════════════════════════════════════
        const freshRecord = await this.engine.getOrCreateRecord(threadId, resourceId);
        const contextMessages = messageList.get.all.db().filter(m => m.id !== 'om-continuation' && m.role !== 'system');
        const freshUnobservedTokens = await this.engine.tokenCounter.countMessagesAsync(contextMessages);
        const finalOtherThreadTokens = unobservedContextBlocks
          ? this.engine.tokenCounter.countString(unobservedContextBlocks)
          : 0;
        const finalTotalPending = freshUnobservedTokens + finalOtherThreadTokens;

        await this.emitStepProgress(
          writer,
          threadId,
          resourceId,
          stepNumber,
          freshRecord,
          {
            totalPendingTokens: finalTotalPending,
            threshold,
            effectiveObservationTokensThreshold,
          },
          freshRecord.observationTokenCount ?? 0,
        );

        await this.engine.storage.setPendingMessageTokens(freshRecord.id, finalTotalPending).catch(() => {});

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
            postBufferedChunks: this.engine.getBufferedChunks(freshRecord),
            postContextTokenCount: finalTotalPending,
            messageList,
            details: reproCaptureDetails,
            debug: omDebug,
          });
        }
      }

      return messageList;
    });
  }

  /**
   * Save any unsaved messages at the end of the agent turn.
   *
   * This is the "final save" that catches messages that processInputStep didn't save
   * (e.g., when the observation threshold was never reached, or on single-step execution).
   * Without this, messages would be lost because MessageHistory is disabled when OM is active.
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, state: _state } = args;
    // Default state to {} for backward compat with older @mastra/core that doesn't pass state
    const state = _state ?? ({} as Record<string, unknown>);

    const context = this.engine.getThreadContext(requestContext, messageList);
    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    return this.engine.runWithTokenCounterModelContext(
      state.__omActorModelContext as TokenCounterModelContext | undefined,
      async () => {
        // Check if readOnly
        const memoryContext = parseMemoryRequestContext(requestContext);
        const readOnly = memoryContext?.memoryConfig?.readOnly;
        if (readOnly) {
          return messageList;
        }

        // Final save: persist any messages that weren't saved during per-step saves
        // (e.g., the final assistant response after the last processInputStep)
        const newInput = messageList.get.input.db();
        const newOutput = messageList.get.response.db();
        const messagesToSave = [...newInput, ...newOutput];

        omDebug(
          `[OM:processOutputResult] threadId=${threadId}, inputMsgs=${newInput.length}, responseMsgs=${newOutput.length}, totalToSave=${messagesToSave.length}, allMsgsInList=${messageList.get.all.db().length}`,
        );

        if (messagesToSave.length === 0) {
          omDebug(`[OM:processOutputResult] nothing to save — all messages were already saved during per-step saves`);
          return messageList;
        }

        const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();

        omDebug(
          `[OM:processOutputResult] saving ${messagesToSave.length} messages, sealedIds=${sealedIds.size}, ids=${messagesToSave.map(m => m.id?.slice(0, 8)).join(',')}`,
        );
        await this.engine.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
        omDebug(
          `[OM:processOutputResult] saved successfully, finalIds=${messagesToSave.map(m => m.id?.slice(0, 8)).join(',')}`,
        );

        return messageList;
      },
    );
  }

  // ─── Orchestration methods (moved from engine) ────────────────────────────
  // These methods compose engine primitives to implement agent lifecycle
  // orchestration. They decide *when* to observe, reflect, save, and clean up.

  /**
   * Load historical unobserved messages into the message list (step 0 only).
   * In resource scope, loads only current thread's messages.
   * In thread scope, loads all unobserved messages for the thread.
   */
  private async loadHistoricalMessagesIfNeeded(
    messageList: MessageList,
    state: Record<string, unknown>,
    threadId: string,
    resourceId: string | undefined,
    lastObservedAt: Date | undefined,
  ): Promise<void> {
    if (state.initialSetupDone) {
      return;
    }
    state.initialSetupDone = true;

    if (this.engine.scope === 'resource' && resourceId) {
      // RESOURCE SCOPE: Load only the current thread's historical messages.
      // Other threads' unobserved context is loaded fresh each step
      // to reflect the latest lastObservedAt cursors after observations.
      const currentThreadMessages = await this.engine.loadUnobservedMessages(threadId, undefined, lastObservedAt);

      for (const msg of currentThreadMessages) {
        if (msg.role !== 'system') {
          if (!this.engine.hasUnobservedParts(msg) && this.engine.findLastCompletedObservationBoundary(msg) !== -1) {
            continue;
          }
          messageList.add(msg, 'memory');
        }
      }
    } else {
      // THREAD SCOPE: Load unobserved messages using resource-level lastObservedAt
      const historicalMessages = await this.engine.loadUnobservedMessages(threadId, resourceId, lastObservedAt);

      if (historicalMessages.length > 0) {
        for (const msg of historicalMessages) {
          if (msg.role !== 'system') {
            if (!this.engine.hasUnobservedParts(msg) && this.engine.findLastCompletedObservationBoundary(msg) !== -1) {
              continue;
            }
            messageList.add(msg, 'memory');
          }
        }
      }
    }
  }

  /**
   * Load unobserved messages from other threads (not the current thread) for a resource.
   * Called fresh each step so it reflects the latest lastObservedAt cursors
   * after observations complete.
   */
  private async loadOtherThreadsContext(resourceId: string, currentThreadId: string): Promise<string | undefined> {
    const { threads: allThreads } = await this.engine.storage.listThreads({ filter: { resourceId } });

    const messagesByThread = new Map<string, MastraDBMessage[]>();

    for (const thread of allThreads) {
      // Skip current thread — its messages are already in messageList
      if (thread.id === currentThreadId) continue;

      const omMetadata = getThreadOMMetadata(thread.metadata);
      const threadLastObservedAt = omMetadata?.lastObservedAt;
      const startDate = threadLastObservedAt ? new Date(new Date(threadLastObservedAt).getTime() + 1) : undefined;

      const result = await this.engine.storage.listMessages({
        threadId: thread.id,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate ? { dateRange: { start: startDate } } : undefined,
      });

      // Filter out messages already observed in this instance's lifetime
      const filtered = result.messages.filter(m => !this.engine.observedMessageIds.has(m.id));

      if (filtered.length > 0) {
        messagesByThread.set(thread.id, filtered);
      }
    }

    if (messagesByThread.size === 0) return undefined;

    const blocks = await this.engine.formatUnobservedContextBlocks(messagesByThread, currentThreadId);
    return blocks || undefined;
  }

  /**
   * Calculate all threshold-related values for observation decision making.
   */
  private async calculateObservationThresholds(
    _allMessages: MastraDBMessage[],
    unobservedMessages: MastraDBMessage[],
    _pendingTokens: number,
    otherThreadTokens: number,
    currentObservationTokens: number,
    _record?: ObservationalMemoryRecord,
  ): Promise<{
    totalPendingTokens: number;
    threshold: number;
    effectiveObservationTokensThreshold: number;
    isSharedBudget: boolean;
  }> {
    // Count only unobserved messages for threshold checking.
    // Already-observed messages may still be in the messageList (the AI SDK
    // repopulates it each step), but they shouldn't count toward the threshold
    // since they've already been captured in observations.
    const contextWindowTokens = await this.engine.tokenCounter.countMessagesAsync(unobservedMessages);

    // Total pending = unobserved in-context tokens + other threads
    const totalPendingTokens = Math.max(0, contextWindowTokens + otherThreadTokens);

    const threshold = calculateDynamicThreshold(this.engine.observationConfig.messageTokens, currentObservationTokens);

    // Calculate effective reflection threshold for UI display
    // When adaptive threshold is enabled, both thresholds share a budget
    const baseReflectionThreshold = getMaxThreshold(this.engine.reflectionConfig.observationTokens);
    const isSharedBudget = typeof this.engine.observationConfig.messageTokens !== 'number';
    const totalBudget = isSharedBudget
      ? (this.engine.observationConfig.messageTokens as { min: number; max: number }).max
      : 0;
    const effectiveObservationTokensThreshold = isSharedBudget
      ? Math.max(totalBudget - threshold, 1000)
      : baseReflectionThreshold;
    return {
      totalPendingTokens,
      threshold,
      effectiveObservationTokensThreshold,
      isSharedBudget,
    };
  }

  /**
   * Check if we've crossed a new bufferTokens interval boundary.
   * Returns true if async buffering should be triggered.
   */
  private shouldTriggerAsyncObservation(
    currentTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
    messageTokensThreshold?: number,
  ): boolean {
    if (!this.engine.isAsyncObservationEnabled()) return false;

    // Don't start a new buffer if one is already in progress
    if (record.isBufferingObservation) {
      if (isOpActiveInProcess(record.id, 'bufferingObservation')) return false;
      // Flag is stale (from a crashed process) — clear it and allow new buffering
      omDebug(`[OM:shouldTriggerAsyncObs] isBufferingObservation=true but stale, clearing`);
      this.engine.storage.setBufferingObservationFlag(record.id, false).catch(() => {});
    }

    // Also check in-memory state for the current instance (protects within a single request)
    const bufferKey = this.engine.getObservationBufferKey(lockKey);
    if (this.engine.isAsyncBufferingInProgress(bufferKey)) return false;

    const bufferTokens = this.engine.observationConfig.bufferTokens!;
    // Use the higher of persisted DB value or in-memory value.
    // DB value survives instance recreation; in-memory value is set immediately
    // when buffering starts (before the DB write completes).
    const dbBoundary = record.lastBufferedAtTokens ?? 0;
    const memBoundary = ObservationalMemory.lastBufferedBoundary.get(bufferKey) ?? 0;
    const lastBoundary = Math.max(dbBoundary, memBoundary);

    // Halve the buffer interval when within ~1 bufferTokens of the activation threshold.
    // This produces finer-grained chunks right before activation, improving boundary selection.
    const rampPoint = messageTokensThreshold ? messageTokensThreshold - bufferTokens * 1.1 : Infinity;
    const effectiveBufferTokens = currentTokens >= rampPoint ? bufferTokens / 2 : bufferTokens;

    // Calculate which interval we're in
    const currentInterval = Math.floor(currentTokens / effectiveBufferTokens);
    const lastInterval = Math.floor(lastBoundary / effectiveBufferTokens);

    const shouldTrigger = currentInterval > lastInterval;

    omDebug(
      `[OM:shouldTriggerAsyncObs] tokens=${currentTokens}, bufferTokens=${bufferTokens}, effectiveBufferTokens=${effectiveBufferTokens}, rampPoint=${rampPoint}, currentInterval=${currentInterval}, lastInterval=${lastInterval}, lastBoundary=${lastBoundary} (db=${dbBoundary}, mem=${memBoundary}), shouldTrigger=${shouldTrigger}`,
    );

    // Trigger if we've crossed into a new interval
    return shouldTrigger;
  }

  /**
   * Check if async reflection buffering should be triggered.
   * Triggers once when observation tokens reach `threshold * bufferActivation`.
   * Only allows one buffered reflection at a time.
   */
  private shouldTriggerAsyncReflection(
    currentObservationTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
  ): boolean {
    if (!this.engine.isAsyncReflectionEnabled()) return false;

    // Don't re-trigger if buffering is already in progress
    if (record.isBufferingReflection) {
      if (isOpActiveInProcess(record.id, 'bufferingReflection')) return false;
      // Flag is stale (from a crashed process) — clear it and allow new buffering
      omDebug(`[OM:shouldTriggerAsyncRefl] isBufferingReflection=true but stale, clearing`);
      this.engine.storage.setBufferingReflectionFlag(record.id, false).catch(() => {});
    }

    // Also check in-memory state for the current instance
    const bufferKey = this.engine.getReflectionBufferKey(lockKey);
    if (this.engine.isAsyncBufferingInProgress(bufferKey)) return false;
    if (ObservationalMemory.lastBufferedBoundary.has(bufferKey)) return false;

    // Don't re-trigger if the record already has a buffered reflection
    if (record.bufferedReflection) return false;

    // Check if we've crossed the activation threshold
    const reflectThreshold = getMaxThreshold(this.engine.reflectionConfig.observationTokens);
    const activationPoint = reflectThreshold * this.engine.reflectionConfig.bufferActivation!;

    const shouldTrigger = currentObservationTokens >= activationPoint;
    omDebug(
      `[OM:shouldTriggerAsyncRefl] obsTokens=${currentObservationTokens}, reflThreshold=${reflectThreshold}, activationPoint=${activationPoint}, bufferActivation=${this.engine.reflectionConfig.bufferActivation}, shouldTrigger=${shouldTrigger}, isBufferingRefl=${record.isBufferingReflection}, hasBufferedReflection=${!!record.bufferedReflection}`,
    );

    return shouldTrigger;
  }

  /**
   * Check if we need to trigger reflection.
   */
  private shouldReflect(observationTokens: number): boolean {
    const threshold = getMaxThreshold(this.engine.reflectionConfig.observationTokens);
    return observationTokens > threshold;
  }

  /**
   * Emit debug event and stream progress part for UI feedback.
   */
  private async emitStepProgress(
    writer: ProcessInputStepArgs['writer'],
    threadId: string,
    resourceId: string | undefined,
    stepNumber: number,
    record: ObservationalMemoryRecord,
    thresholds: {
      totalPendingTokens: number;
      threshold: number;
      effectiveObservationTokensThreshold: number;
    },
    currentObservationTokens: number,
  ): Promise<void> {
    const { totalPendingTokens, threshold, effectiveObservationTokensThreshold } = thresholds;

    this.engine.emitDebugEvent({
      type: 'step_progress',
      timestamp: new Date(),
      threadId,
      resourceId: resourceId ?? '',
      stepNumber,
      finishReason: 'unknown',
      pendingTokens: totalPendingTokens,
      threshold,
      thresholdPercent: Math.round((totalPendingTokens / threshold) * 100),
      willSave: totalPendingTokens >= threshold,
      willObserve: totalPendingTokens >= threshold,
    });

    if (writer) {
      // Calculate buffered chunk totals for UI
      const bufferedChunks = this.engine.getBufferedChunks(record);
      const bufferedObservationTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);

      // chunk.messageTokens represents the token count of raw messages that will be
      // removed from the context window when the chunk activates (lastObservedAt advances).
      // Cap at totalPendingTokens so the UI never shows a reduction larger than the window.
      const rawBufferedMessageTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
      const bufferedMessageTokens = Math.min(rawBufferedMessageTokens, totalPendingTokens);

      // Calculate projected message removal based on activation ratio and chunk boundaries
      // This replicates the logic in swapBufferedToActive without actually activating
      const projectedMessageRemoval = calculateProjectedMessageRemoval(
        bufferedChunks,
        this.engine.observationConfig.bufferActivation ?? 1,
        getMaxThreshold(this.engine.observationConfig.messageTokens),
        totalPendingTokens,
      );

      // Determine observation buffering status
      let obsBufferStatus: 'idle' | 'running' | 'complete' = 'idle';
      if (record.isBufferingObservation) {
        obsBufferStatus = 'running';
      } else if (bufferedChunks.length > 0) {
        obsBufferStatus = 'complete';
      }

      // Determine reflection buffering status
      let refBufferStatus: 'idle' | 'running' | 'complete' = 'idle';
      if (record.isBufferingReflection) {
        refBufferStatus = 'running';
      } else if (record.bufferedReflection && record.bufferedReflection.length > 0) {
        refBufferStatus = 'complete';
      }

      const statusPart: DataOmStatusPart = {
        type: 'data-om-status',
        data: {
          windows: {
            active: {
              messages: {
                tokens: totalPendingTokens,
                threshold,
              },
              observations: {
                tokens: currentObservationTokens,
                threshold: effectiveObservationTokensThreshold,
              },
            },
            buffered: {
              observations: {
                chunks: bufferedChunks.length,
                messageTokens: bufferedMessageTokens,
                projectedMessageRemoval,
                observationTokens: bufferedObservationTokens,
                status: obsBufferStatus,
              },
              reflection: {
                inputObservationTokens: record.bufferedReflectionInputTokens ?? 0,
                observationTokens: record.bufferedReflectionTokens ?? 0,
                status: refBufferStatus,
              },
            },
          },
          recordId: record.id,
          threadId,
          stepNumber,
          generationCount: record.generationCount,
        },
      };
      omDebug(
        `[OM:status] step=${stepNumber} msgs=${totalPendingTokens}/${threshold} obs=${currentObservationTokens}/${effectiveObservationTokensThreshold} bufObs={chunks=${bufferedChunks.length},msgTok=${bufferedMessageTokens},obsTok=${bufferedObservationTokens},status=${obsBufferStatus}} bufRef={inTok=${record.bufferedReflectionInputTokens ?? 0},outTok=${record.bufferedReflectionTokens ?? 0},status=${refBufferStatus}} gen=${record.generationCount}`,
      );
      await writer.custom(statusPart).catch(() => {
        // Ignore errors if stream is closed
      });
    }
  }

  /**
   * Handle observation when threshold is reached.
   * Tries async activation first if enabled, then falls back to sync observation.
   * Returns whether observation succeeded.
   */
  private async handleThresholdReached(
    messageList: MessageList,
    record: ObservationalMemoryRecord,
    threadId: string,
    resourceId: string | undefined,
    threshold: number,
    lockKey: string,
    writer: ProcessInputStepArgs['writer'],
    abortSignal: ProcessInputStepArgs['abortSignal'],
    abort: ProcessInputStepArgs['abort'],
    requestContext?: RequestContext,
  ): Promise<{
    observationSucceeded: boolean;
    updatedRecord: ObservationalMemoryRecord;
    activatedMessageIds?: string[];
  }> {
    let observationSucceeded = false;
    let updatedRecord = record;
    let activatedMessageIds: string[] | undefined;

    await this.engine.withLock(lockKey, async () => {
      let freshRecord = await this.engine.getOrCreateRecord(threadId, resourceId);
      const freshAllMessages = messageList.get.all.db();
      let freshUnobservedMessages = this.engine.getUnobservedMessages(freshAllMessages, freshRecord);

      // Re-check threshold inside the lock using only unobserved messages.
      // Already-observed messages may still be in the messageList but shouldn't
      // count toward the threshold since they've been captured in observations.
      const freshContextTokens = await this.engine.tokenCounter.countMessagesAsync(freshUnobservedMessages);
      let freshOtherThreadTokens = 0;
      if (this.engine.scope === 'resource' && resourceId) {
        const freshOtherContext = await this.loadOtherThreadsContext(resourceId, threadId);
        freshOtherThreadTokens = freshOtherContext ? this.engine.tokenCounter.countString(freshOtherContext) : 0;
      }
      const freshTotal = freshContextTokens + freshOtherThreadTokens;
      omDebug(
        `[OM:threshold] handleThresholdReached (inside lock): freshTotal=${freshTotal}, threshold=${threshold}, freshUnobserved=${freshUnobservedMessages.length}, freshOtherThreadTokens=${freshOtherThreadTokens}, freshCurrentTokens=${freshContextTokens}`,
      );
      if (freshTotal < threshold) {
        omDebug(`[OM:threshold] freshTotal < threshold, bailing out`);
        return;
      }

      // Snapshot lastObservedAt BEFORE observation runs.
      const preObservationTime = freshRecord.lastObservedAt?.getTime() ?? 0;

      // Try to activate buffered observations first (instant activation)
      let activationResult: {
        success: boolean;
        updatedRecord?: ObservationalMemoryRecord;
        messageTokensActivated?: number;
        activatedMessageIds?: string[];
        suggestedContinuation?: string;
        currentTask?: string;
      } = { success: false };
      if (this.engine.isAsyncObservationEnabled()) {
        // Wait for any in-flight async buffering to complete first
        const bufferKey = this.engine.getObservationBufferKey(lockKey);
        const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
        if (asyncOp) {
          try {
            // Wait for buffering to complete (with reasonable timeout)
            await Promise.race([
              asyncOp,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
            ]);
          } catch {
            // Timeout or error - proceed with what we have
          }
        }

        // Re-fetch record after waiting for async op
        const recordAfterWait = await this.engine.getOrCreateRecord(threadId, resourceId);
        const chunksAfterWait = this.engine.getBufferedChunks(recordAfterWait);
        omDebug(
          `[OM:threshold] tryActivation: chunksAvailable=${chunksAfterWait.length}, isBufferingObs=${recordAfterWait.isBufferingObservation}`,
        );

        activationResult = await this.engine.tryActivateBufferedObservations(
          recordAfterWait,
          lockKey,
          freshTotal,
          writer,
          messageList,
        );
        omDebug(`[OM:threshold] activationResult: success=${activationResult.success}`);
        if (activationResult.success) {
          // Activation succeeded - the buffered observations are now active.
          // Trust the activation and return success immediately.
          // The activated chunks have already been moved to activeObservations.
          observationSucceeded = true;
          updatedRecord = activationResult.updatedRecord ?? recordAfterWait;
          activatedMessageIds = activationResult.activatedMessageIds;

          omDebug(
            `[OM:threshold] activation succeeded, obsTokens=${updatedRecord.observationTokenCount}, activeObsLen=${updatedRecord.activeObservations?.length}`,
          );

          // Propagate continuation hints from activation to thread metadata.
          // Explicitly write undefined when omitted so stale values are cleared.
          const thread = await this.engine.storage.getThreadById({ threadId });
          if (thread) {
            const newMetadata = setThreadOMMetadata(thread.metadata, {
              suggestedResponse: activationResult.suggestedContinuation,
              currentTask: activationResult.currentTask,
            });
            await this.engine.storage.updateThread({
              id: threadId,
              title: thread.title ?? '',
              metadata: newMetadata,
            });
          }

          // Note: lastBufferedBoundary is updated by the caller AFTER cleanupAfterObservation
          // removes the activated messages from messageList and recounts the actual context size.

          // Check if async reflection should be triggered or activated.
          // This only does async work (background buffering or instant activation) —
          // never blocking sync reflection that could overwrite freshly activated observations.
          await this.maybeAsyncReflect(
            updatedRecord,
            updatedRecord.observationTokenCount ?? 0,
            writer,
            messageList,
            requestContext,
          );
          return;
        }

        // When async observation is enabled, don't fall through to synchronous observation
        // unless blockAfter is set and we've exceeded it.
        if (this.engine.observationConfig.blockAfter && freshTotal >= this.engine.observationConfig.blockAfter) {
          omDebug(
            `[OM:threshold] blockAfter exceeded (${freshTotal} >= ${this.engine.observationConfig.blockAfter}), falling through to sync observation`,
          );
          // blockAfter exceeded — fall through to synchronous observation as a last resort.
          // Re-fetch unobserved messages since activation may have changed things.
          freshRecord = await this.engine.getOrCreateRecord(threadId, resourceId);
          const refreshedAll = messageList.get.all.db();
          freshUnobservedMessages = this.engine.getUnobservedMessages(refreshedAll, freshRecord);
        } else {
          omDebug(`[OM:threshold] activation failed, no blockAfter or below it — letting async buffering catch up`);
          // Below blockAfter (or no blockAfter set) — let async buffering catch up.
          return;
        }
      }

      if (freshUnobservedMessages.length > 0) {
        try {
          if (this.engine.scope === 'resource' && resourceId) {
            await this.engine.doResourceScopedObservation({
              record: freshRecord,
              currentThreadId: threadId,
              resourceId,
              currentThreadMessages: freshUnobservedMessages,
              writer,
              abortSignal,
              requestContext,
            });
          } else {
            await this.engine.doSynchronousObservation({
              record: freshRecord,
              threadId,
              unobservedMessages: freshUnobservedMessages,
              writer,
              abortSignal,
              requestContext,
            });
          }
          // Check if observation actually updated lastObservedAt
          updatedRecord = await this.engine.getOrCreateRecord(threadId, resourceId);
          const updatedTime = updatedRecord.lastObservedAt?.getTime() ?? 0;
          observationSucceeded = updatedTime > preObservationTime;
        } catch (error) {
          if (abortSignal?.aborted) {
            abort('Agent execution was aborted');
          } else {
            abort(
              `Encountered error during memory observation ${error instanceof Error ? error.message : JSON.stringify(error, null, 2)}`,
            );
          }
          // abort() throws, so this line is only reached if abort doesn't throw
        }
      }
    });

    return { observationSucceeded, updatedRecord, activatedMessageIds };
  }

  /**
   * Remove observed messages from message list after successful observation.
   * Accepts optional observedMessageIds for activation-based cleanup (when no markers are present).
   */
  private async cleanupAfterObservation(
    messageList: MessageList,
    sealedIds: Set<string>,
    threadId: string,
    resourceId: string | undefined,
    state: Record<string, unknown>,
    observedMessageIds?: string[],
    minRemaining?: number,
  ): Promise<void> {
    const allMsgs = messageList.get.all.db();
    let markerIdx = -1;
    let markerMsg: MastraDBMessage | null = null;

    // Find the last observation end marker
    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (!msg) continue;
      if (this.engine.findLastCompletedObservationBoundary(msg) !== -1) {
        markerIdx = i;
        markerMsg = msg;
        break;
      }
    }

    omDebug(
      `[OM:cleanupBranch] allMsgs=${allMsgs.length}, markerFound=${markerIdx !== -1}, markerIdx=${markerIdx}, observedMessageIds=${observedMessageIds?.length ?? 'undefined'}, allIds=${allMsgs.map(m => m.id?.slice(0, 8)).join(',')}`,
    );

    if (observedMessageIds && observedMessageIds.length > 0) {
      // Activation-based cleanup: remove activated message IDs first.
      // This path must take precedence over marker cleanup so absolute retention
      // floors are enforced during buffered activation.
      const observedSet = new Set(observedMessageIds);
      const idsToRemove = new Set<string>();
      const removalOrder: string[] = [];
      let skipped = 0;
      let backoffTriggered = false;
      const retentionCounter = typeof minRemaining === 'number' ? new TokenCounter() : null;

      for (const msg of allMsgs) {
        if (!msg?.id || msg.id === 'om-continuation' || !observedSet.has(msg.id)) {
          continue;
        }

        const unobservedParts = this.engine.getUnobservedParts(msg);
        const totalParts = msg.content?.parts?.length ?? 0;

        // Activation can target a message ID whose observed boundary is inside the same message.
        // In that case, keep the fresh tail visible to the model instead of removing the whole message.
        if (unobservedParts.length > 0 && unobservedParts.length < totalParts) {
          msg.content.parts = unobservedParts;
          continue;
        }

        if (retentionCounter && typeof minRemaining === 'number') {
          const nextRemainingMessages = allMsgs.filter(
            m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id) && m.id !== msg.id,
          );
          const remainingIfRemoved = retentionCounter.countMessages(nextRemainingMessages);
          if (remainingIfRemoved < minRemaining) {
            skipped += 1;
            backoffTriggered = true;
            break;
          }
        }

        idsToRemove.add(msg.id);
        removalOrder.push(msg.id);
      }

      if (retentionCounter && typeof minRemaining === 'number' && idsToRemove.size > 0) {
        let remainingMessages = allMsgs.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
        let remainingTokens = retentionCounter.countMessages(remainingMessages);

        while (remainingTokens < minRemaining && removalOrder.length > 0) {
          const restoreId = removalOrder.pop()!;
          idsToRemove.delete(restoreId);
          skipped += 1;
          backoffTriggered = true;
          remainingMessages = allMsgs.filter(m => m?.id && m.id !== 'om-continuation' && !idsToRemove.has(m.id));
          remainingTokens = retentionCounter.countMessages(remainingMessages);
        }
      }

      omDebug(
        `[OM:cleanupActivation] observedSet=${[...observedSet].map(id => id.slice(0, 8)).join(',')}, matched=${idsToRemove.size}, skipped=${skipped}, backoffTriggered=${backoffTriggered}, idsToRemove=${[...idsToRemove].map(id => id.slice(0, 8)).join(',')}`,
      );

      // Remove activated messages from context. No need to re-save — these were
      // already persisted by handlePerStepSave or runAsyncBufferedObservation.
      const idsToRemoveList = [...idsToRemove];
      if (idsToRemoveList.length > 0) {
        messageList.removeByIds(idsToRemoveList);
        omDebug(
          `[OM:cleanupActivation] removed ${idsToRemoveList.length} messages, remaining=${messageList.get.all.db().length}`,
        );
      }
    } else if (markerMsg && markerIdx !== -1) {
      // Collect all messages before the marker (these are fully observed)
      const idsToRemove: string[] = [];
      const messagesToSave: MastraDBMessage[] = [];

      for (let i = 0; i < markerIdx; i++) {
        const msg = allMsgs[i];
        if (msg?.id && msg.id !== 'om-continuation') {
          idsToRemove.push(msg.id);
          messagesToSave.push(msg);
        }
      }

      // Also include the marker message itself in the save
      messagesToSave.push(markerMsg);

      // Filter marker message to only unobserved parts
      const unobservedParts = this.engine.getUnobservedParts(markerMsg);
      if (unobservedParts.length === 0) {
        // Marker message is fully observed — remove it too
        if (markerMsg.id) {
          idsToRemove.push(markerMsg.id);
        }
      } else if (unobservedParts.length < (markerMsg.content?.parts?.length ?? 0)) {
        // Trim marker message to only unobserved parts (in-place)
        markerMsg.content.parts = unobservedParts;
      }

      // Remove observed messages from context FIRST, before saveMessagesWithSealedIdTracking
      // which may mutate msg.id for sealed messages (causing removeByIds to miss them).
      if (idsToRemove.length > 0) {
        messageList.removeByIds(idsToRemove);
      }

      // Save all observed messages (with their markers) to DB
      if (messagesToSave.length > 0) {
        await this.engine.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
      }
    } else {
      // No marker found — save current input/response messages first, then clear.
      // Keeping them in MessageList until save finishes avoids brief under-inclusion windows
      // where fresh-next-turn context can disappear during async persistence.
      const newInput = messageList.get.input.db();
      const newOutput = messageList.get.response.db();
      const messagesToSave = [...newInput, ...newOutput];
      if (messagesToSave.length > 0) {
        await this.engine.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
      }
    }

    // Clear any remaining input/response tracking
    messageList.clear.input.db();
    messageList.clear.response.db();
  }

  /**
   * Handle per-step save when threshold is not reached.
   * Persists messages incrementally to prevent data loss on interruption.
   */
  private async handlePerStepSave(
    messageList: MessageList,
    sealedIds: Set<string>,
    threadId: string,
    resourceId: string | undefined,
    state: Record<string, unknown>,
  ): Promise<void> {
    const newInput = messageList.clear.input.db();
    const newOutput = messageList.clear.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    omDebug(
      `[OM:handlePerStepSave] cleared input=${newInput.length}, response=${newOutput.length}, toSave=${messagesToSave.length}, ids=${messagesToSave.map(m => m.id?.slice(0, 8)).join(',')}`,
    );

    if (messagesToSave.length > 0) {
      await this.engine.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);

      // Re-add messages to context so the agent can still see them
      for (const msg of messagesToSave) {
        messageList.add(msg, 'memory');
      }
    }
  }

  /**
   * Inject observations as system message and add continuation reminder.
   */
  private async injectObservationsIntoContext(
    messageList: MessageList,
    record: ObservationalMemoryRecord,
    threadId: string,
    resourceId: string | undefined,
    unobservedContextBlocks: string | undefined,
    requestContext: ProcessInputStepArgs['requestContext'],
  ): Promise<void> {
    const thread = await this.engine.storage.getThreadById({ threadId });
    const threadOMMetadata = getThreadOMMetadata(thread?.metadata);
    const currentTask = threadOMMetadata?.currentTask;
    const suggestedResponse = threadOMMetadata?.suggestedResponse;
    const rawCurrentDate = requestContext?.get('currentDate');
    const currentDate =
      rawCurrentDate instanceof Date
        ? rawCurrentDate
        : typeof rawCurrentDate === 'string'
          ? new Date(rawCurrentDate)
          : new Date();

    if (!record.activeObservations) {
      return;
    }

    const observationSystemMessage = this.engine.formatObservationsForContext(
      record.activeObservations,
      currentTask,
      suggestedResponse,
      unobservedContextBlocks,
      currentDate,
    );

    // Clear any existing observation system message and add fresh one
    messageList.clearSystemMessages('observational-memory');
    messageList.addSystem(observationSystemMessage, 'observational-memory');

    // Add continuation reminder
    const continuationMessage: MastraDBMessage = {
      id: `om-continuation`,
      role: 'user',
      createdAt: new Date(0),
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>`,
          },
        ],
      },
      threadId,
      resourceId,
    };
    messageList.add(continuationMessage, 'memory');
  }

  /**
   * Filter out already-observed messages from the in-memory context.
   *
   * Marker-boundary pruning is safest at step 0 (historical resume/rebuild), where
   * list ordering mirrors persisted history.
   * For step > 0, the list may include mid-loop mutations (sealing/splitting/trim),
   * so we prefer record-based fallback pruning over position-based marker pruning.
   */
  private async filterAlreadyObservedMessages(
    messageList: MessageList,
    record?: ObservationalMemoryRecord,
    options?: { useMarkerBoundaryPruning?: boolean },
  ): Promise<void> {
    const allMessages = messageList.get.all.db();
    const useMarkerBoundaryPruning = options?.useMarkerBoundaryPruning ?? true;
    const fallbackCursor = record?.threadId
      ? getThreadOMMetadata((await this.engine.storage.getThreadById({ threadId: record.threadId }))?.metadata)
          ?.lastObservedMessageCursor
      : undefined;

    // Find the message with the last observation end marker
    let markerMessageIndex = -1;
    let markerMessage: MastraDBMessage | null = null;

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      if (!msg) continue;
      if (this.engine.findLastCompletedObservationBoundary(msg) !== -1) {
        markerMessageIndex = i;
        markerMessage = msg;
        break;
      }
    }

    if (useMarkerBoundaryPruning && markerMessage && markerMessageIndex !== -1) {
      const messagesToRemove: string[] = [];
      for (let i = 0; i < markerMessageIndex; i++) {
        const msg = allMessages[i];
        if (msg?.id && msg.id !== 'om-continuation') {
          messagesToRemove.push(msg.id);
        }
      }

      if (messagesToRemove.length > 0) {
        messageList.removeByIds(messagesToRemove);
      }

      // Filter marker message to only unobserved parts
      const unobservedParts = this.engine.getUnobservedParts(markerMessage);
      if (unobservedParts.length === 0) {
        if (markerMessage.id) {
          messageList.removeByIds([markerMessage.id]);
        }
      } else if (unobservedParts.length < (markerMessage.content?.parts?.length ?? 0)) {
        markerMessage.content.parts = unobservedParts;
      }
    } else if (record) {
      // No observation markers found (e.g., after buffered activation).
      // Fall back to record-based filtering: remove messages that are already
      // captured in observations (via lastObservedAt timestamp or observedMessageIds).
      // This prevents context overflow on session resume after buffered activation.
      const observedIds = new Set<string>(Array.isArray(record.observedMessageIds) ? record.observedMessageIds : []);
      // NOTE: Do NOT add buffered chunk messageIds here. Buffered messages are NOT yet
      // observed — they're staged for future activation. They must remain in context
      // for the LLM to see. Only observedMessageIds and lastObservedAt determine what's
      // been truly observed.

      const derivedCursor =
        fallbackCursor ??
        this.engine.getLastObservedMessageCursor(
          allMessages.filter(msg => !!msg?.id && observedIds.has(msg.id) && !!msg.createdAt),
        );
      const lastObservedAt = record.lastObservedAt;
      const messagesToRemove: string[] = [];

      for (const msg of allMessages) {
        if (!msg?.id || msg.id === 'om-continuation') continue;

        if (observedIds.has(msg.id)) {
          messagesToRemove.push(msg.id);
          continue;
        }

        if (derivedCursor && this.engine.isMessageAtOrBeforeCursor(msg, derivedCursor)) {
          messagesToRemove.push(msg.id);
          continue;
        }

        // Remove if created before lastObservedAt (these messages' content is
        // already captured in activeObservations via buffered activation)
        if (lastObservedAt && msg.createdAt) {
          const msgDate = new Date(msg.createdAt);
          if (msgDate <= lastObservedAt) {
            messagesToRemove.push(msg.id);
          }
        }
      }

      if (messagesToRemove.length > 0) {
        messageList.removeByIds(messagesToRemove);
      }
    }
  }

  /**
   * Check if async reflection should be triggered or activated.
   * Only handles the async path — will never do synchronous (blocking) reflection.
   * Safe to call after buffered observation activation.
   */
  private async maybeAsyncReflect(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    writer?: ProcessorStreamWriter,
    messageList?: MessageList,
    requestContext?: RequestContext,
  ): Promise<void> {
    if (!this.engine.isAsyncReflectionEnabled()) return;

    const lockKey = this.engine.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = getMaxThreshold(this.engine.reflectionConfig.observationTokens);

    omDebug(
      `[OM:reflect] maybeAsyncReflect: observationTokens=${observationTokens}, reflectThreshold=${reflectThreshold}, isReflecting=${record.isReflecting}, bufferedReflection=${record.bufferedReflection ? 'present (' + record.bufferedReflection.length + ' chars)' : 'empty'}, recordId=${record.id}, genCount=${record.generationCount}`,
    );

    // Below threshold: trigger background buffering if at the right interval
    if (observationTokens < reflectThreshold) {
      const shouldTrigger = this.shouldTriggerAsyncReflection(observationTokens, lockKey, record);
      omDebug(`[OM:reflect] below threshold: shouldTrigger=${shouldTrigger}`);
      if (shouldTrigger) {
        this.engine.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
      }
      return;
    }

    // At/above threshold: try to activate buffered reflection
    if (record.isReflecting) {
      if (isOpActiveInProcess(record.id, 'reflecting')) {
        omDebug(`[OM:reflect] skipping - actively reflecting in this process`);
        return;
      }
      omDebug(`[OM:reflect] isReflecting=true but stale (not active in this process), clearing`);
      await this.engine.storage.setReflectingFlag(record.id, false);
    }

    omDebug(`[OM:reflect] at/above threshold, trying activation...`);
    const activationSuccess = await this.engine.tryActivateBufferedReflection(record, lockKey, writer, messageList);
    omDebug(`[OM:reflect] activationSuccess=${activationSuccess}`);
    if (activationSuccess) return;

    // No buffered reflection available — start one now in the background.
    // This can happen when observations jump past the threshold via activation
    // without any background reflection having been triggered beforehand.
    omDebug(`[OM:reflect] no buffered reflection, starting background reflection...`);
    this.engine.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
  }

  // ─── Passthrough API (for resolveProcessorById consumers) ───────────────

  /**
   * Synchronous config summary. Passthrough to engine.
   */
  get config(): {
    scope: 'resource' | 'thread';
    observation: { messageTokens: number | ThresholdRange };
    reflection: { observationTokens: number | ThresholdRange };
  } {
    return this.engine.config;
  }

  /**
   * Wait for any in-flight async buffering operations.
   * Passthrough to engine.
   */
  async waitForBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    timeoutMs = 30000,
  ): Promise<void> {
    return this.engine.waitForBuffering(threadId, resourceId, timeoutMs);
  }

  /**
   * Get the full config with resolved model names.
   * Passthrough to engine.
   */
  async getResolvedConfig(requestContext?: RequestContext) {
    return this.engine.getResolvedConfig(requestContext);
  }

  /**
   * Static helper to await buffering without an engine instance.
   */
  static async awaitBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    scope: 'thread' | 'resource',
    timeoutMs = 30000,
  ): Promise<void> {
    // Delegate to the engine's static method
    const { ObservationalMemory } = await import('./observational-memory');
    return ObservationalMemory.awaitBuffering(threadId, resourceId, scope, timeoutMs);
  }
}
