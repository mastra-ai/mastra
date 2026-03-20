import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import { filterObservedMessages } from '../message-utils';
import { getLatestStepParts } from '../observational-memory';
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

    // ── Step 0: Activate buffered chunks ──────────────────────
    if (this.stepNumber === 0) {
      const step0Messages = messageList.get.all.db();
      const activation = await om.activate({
        threadId,
        resourceId,
        checkThreshold: true,
        messages: step0Messages,
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
      const obsTokens = record.observationTokenCount ?? 0;
      await om.reflector.maybeReflect({
        record,
        observationTokens: obsTokens,
        threadId,
        writer: this.turn.writer,
        requestContext: this.turn.requestContext,
      });
      await this.turn.refreshRecord();
    }

    // ── Check for incomplete tool calls ────────────────────────
    // Provider-executed tools (e.g. Anthropic web_search) may still be in state:'call'
    // while the agent loop continues. We must not observe/buffer until they complete.
    const allMsgsForToolCheck = messageList.get.all.db();
    const lastMessage = allMsgsForToolCheck[allMsgsForToolCheck.length - 1];
    const latestStepParts = getLatestStepParts(lastMessage?.content?.parts ?? []);
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

      void om
        .buffer({
          threadId,
          resourceId,
          messages: unobservedMessages,
          pendingTokens: statusSnapshot.pendingTokens,
          record: statusSnapshot.record,
          writer: this.turn.writer,
          requestContext: this.turn.requestContext,
          beforeBuffer: async (candidates: MastraDBMessage[]) => {
            om.sealMessagesForBuffering(candidates);
            if (this.turn.memory) {
              await this.turn.memory.persistMessages(candidates);
            }
          },
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
        const obsResult = await this.runThresholdObservation();
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
      });

      if (activation.activated) {
        // Check reflection after activation
        const postActivationStatus = await om.getStatus({
          threadId,
          resourceId,
          messages: messageList.get.all.db(),
        });
        if (postActivationStatus.shouldReflect) {
          await om.reflect(threadId, resourceId);
        }

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
    });

    return { succeeded: obsResult.observed, record: obsResult.record };
  }
}
