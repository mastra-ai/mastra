import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { parseMemoryRequestContext, setThreadOMMetadata } from '@mastra/core/memory';
import type { Processor, ProcessInputStepArgs, ProcessOutputResultArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import { ObservationalMemory, omDebug } from './observational-memory';
import { isOmReproCaptureEnabled, safeCaptureJson, writeProcessInputStepReproCapture } from './repro-capture';
import { calculateDynamicThreshold, getMaxThreshold, resolveRetentionFloor } from './thresholds';
import type { TokenCounterModelContext } from './token-counter';
import type { ThresholdRange } from './types';

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
      await this.engine.loadHistoricalMessagesIfNeeded(messageList, state, threadId, resourceId, record.lastObservedAt);

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1b: LOAD OTHER THREADS' UNOBSERVED CONTEXT (resource scope, every step)
      // ════════════════════════════════════════════════════════════════════════
      let unobservedContextBlocks: string | undefined;
      if (this.engine.scope === 'resource' && resourceId) {
        unobservedContextBlocks = await this.engine.loadOtherThreadsContext(resourceId, threadId);
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
          if (dbBoundary > currentContextTokens) {
            omDebug(
              `[OM:step0-boundary-reset] dbBoundary=${dbBoundary} > currentContext=${currentContextTokens}, resetting to current`,
            );
            ObservationalMemory.lastBufferedBoundary.set(bufKey, currentContextTokens);
            this.engine.storage.setBufferingObservationFlag(record.id, false, currentContextTokens).catch(() => {});
          }
        }

        if (bufferedChunks.length > 0) {
          // Compute threshold to check if activation is warranted
          const allMsgsForCheck = messageList.get.all.db();
          const unobservedMsgsForCheck = this.engine.getUnobservedMessages(allMsgsForCheck, record);
          const otherThreadTokensForCheck = unobservedContextBlocks
            ? this.engine.tokenCounter.countString(unobservedContextBlocks)
            : 0;
          const currentObsTokensForCheck = record.observationTokenCount ?? 0;
          const { totalPendingTokens: step0PendingTokens, threshold: step0Threshold } =
            await this.engine.calculateObservationThresholds(
              allMsgsForCheck,
              unobservedMsgsForCheck,
              0, // pendingTokens not needed — allMessages covers context
              otherThreadTokensForCheck,
              currentObsTokensForCheck,
              record,
            );

          // Activate buffered chunks at step 0 if:
          // - We're at or above the regular observation threshold (buffers are needed)
          // Use the regular threshold, not blockAfter — blockAfter gates synchronous observation,
          // but activating already-buffered chunks is cheap (no LLM call) and prevents chunks
          // from piling up in single-step turns that never reach step > 0.
          omDebug(
            `[OM:step0-activation] pendingTokens=${step0PendingTokens}, threshold=${step0Threshold}, blockAfter=${this.engine.observationConfig.blockAfter}, shouldActivate=${step0PendingTokens >= step0Threshold}, allMsgs=${allMsgsForCheck.length}`,
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
              messageTokensActivated: activationResult.messageTokensActivated ?? 0,
              activatedMessageIds: activationResult.activatedMessageIds ?? [],
              hadUpdatedRecord: !!activationResult.updatedRecord,
            };

            if (activationResult.success && activationResult.updatedRecord) {
              record = activationResult.updatedRecord;

              // Remove activated messages from context using activatedMessageIds.
              // Note: swapBufferedToActive does NOT populate record.observedMessageIds
              // (intentionally — recycled IDs would block future content).
              // filterAlreadyObservedMessages runs later at step 0 and uses lastObservedAt
              // as a fallback, but we do explicit removal here for immediate effect.
              const activatedIds = activationResult.activatedMessageIds ?? [];
              if (activatedIds.length > 0) {
                const activatedSet = new Set(activatedIds);
                const allMsgs = messageList.get.all.db();
                const idsToRemove = allMsgs
                  .filter(msg => msg?.id && msg.id !== 'om-continuation' && activatedSet.has(msg.id))
                  .map(msg => msg.id);

                if (idsToRemove.length > 0) {
                  messageList.removeByIds(idsToRemove);
                }
              }

              // Clean up sealed IDs for activated messages (prevents memory leak)
              this.engine.cleanupStaticMaps(threadId, resourceId, activatedIds);

              // Reset lastBufferedBoundary to 0 after activation so that any
              // remaining unbuffered messages in context can trigger a new buffering
              // interval. The worst case is one no-op trigger if all remaining messages
              // are already in buffered chunks.
              const bufKey = this.engine.getObservationBufferKey(lockKey);
              ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
              this.engine.storage.setBufferingObservationFlag(record.id, false, 0).catch(() => {});

              // Propagate continuation hints from activation to thread metadata so
              // injectObservationsIntoContext can include them immediately.
              // Explicitly write undefined when omitted so stale values are cleared.
              const thread = await this.engine.storage.getThreadById({ threadId });
              if (thread) {
                const activatedSet = new Set(activationResult.activatedMessageIds ?? []);
                const activatedMessages = messageList.get.all.db().filter(msg => msg?.id && activatedSet.has(msg.id));
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

              // Check if reflection should be triggered or activated
              await this.engine.maybeReflect({
                record,
                observationTokens: record.observationTokenCount ?? 0,
                threadId,
                writer,
                messageList,
                requestContext,
              });
              // Re-fetch record — reflection may have created a new generation with lower obsTokens
              record = await this.engine.getOrCreateRecord(threadId, resourceId);
            }
          }
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 1d: REFLECTION CHECK (step 0 only)
      // If observation tokens are already over the reflection threshold when the
      // conversation starts (e.g. from a previous session), trigger reflection.
      // This covers the case where no buffered observation activation happened above.
      // Safe because reflection carries over lastObservedAt — unobserved messages won't be lost.
      // Also triggers async buffered reflection if above the activation point but
      // below the full threshold (e.g. after a crash lost a previous reflection attempt).
      // ════════════════════════════════════════════════════════════════════════
      if (stepNumber === 0 && !readOnly) {
        const obsTokens = record.observationTokenCount ?? 0;
        if (this.engine.shouldReflect(obsTokens)) {
          omDebug(`[OM:step0-reflect] obsTokens=${obsTokens} over reflectThreshold, triggering reflection`);
          await this.engine.maybeReflect({
            record,
            observationTokens: obsTokens,
            threadId,
            writer,
            messageList,
            requestContext,
          });
          // Re-fetch record after reflection may have created a new generation
          record = await this.engine.getOrCreateRecord(threadId, resourceId);
        } else if (this.engine.isAsyncReflectionEnabled()) {
          // Below full threshold but maybe above activation point — try async reflection
          const lockKey = this.engine.getLockKey(threadId, resourceId);
          if (this.engine.shouldTriggerAsyncReflection(obsTokens, lockKey, record)) {
            omDebug(`[OM:step0-reflect] obsTokens=${obsTokens} above activation point, triggering async reflection`);
            await this.engine.maybeAsyncReflect(record, obsTokens, writer, messageList, requestContext);
            record = await this.engine.getOrCreateRecord(threadId, resourceId);
          }
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 2: CHECK THRESHOLD AND OBSERVE IF NEEDED
      // ════════════════════════════════════════════════════════════════════════
      let didThresholdCleanup = false;
      if (!readOnly) {
        let allMessages = messageList.get.all.db();
        let unobservedMessages = this.engine.getUnobservedMessages(allMessages, record);
        const otherThreadTokens = unobservedContextBlocks
          ? this.engine.tokenCounter.countString(unobservedContextBlocks)
          : 0;
        let currentObservationTokens = record.observationTokenCount ?? 0;

        let thresholds = await this.engine.calculateObservationThresholds(
          allMessages,
          unobservedMessages,
          0, // pendingTokens not needed — allMessages covers context
          otherThreadTokens,
          currentObservationTokens,
          record,
        );
        let { totalPendingTokens, threshold } = thresholds;

        // Subtract already-buffered message tokens from the pending count for buffering decisions.
        // Buffered messages are "unobserved" (not yet in activeObservations) but have already been
        // sent to the observer — counting them would cause redundant buffering ops, especially
        // after activation resets lastBufferedBoundary to 0.
        // IMPORTANT: Use messageTokens (message tokens being removed), NOT tokenCount (observation tokens).
        let bufferedChunkTokens = this.engine
          .getBufferedChunks(record)
          .reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
        let unbufferedPendingTokens = Math.max(0, totalPendingTokens - bufferedChunkTokens);

        // Merge per-state sealedIds with static sealedMessageIds (survives across OM instances)
        const stateSealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();
        const staticSealedIds = ObservationalMemory.sealedMessageIds.get(threadId) ?? new Set<string>();
        const sealedIds = new Set<string>([...stateSealedIds, ...staticSealedIds]);
        state.sealedIds = sealedIds;
        const lockKey = this.engine.getLockKey(threadId, resourceId);

        // ════════════════════════════════════════════════════════════════════════
        // ASYNC BUFFERING: Trigger background observation at bufferTokens intervals
        // ════════════════════════════════════════════════════════════════════════

        if (this.engine.isAsyncObservationEnabled() && totalPendingTokens < threshold) {
          const shouldTrigger = this.engine.shouldTriggerAsyncObservation(
            totalPendingTokens,
            lockKey,
            record,
            threshold,
          );
          omDebug(
            `[OM:async-obs] belowThreshold: pending=${totalPendingTokens}, unbuffered=${unbufferedPendingTokens}, threshold=${threshold}, shouldTrigger=${shouldTrigger}, isBufferingObs=${record.isBufferingObservation}, lastBufferedAt=${record.lastBufferedAtTokens}`,
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
        } else if (this.engine.isAsyncObservationEnabled()) {
          // Above threshold but we still need to check async buffering:
          // - At step 0, sync observation won't run, so we need chunks ready
          // - Below blockAfter, sync observation won't run, so we need chunks ready
          const shouldTrigger = this.engine.shouldTriggerAsyncObservation(
            totalPendingTokens,
            lockKey,
            record,
            threshold,
          );
          omDebug(
            `[OM:async-obs] atOrAboveThreshold: pending=${totalPendingTokens}, unbuffered=${unbufferedPendingTokens}, threshold=${threshold}, step=${stepNumber}, shouldTrigger=${shouldTrigger}`,
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

        // ════════════════════════════════════════════════════════════════════════
        // PER-STEP SAVE: Always persist messages incrementally (step > 0)
        // Must run BEFORE threshold handling so that:
        // 1. Sealed messages get new IDs (preventing observedMessageIds collisions)
        // 2. Messages are persisted even when activation runs
        // ════════════════════════════════════════════════════════════════════════
        if (stepNumber > 0) {
          await this.engine.handlePerStepSave(messageList, sealedIds, threadId, resourceId, state);
        }

        // ════════════════════════════════════════════════════════════════════════
        // THRESHOLD REACHED: Observe and clean up
        // ════════════════════════════════════════════════════════════════════════
        if (stepNumber > 0 && totalPendingTokens >= threshold) {
          reproCaptureDetails.thresholdReached = true;
          const { observationSucceeded, updatedRecord, activatedMessageIds } = await this.engine.handleThresholdReached(
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
            // Use activatedMessageIds from chunk activation if available,
            // otherwise fall back to observedMessageIds from sync observation.
            // swapBufferedToActive does NOT populate record.observedMessageIds
            // (intentionally — recycled IDs would block future content),
            // so we pass activatedMessageIds directly for cleanup.
            const observedIds = activatedMessageIds?.length
              ? activatedMessageIds
              : Array.isArray(updatedRecord.observedMessageIds)
                ? updatedRecord.observedMessageIds
                : undefined;
            const minRemaining =
              typeof this.engine.observationConfig.bufferActivation === 'number'
                ? resolveRetentionFloor(this.engine.observationConfig.bufferActivation, threshold)
                : undefined;
            reproCaptureDetails.thresholdCleanup = {
              observationSucceeded,
              observedIdsCount: observedIds?.length ?? 0,
              observedIds,
              minRemaining,
              updatedRecordObservedIds: updatedRecord.observedMessageIds,
            };
            omDebug(
              `[OM:cleanup] observedIds=${observedIds?.length ?? 'undefined'}, ids=${observedIds?.join(',') ?? 'none'}, updatedRecord.observedMessageIds=${JSON.stringify(updatedRecord.observedMessageIds)}, minRemaining=${minRemaining ?? 'n/a'}`,
            );
            await this.engine.cleanupAfterObservation(
              messageList,
              sealedIds,
              threadId,
              resourceId,
              state,
              observedIds,
              minRemaining,
            );
            didThresholdCleanup = true;

            // Clean up sealed IDs for activated messages (prevents memory leak)
            if (activatedMessageIds?.length) {
              this.engine.cleanupStaticMaps(threadId, resourceId, activatedMessageIds);
            }

            // Reset lastBufferedBoundary to 0 after activation so that any
            // remaining unbuffered messages in context can trigger a new buffering
            // interval on the next step.
            if (this.engine.isAsyncObservationEnabled()) {
              const bufKey = this.engine.getObservationBufferKey(lockKey);
              ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
              this.engine.storage.setBufferingObservationFlag(updatedRecord.id, false, 0).catch(() => {});
              omDebug(`[OM:threshold] post-activation boundary reset to 0`);
            }
          }

          record = updatedRecord;
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 3: INJECT OBSERVATIONS INTO CONTEXT
      // ════════════════════════════════════════════════════════════════════════
      await this.engine.injectObservationsIntoContext(
        messageList,
        record,
        threadId,
        resourceId,
        unobservedContextBlocks,
        requestContext,
      );

      // ════════════════════════════════════════════════════════════════════════
      // STEP 4: FILTER OUT ALREADY-OBSERVED MESSAGES
      // - step 0: use marker-boundary pruning + record fallback (historical resume)
      // - step >0: use record fallback only (avoid position-based marker over-pruning mid-loop)
      // ════════════════════════════════════════════════════════════════════════
      // If step-level cleanup already ran after threshold handling, skip this pass to avoid
      // a second timestamp-based prune that can undercut retention-floor guarantees.
      if (!didThresholdCleanup) {
        await this.engine.filterAlreadyObservedMessages(messageList, record, {
          useMarkerBoundaryPruning: stepNumber === 0,
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // STEP 5: EMIT FINAL STATUS (after all observations/activations/reflections)
      // ════════════════════════════════════════════════════════════════════════
      {
        // Re-fetch record to capture any changes from observation/activation/reflection
        const freshRecord = await this.engine.getOrCreateRecord(threadId, resourceId);

        // Count tokens from messages actually in the context window.
        // We use messageList directly rather than getUnobservedMessages because after
        // activation, lastObservedAt advances to the chunk's timestamp which incorrectly
        // filters out messages that weren't part of the chunk but predate it.
        // messageList already has activated messages removed (step 1c), so it accurately
        // represents what's still in context.
        const contextMessages = messageList.get.all.db();
        const freshUnobservedTokens = await this.engine.tokenCounter.countMessagesAsync(contextMessages);
        const otherThreadTokens = unobservedContextBlocks
          ? this.engine.tokenCounter.countString(unobservedContextBlocks)
          : 0;
        const currentObservationTokens = freshRecord.observationTokenCount ?? 0;

        const threshold = calculateDynamicThreshold(
          this.engine.observationConfig.messageTokens,
          currentObservationTokens,
        );
        const baseReflectionThreshold = getMaxThreshold(this.engine.reflectionConfig.observationTokens);
        const isSharedBudget = typeof this.engine.observationConfig.messageTokens !== 'number';
        const totalBudget = isSharedBudget
          ? (this.engine.observationConfig.messageTokens as { min: number; max: number }).max
          : 0;
        const effectiveObservationTokensThreshold = isSharedBudget
          ? Math.max(totalBudget - threshold, 1000)
          : baseReflectionThreshold;

        const totalPendingTokens = freshUnobservedTokens + otherThreadTokens;

        await this.engine.emitStepProgress(
          writer,
          threadId,
          resourceId,
          stepNumber,
          freshRecord,
          {
            totalPendingTokens,
            threshold,
            effectiveObservationTokensThreshold,
          },
          currentObservationTokens,
        );

        // Persist the computed token count so the UI can display it on page load
        this.engine.storage.setPendingMessageTokens(freshRecord.id, totalPendingTokens).catch(() => {});

        if (reproCaptureEnabled && preRecordSnapshot && preMessagesSnapshot && preSerializedMessageList) {
          writeProcessInputStepReproCapture({
            threadId,
            resourceId,
            stepNumber,
            args,
            preRecord: preRecordSnapshot,
            postRecord: freshRecord,
            preMessages: preMessagesSnapshot,
            preBufferedChunks: this.engine.getBufferedChunks(preRecordSnapshot),
            preContextTokenCount: this.engine.tokenCounter.countMessages(preMessagesSnapshot),
            preSerializedMessageList,
            postBufferedChunks: this.engine.getBufferedChunks(freshRecord),
            postContextTokenCount: this.engine.tokenCounter.countMessages(contextMessages),
            messageList,
            details: {
              ...reproCaptureDetails,
              totalPendingTokens,
              threshold,
              effectiveObservationTokensThreshold,
              currentObservationTokens,
              otherThreadTokens,
              contextMessageCount: contextMessages.length,
            },
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
