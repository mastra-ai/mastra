import { getThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import { filterObservedMessages } from '../message-utils';
import { getLastActivityFromMessages, getLatestStepParts } from '../observational-memory';
import { resolveRetentionFloor } from '../thresholds';

import type { ObservationTurn } from './turn';
import type { StepContext } from './types';

/**
 * Represents a single step in the agentic loop within an observation turn.
 *
 * Created via `turn.step(stepNumber)`. Call `prepare()` before the agent generates.
 * The previous step's output is finalized automatically when the next step is created
 * or when `turn.end()` is called.
 */
export class ObservationStep {
  private _prepared = false;
  private _context?: StepContext;

  constructor(
    private readonly turn: ObservationTurn,
    readonly stepNumber: number,
  ) {}

  /** Whether this step has been prepared. */
  get prepared() {
    return this._prepared;
  }

  /** Step context from prepare(). Throws if prepare() hasn't been called. */
  get context(): StepContext {
    if (!this._context) throw new Error('Step not prepared yet — call prepare() first');
    return this._context;
  }

  /**
   * Prepare this step for agent generation.
   *
   * For step 0: activates buffered chunks, checks reflection, builds system message, filters observed.
   * For step > 0: checks thresholds, triggers buffer/observe, saves previous messages,
   * builds system message, filters observed.
   */
  async prepare(): Promise<StepContext> {
    if (this._prepared) throw new Error(`Step ${this.stepNumber} already prepared`);

    const { threadId, resourceId, messageList } = this.turn;
    // Cast to any for internal access to private OM methods (Turn/Step are internal consumers)
    const om = this.turn.om;
    let activated = false;
    let observed = false;
    let buffered = false;
    let reflected = false;
    let didThresholdCleanup = false;
    let observerExchange: StepContext['observerExchange'];

    // ── Step 0: Activate buffered chunks ──────────────────────
    if (this.stepNumber === 0) {
      const step0Messages = messageList.get.all.db();
      const activation = await om.activate({
        threadId,
        resourceId,
        checkThreshold: true,
        messages: step0Messages,
        currentModel: this.turn.actorModelContext,
        writer: this.turn.writer,
        messageList,
      });

      if (activation.activated) {
        activated = true;
        if (activation.activatedMessageIds?.length) {
          messageList.removeByIds(activation.activatedMessageIds);
        }
        await om.resetBufferingState({
          threadId,
          resourceId,
          recordId: activation.record.id,
        });
        await this.turn.refreshRecord();
      }

      // Check if reflection is needed (whether or not activation happened).
      // maybeReflect handles both sync (above full threshold) and async buffered
      // reflection (above bufferActivation point but below full threshold).
      const record = this.turn.record;
      const preReflectGeneration = record.generationCount;
      const obsTokens = record.observationTokenCount ?? 0;
      await om.reflector.maybeReflect({
        record,
        observationTokens: obsTokens,
        threadId,
        writer: this.turn.writer,
        messageList,
        currentModel: this.turn.actorModelContext,
        requestContext: this.turn.requestContext,
        observabilityContext: this.turn.observabilityContext,
        lastActivityAt: getLastActivityFromMessages(messageList.get.all.db()),
      });
      await this.turn.refreshRecord();
      if (this.turn.record.generationCount > preReflectGeneration) {
        reflected = true;
      }
    }

    // ── Check for incomplete tool calls ────────────────────────
    // Provider-executed tools (e.g. Anthropic web_search) may still be in state:'call'
    // while the agent loop continues. We must not observe/buffer until they complete.
    const allMsgsForToolCheck = messageList.get.all.db();
    const lastMessage = allMsgsForToolCheck[allMsgsForToolCheck.length - 1];
    const pendingStepMessages = [...messageList.get.input.db(), ...messageList.get.response.db()];
    const latestStepParts = [
      ...getLatestStepParts(lastMessage?.content?.parts ?? []),
      ...pendingStepMessages.flatMap(msg => getLatestStepParts(msg.content?.parts ?? [])),
    ];
    const hasIncompleteToolCalls = latestStepParts.some(
      part => part?.type === 'tool-invocation' && (part as any).toolInvocation?.state === 'call',
    );
    omDebug(
      `[OM:deferred-check] hasIncompleteToolCalls=${hasIncompleteToolCalls}, latestStepPartsCount=${latestStepParts.length}`,
    );

    // ── Check thresholds + buffer trigger (all steps) ──────────
    let statusSnapshot = await om.getStatus({
      threadId,
      resourceId,
      messages: messageList.get.all.db(),
    });

    // Trigger buffering if interval boundary crossed (fire-and-forget, all steps)
    if (statusSnapshot.shouldBuffer && !hasIncompleteToolCalls) {
      const allMessages = messageList.get.all.db();
      const unobservedMessages = om.getUnobservedMessages(allMessages, statusSnapshot.record);

      // Seal, rotate, and persist candidates SYNCHRONOUSLY before the fire-and-forget
      // buffer call. The beforeBuffer callback inside buffer() only runs deep in its
      // async chain (after multiple awaits). Meanwhile, the step > 0 save below drains
      // response messages synchronously. If sealing/rotation happens after that drain,
      // the sealed messages get re-added as memory (unsealed) and all new content keeps
      // appending to the same assistant message — producing the "mega-message" bug.
      const candidates = om.getUnobservedMessages(unobservedMessages, statusSnapshot.record, {
        excludeBuffered: true,
      });
      if (candidates.length > 0) {
        om.sealMessagesForBuffering(candidates);

        try {
          await this.turn.hooks?.onBufferChunkSealed?.();
        } catch (error) {
          omDebug(
            `[OM:buffer] onBufferChunkSealed hook failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        if (this.turn.memory) {
          await this.turn.memory.persistMessages(candidates);
        }

        // Once a buffered chunk has been sealed and persisted, it should no longer
        // remain in the live response/input buckets. Move the exact same messages
        // into memory so later step-save drains don't pull them back out and grow
        // them again under the old response id.
        messageList.removeByIds(candidates.map(msg => msg.id));
        for (const msg of candidates) {
          messageList.add(msg, 'memory');
        }
      }

      void om
        .buffer({
          threadId,
          resourceId,
          messages: unobservedMessages,
          pendingTokens: statusSnapshot.pendingTokens,
          record: statusSnapshot.record,
          writer: this.turn.writer,
          requestContext: this.turn.requestContext,
          observabilityContext: this.turn.observabilityContext,
        })
        .catch((err: Error) => {
          omDebug(`[OM:buffer] fire-and-forget buffer failed: ${err?.message}`);
        });
      buffered = true;
    }

    // ── Step > 0: Save messages + threshold observation ──────
    if (this.stepNumber > 0) {
      // Save messages from previous step
      const newInput = messageList.clear.input.db();
      const newOutput = messageList.clear.response.db();
      const messagesToSave = [...newInput, ...newOutput];
      if (messagesToSave.length > 0) {
        await om.persistMessages(messagesToSave, threadId, resourceId);
        for (const msg of messagesToSave) {
          messageList.add(msg, 'memory');
        }
      }

      // Threshold observation (step > 0 only, skip if tool calls pending)
      if (statusSnapshot.shouldObserve && !hasIncompleteToolCalls) {
        const preObsGeneration = this.turn.record.generationCount;
        const obsResult = await this.runThresholdObservation();
        observerExchange = obsResult.observerExchange;
        if (obsResult.succeeded) {
          observed = true;
          didThresholdCleanup = true;

          // Cleanup after observation
          const observedIds = obsResult.activatedMessageIds ?? obsResult.record.observedMessageIds ?? [];
          const minRemaining = resolveRetentionFloor(
            om.getObservationConfig().bufferActivation ?? 1,
            statusSnapshot.threshold,
          );

          await om.cleanupMessages({
            threadId,
            resourceId,
            messages: messageList,
            observedMessageIds: observedIds,
            retentionFloor: minRemaining,
          });

          if (statusSnapshot.asyncObservationEnabled) {
            await om.resetBufferingState({
              threadId,
              resourceId,
              recordId: obsResult.record.id,
              activatedMessageIds: obsResult.activatedMessageIds,
            });
          }

          await this.turn.refreshRecord();
          if (this.turn.record.generationCount > preObsGeneration) {
            reflected = true;
          }
        }
      }

      // Re-fetch status after observation/cleanup for the snapshot
      statusSnapshot = await om.getStatus({
        threadId,
        resourceId,
        messages: messageList.get.all.db(),
      });
    }

    // ── Refresh cross-thread context (resource scope) ──────────
    const otherThreadsContext = await this.turn.refreshOtherThreadsContext();

    // ── Build system messages (one per cache-stable chunk) ────
    const systemMessage = await om.buildContextSystemMessages({
      threadId,
      resourceId,
      record: this.turn.record,
      unobservedContextBlocks: otherThreadsContext,
    });

    // ── Filter observed messages ──────────────────────────────
    if (!didThresholdCleanup) {
      const fallbackCursor = this.turn.record.threadId
        ? getThreadOMMetadata((await om.getStorage().getThreadById({ threadId: this.turn.record.threadId }))?.metadata)
            ?.lastObservedMessageCursor
        : undefined;

      filterObservedMessages({
        messageList,
        record: this.turn.record,
        useMarkerBoundaryPruning: this.stepNumber === 0,
        fallbackCursor,
      });
    }

    this._context = {
      systemMessage,
      observerExchange,
      activated,
      observed,
      buffered,
      reflected,
      status: {
        pendingTokens: statusSnapshot.pendingTokens,
        threshold: statusSnapshot.threshold,
        effectiveObservationTokensThreshold: statusSnapshot.effectiveObservationTokensThreshold,
        shouldObserve: statusSnapshot.shouldObserve,
        shouldBuffer: statusSnapshot.shouldBuffer,
        shouldReflect: statusSnapshot.shouldReflect,
        canActivate: statusSnapshot.canActivate,
      },
    };
    this._prepared = true;
    return this._context;
  }

  /**
   * Run the full threshold observation pipeline:
   * waitForBuffering → re-check → activate → reflect → blockAfter gate → observe
   */
  private async runThresholdObservation(): Promise<{
    succeeded: boolean;
    record: any;
    activatedMessageIds?: string[];
    observerExchange?: StepContext['observerExchange'];
  }> {
    const { threadId, resourceId, messageList } = this.turn;
    const om = this.turn.om;

    // Wait for any in-flight buffering to settle
    await om.waitForBuffering(threadId, resourceId);

    // Re-check status with fresh state
    const freshStatus = await om.getStatus({
      threadId,
      resourceId,
      messages: messageList.get.all.db(),
    });

    if (!freshStatus.shouldObserve) {
      return { succeeded: false, record: freshStatus.record };
    }

    // Try activation first if buffered chunks exist
    if (freshStatus.canActivate) {
      const activation = await om.activate({
        threadId,
        resourceId,
        messages: messageList.get.all.db(),
        currentModel: this.turn.actorModelContext,
        writer: this.turn.writer,
        messageList,
      });

      if (activation.activated) {
        // Check reflection after activation — use maybeReflect so that a
        // completed buffered reflection is activated instantly instead of
        // running a redundant sync reflection from scratch.
        const postActivationRecord = activation.record;
        await om.reflector.maybeReflect({
          record: postActivationRecord,
          observationTokens: postActivationRecord.observationTokenCount ?? 0,
          threadId,
          writer: this.turn.writer,
          messageList,
          currentModel: this.turn.actorModelContext,
          requestContext: this.turn.requestContext,
          observabilityContext: this.turn.observabilityContext,
          lastActivityAt: getLastActivityFromMessages(messageList.get.all.db()),
        });

        return {
          succeeded: true,
          record: activation.record,
          activatedMessageIds: activation.activatedMessageIds,
        };
      }
    }

    // Sync observation — we've waited for buffering and tried activation,
    // if we're still above threshold we must observe synchronously.
    const obsResult = await om.observe({
      threadId,
      resourceId,
      messages: messageList.get.all.db(),
      requestContext: this.turn.requestContext,
      writer: this.turn.writer,
      observabilityContext: this.turn.observabilityContext,
    });

    if (obsResult.observed) {
      const observedMessageIds = new Set(obsResult.record.observedMessageIds ?? []);
      const liveMessages = messageList.get.all.db();
      let latestObservedIndex = -1;

      for (let i = liveMessages.length - 1; i >= 0; i--) {
        const message = liveMessages[i];
        if (message && observedMessageIds.has(message.id)) {
          latestObservedIndex = i;
          break;
        }
      }

      const messageToSeal = latestObservedIndex >= 0 ? liveMessages[latestObservedIndex] : undefined;
      const messagesToSeal = messageToSeal ? [messageToSeal] : [];
      om.sealMessagesForBuffering(messagesToSeal);

      try {
        await this.turn.hooks?.onSyncObservationComplete?.();
      } catch (error) {
        omDebug(
          `[OM:observe] onSyncObservationComplete hook failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (messagesToSeal.length > 0) {
        await om.persistMessages(messagesToSeal, threadId, resourceId);
      }
    }

    return {
      succeeded: obsResult.observed,
      record: obsResult.record,
      observerExchange: om.observer.lastExchange,
    };
  }
}
