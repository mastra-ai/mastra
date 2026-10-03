import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import { isOmModelExecutionError } from '../error';
import { filterObservedMessages, getObservableMessages } from '../message-utils';
import { getLastActivityFromMessages, getLatestStepParts } from '../observational-memory';
import { resolveRetentionFloor } from '../thresholds';

import { selectSafeBufferPrefix } from './safe-buffer-prefix';
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
  /**
   * True when this step seeded an empty assistant response message for a step-0
   * observation. While set, the response-id rotation hook must NOT run — rotating
   * would orphan the seed (markers would sit on a message the agent never streams into).
   */
  private seededResponseMessage = false;

  constructor(
    private readonly turn: ObservationTurn,
    readonly stepNumber: number,
  ) {}

  /** Whether this step has been prepared. */
  get prepared() {
    return this._prepared;
  }

  /**
   * Serialize to a minimal, acyclic snapshot.
   *
   * The `turn` back-reference exists only so a step can read context off its parent turn at
   * runtime. It closes the `ObservationTurn._currentStep -> ObservationStep.turn` cycle, so
   * serializing it throws "Converting circular structure to JSON" (e.g. when a turn is stashed
   * in processor state that flows into a processor-workflow snapshot). The parent turn fully
   * owns the step, so omitting the back-reference is lossless.
   */
  toJSON() {
    return { stepNumber: this.stepNumber, prepared: this._prepared };
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

    const observationBufferKey = om.buffering.getObservationBufferKey(om.buffering.getLockKey(threadId, resourceId));
    // True while a background observation buffer op may still append a chunk — the only
    // phase activate() waits for (its chunk swap is read-then-write). The op's later
    // post-persist work (indexing, thread title) doesn't block activation.
    const isChunkWriteInFlight = () => om.buffering.isChunkWriteInProgress(observationBufferKey);

    // ── Step 0: Activate buffered chunks ──────────────────────
    // activate() waits for an in-flight chunk write. In the threshold→blockAfter band that
    // wait must not block the turn, so leave activation to a later step.
    // Reflection below still runs: it never waits on the observation op, and if it starts a
    // new generation the in-flight chunk is written to that generation, not the retired one.
    const step0Messages = this.stepNumber === 0 ? getObservableMessages(messageList) : [];
    const deferStep0Activation =
      this.stepNumber === 0 &&
      isChunkWriteInFlight() &&
      (await om.getStatus({ threadId, resourceId, record: this.turn.record, messages: step0Messages }))
        .inAsyncObservationBand;
    if (this.stepNumber === 0) {
      if (!deferStep0Activation) {
        const activation = await om.activate({
          threadId,
          resourceId,
          checkThreshold: true,
          messages: step0Messages,
          record: this.turn.record,
          currentModel: this.turn.actorModelContext,
          writer: this.turn.writer,
          messageList,
        });

        this.turn.setRecord(activation.record);
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
        lastActivityAt: getLastActivityFromMessages(getObservableMessages(messageList)),
        reflectionHooks: om.composeHooks(undefined, { threadId, resourceId, trigger: 'turn-sync' }),
        trigger: 'turn-sync',
      });
      await this.turn.refreshRecord();
      if (this.turn.record.generationCount > preReflectGeneration) {
        reflected = true;
      }
    }

    // ── Check for incomplete tool calls ────────────────────────
    // Tool calls (provider- or client-executed) may still be in state:'call'
    // while the agent loop continues. Threshold observation must not run until
    // they complete. Mid-loop buffering is NOT blocked here — it admits only
    // the safe completed prefix via selectSafeBufferPrefix below.
    const allMsgsForToolCheck = getObservableMessages(messageList);
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
      record: this.turn.record,
      messages: getObservableMessages(messageList),
    });

    if (
      statusSnapshot.inAsyncObservationBand &&
      !statusSnapshot.canActivate &&
      !hasIncompleteToolCalls &&
      !isChunkWriteInFlight()
    ) {
      // In the band without a chunk per the turn's cached record. A background buffer op
      // may have persisted its chunk since the record was cached; refresh once so a ready
      // chunk is activated instead of lingering behind a newly started buffer op.
      await this.turn.refreshRecord();
      statusSnapshot = await om.getStatus({
        threadId,
        resourceId,
        record: this.turn.record,
        messages: getObservableMessages(messageList),
      });
    }

    // In the threshold→blockAfter band with a chunk ready and no chunk write in flight,
    // activate this step instead of starting another buffer op: its chunk write would be
    // in flight by the activation check below and defer the ready chunk.
    const activateBeforeBuffering =
      statusSnapshot.inAsyncObservationBand &&
      statusSnapshot.canActivate &&
      !hasIncompleteToolCalls &&
      !isChunkWriteInFlight();

    // Trigger buffering if interval boundary crossed (fire-and-forget, all steps).
    // A pending tool call on the newest message doesn't block the whole batch:
    // admit only the safe prefix before it — the same policy idle buffering
    // applies at turn end (see selectSafeBufferPrefix).
    if (statusSnapshot.shouldBuffer && !activateBeforeBuffering) {
      const allMessages = getObservableMessages(messageList);
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
      const safeCandidates = selectSafeBufferPrefix(candidates);
      // Deferred = there were candidates but none can be buffered yet. Skip buffer()
      // entirely so the interval boundary isn't advanced and the next step retries.
      // When there simply are no candidates, still call buffer() (as before) so it
      // records the boundary and this interval doesn't re-trigger every step.
      const deferred = candidates.length > 0 && safeCandidates.length === 0;
      if (safeCandidates.length > 0) {
        om.sealMessagesForBuffering(safeCandidates);

        try {
          await this.turn.hooks?.onBufferChunkSealed?.();
        } catch (error) {
          omDebug(
            `[OM:buffer] onBufferChunkSealed hook failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        if (this.turn.memory) {
          await this.turn.memory.persistMessages(safeCandidates);
        }

        // Once a buffered chunk has been sealed and persisted, it should no longer
        // remain in the live response bucket. Move the exact same messages into
        // memory so later step-save drains don't pull them back out and grow them
        // again under the old response id. Input messages stay put: they don't grow,
        // and semantic recall embeds the turn's new user messages from the input bucket.
        const inputIds = new Set(messageList.get.input.db().map(msg => msg.id));
        const sealedOutput = safeCandidates.filter(msg => !inputIds.has(msg.id));
        messageList.removeByIds(sealedOutput.map(msg => msg.id));
        for (const msg of sealedOutput) {
          messageList.add(msg, 'memory');
        }
      }

      if (!deferred) {
        void om.trackBackgroundWork(
          om
            .buffer({
              threadId,
              resourceId,
              messages: safeCandidates,
              pendingTokens: statusSnapshot.pendingTokens,
              record: statusSnapshot.record,
              writer: this.turn.writer,
              agent: this.turn.agent,
              sendSignal: this.turn.sendSignal,
              sendStateSignal: this.turn.sendStateSignal,
              requestContext: this.turn.requestContext,
              observabilityContext: this.turn.observabilityContext,
            })
            .catch((err: Error) => {
              omDebug(`[OM:buffer] fire-and-forget buffer failed: ${err?.message}`);
            }),
        );
        buffered = true;
      }
    }

    // ── Save messages + threshold observation ──────
    // Historically gated to step > 0 (pre-async-buffering relic, 27d7398c51). A single
    // over-threshold message at step 0 hit neither the buffer path (shouldBuffer then required
    // pendingTokens < threshold) nor this one — the #16523 dead zone. Now the block also
    // runs at step 0, but ONLY when observation is imminent, so buckets aren't drained on
    // turns where nothing will fire.
    // In the threshold→blockAfter band nothing may block: run the threshold pipeline
    // only to activate an already-buffered chunk, and only when no chunk write is in
    // flight. activate() waits for an in-flight chunk write (that wait is what keeps its
    // read-then-write chunk swap from dropping a concurrently appended chunk), which
    // would turn the swap into a wait on the observer model. Otherwise defer to a later step.
    const bandDefersObservation =
      statusSnapshot.inAsyncObservationBand && (!statusSnapshot.canActivate || isChunkWriteInFlight());
    const willObserveNow = statusSnapshot.shouldObserve && !hasIncompleteToolCalls && !bandDefersObservation;
    /** In-flight message ids the step-0 cleanup must never remove from live context. */
    let step0PreserveIds: string[] | undefined;
    if (this.stepNumber > 0 || willObserveNow) {
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
      } else {
        // Step 0: persist pending input WITHOUT draining the buckets. The input bucket is
        // read downstream by consumers that only see single-step turns after this point —
        // semantic recall embeds `messageList.get.input.db()` and the durable loop reads
        // the first input message for task tracking — so draining here would silently
        // starve them. Persisting alone is enough for post-observation cleanup to operate
        // on stored state; persistMessages is an upsert, so the step > 0 drain re-saving
        // these messages later is harmless.
        const pending = [...messageList.get.input.db(), ...messageList.get.response.db()];
        if (pending.length > 0) {
          await om.persistMessages(pending, threadId, resourceId);
        }
        // The in-flight prompt was just observed, but the model still needs it to answer —
        // protect it (and everything else pending) from cleanup by identity rather than
        // relying on the token-based retention floor, which resolves to 0 for sync-only,
        // resource-scope, and explicit `bufferActivation: 1` configs.
        step0PreserveIds = pending.map(msg => msg.id);
      }

      // Step-0 observation: seed an empty assistant message under the active response id
      // (after the persist above so it isn't flushed empty). Lifecycle markers land on it
      // via streamMarker → persistMarkerToMessage (targets the last assistant message),
      // and the agent's real response streams into the same id afterwards — markers never
      // land on a user message (binding constraint from PR #16612 review).
      if (this.stepNumber === 0 && willObserveNow && this.turn.responseMessageId) {
        const seed: MastraDBMessage = {
          id: this.turn.responseMessageId,
          role: 'assistant',
          content: { format: 2, parts: [] },
          type: 'text',
          createdAt: new Date(),
          threadId,
          resourceId,
        };
        messageList.add(seed, 'response');
        this.seededResponseMessage = true;
        omDebug(`[OM:step0] seeded response message ${seed.id} for step-0 observation markers`);
      }

      // Threshold observation (skip if tool calls pending)
      if (willObserveNow) {
        const preObsGeneration = this.turn.record.generationCount;
        const obsResult = await this.runThresholdObservation(statusSnapshot.inAsyncObservationBand);
        observerExchange = obsResult.observerExchange;
        if (obsResult.succeeded) {
          observed = true;
          didThresholdCleanup = true;

          // Cleanup after observation. At step 0 the just-observed messages include the
          // fresh prompt the model is about to answer — preserve the in-flight messages
          // by identity (the token-based retention floor resolves to 0 for sync-only,
          // resource-scope, and explicit `bufferActivation: 1` configs, so it cannot be
          // relied on to keep them). Step > 0 semantics are unchanged.
          const observedIds = obsResult.cleanupMessageIds;
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
            preserveMessageIds: step0PreserveIds,
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
        record: this.turn.record,
        messages: getObservableMessages(messageList),
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

      const pendingMessageIds = new Set(
        [...messageList.get.input.db(), ...messageList.get.response.db()].map(msg => msg.id).filter(Boolean),
      );

      filterObservedMessages({
        messageList,
        record: this.turn.record,
        useMarkerBoundaryPruning: this.stepNumber === 0,
        fallbackCursor,
        preserveMessageIds: pendingMessageIds,
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
   * waitForBuffering → re-check → activate buffered chunks → reflect → observe
   * (sync fallback at blockAfter when async buffering is enabled)
   */
  private async runThresholdObservation(inAsyncObservationBand?: boolean): Promise<{
    succeeded: boolean;
    record: any;
    activatedMessageIds?: string[];
    /** Messages covered by this cycle (activated and/or sync-observed) to remove from context. */
    cleanupMessageIds: string[];
    observerExchange?: StepContext['observerExchange'];
  }> {
    const { threadId, resourceId, messageList } = this.turn;
    const om = this.turn.om;

    // Wait for any in-flight buffering to settle, then refresh the turn cache once.
    // In the threshold→blockAfter band this path is only entered to activate a ready
    // chunk with no chunk write in flight — skip the wait so a buffer op's post-persist
    // work or an in-flight reflection buffer op doesn't block the activation swap.
    if (!inAsyncObservationBand) {
      await om.waitForBuffering(threadId, resourceId);
    }
    await this.turn.refreshRecord();

    // A step-0 seeded response message exists ONLY as a marker anchor in the live list.
    // It must never be part of the observation input: the sync strategy records
    // opts.messages ids as observed and seals the newest message — either would
    // seal/consume the active response message the agent is about to stream into.
    // (Nothing mutates the list between here and the observe call, so compute once.)
    const observableMessages = this.seededResponseMessage
      ? getObservableMessages(messageList).filter(msg => msg.id !== this.turn.responseMessageId)
      : getObservableMessages(messageList);

    // Re-check status with fresh state
    let status = await om.getStatus({
      threadId,
      resourceId,
      record: this.turn.record,
      messages: observableMessages,
    });

    if (!status.shouldObserve) {
      return { succeeded: false, record: status.record, cleanupMessageIds: [] };
    }

    // A large batch may leave an uncovered tail after activation. Drain buffered
    // chunks before sync observation so their messages are not observed twice.
    let pendingMessages = observableMessages;
    const activatedMessageIds: string[] = [];
    let activated = false;
    while (status.shouldObserve && status.canActivate) {
      const activation = await om.activate({
        threadId,
        resourceId,
        record: this.turn.record,
        messages: pendingMessages,
        pendingTokens: status.pendingTokens,
        currentModel: this.turn.actorModelContext,
        writer: this.turn.writer,
        messageList,
      });
      this.turn.setRecord(activation.record);
      if (!activation.activated) {
        await this.turn.refreshRecord();
        status = await om.getStatus({
          threadId,
          resourceId,
          record: this.turn.record,
          messages: pendingMessages,
        });
        break;
      }

      activated = true;
      const ids = new Set(activation.activatedMessageIds ?? []);
      activatedMessageIds.push(...ids);
      pendingMessages = pendingMessages.filter(msg => !ids.has(msg.id));
      status = await om.getStatus({
        threadId,
        resourceId,
        record: this.turn.record,
        messages: pendingMessages,
      });
    }

    // A bounded activation wait can leave older chunks (or a late write) pending.
    // Defer rather than sync-observe newer messages and later roll the cursor back.
    // Keep prior activation cleanup, and don't reflect onto a new generation while
    // the stalled write still targets this one.
    const observationBufferKey = om.buffering.getObservationBufferKey(om.buffering.getLockKey(threadId, resourceId));
    if ((status.shouldObserve && status.canActivate) || om.buffering.isChunkWriteInProgress(observationBufferKey)) {
      return {
        succeeded: activated,
        record: this.turn.record,
        activatedMessageIds: activated ? activatedMessageIds : undefined,
        cleanupMessageIds: activatedMessageIds,
      };
    }

    if (activated) {
      // Check reflection after activation — use maybeReflect so that a
      // completed buffered reflection is activated instantly instead of
      // running a redundant sync reflection from scratch.
      const preReflectionRecord = this.turn.record;
      await om.reflector.maybeReflect({
        record: preReflectionRecord,
        observationTokens: preReflectionRecord.observationTokenCount ?? 0,
        threadId,
        writer: this.turn.writer,
        messageList,
        currentModel: this.turn.actorModelContext,
        requestContext: this.turn.requestContext,
        observabilityContext: this.turn.observabilityContext,
        lastActivityAt: getLastActivityFromMessages(getObservableMessages(messageList)),
        reflectionHooks: om.composeHooks(undefined, { threadId, resourceId, trigger: 'turn-sync' }),
        trigger: 'turn-sync',
      });
      await this.turn.refreshRecord();
      const postActivationRecord = this.turn.record;
      status = await om.getStatus({
        threadId,
        resourceId,
        record: postActivationRecord,
        messages: pendingMessages,
      });

      if (!status.shouldObserve) {
        return {
          succeeded: true,
          record: postActivationRecord,
          activatedMessageIds,
          cleanupMessageIds: activatedMessageIds,
        };
      }
    }

    if (
      status.inAsyncObservationBand ||
      status.canActivate ||
      om.buffering.isChunkWriteInProgress(observationBufferKey)
    ) {
      return {
        succeeded: activated,
        record: this.turn.record,
        activatedMessageIds: activated ? activatedMessageIds : undefined,
        cleanupMessageIds: activatedMessageIds,
      };
    }

    // Sync observation — activation left the remaining messages at/above blockAfter
    // (or async buffering is disabled).
    let obsResult;
    try {
      obsResult = await om.observe({
        threadId,
        resourceId,
        messages: pendingMessages,
        messageList,
        trigger: 'turn-sync',
        agent: this.turn.agent,
        sendSignal: this.turn.sendSignal,
        sendStateSignal: this.turn.sendStateSignal,
        requestContext: this.turn.requestContext,
        writer: this.turn.writer,
        observabilityContext: this.turn.observabilityContext,
      });
    } catch (error) {
      if (
        om.config.observation.failurePolicy !== 'continue' ||
        !isOmModelExecutionError(error) ||
        error.failureKind !== 'observer-model'
      )
        throw error;
      return {
        succeeded: activated,
        record: this.turn.record,
        activatedMessageIds: activated ? activatedMessageIds : undefined,
        cleanupMessageIds: activatedMessageIds,
      };
    }

    if (obsResult.observed) {
      const observedMessageIds = new Set(obsResult.record.observedMessageIds ?? []);
      const liveMessages = getObservableMessages(messageList);
      let latestObservedIndex = -1;

      for (let i = liveMessages.length - 1; i >= 0; i--) {
        const message = liveMessages[i];
        if (message && observedMessageIds.has(message.id)) {
          latestObservedIndex = i;
          break;
        }
      }

      let messageToSeal = latestObservedIndex >= 0 ? liveMessages[latestObservedIndex] : undefined;
      // At step 0 the newest observed message is the fresh USER prompt (the seed is
      // excluded from observation). Sealing it would persist `sealed` metadata on a
      // user message, permanently routing any future same-id re-add through the
      // MessageList re-id branch. The seal exists to stop later streaming/buffering
      // from merging into observed ASSISTANT content — a user message needs no seal,
      // so skip it. Step > 0 is unaffected (input was drained before observation, so
      // the newest observed message there is the pre-drain state, same as main).
      if (this.stepNumber === 0 && messageToSeal?.role !== 'assistant') {
        messageToSeal = undefined;
      }
      const messagesToSeal = messageToSeal ? [messageToSeal] : [];
      om.sealMessagesForBuffering(messagesToSeal);

      // Suppress the response-id rotation when this step seeded the response message:
      // the seed holds the ACTIVE id so the agent's response merges into it; rotating
      // here would orphan the seed and its markers. (Suppression must live at this
      // invocation site — the hook is re-wired on every step via turn.addHooks.)
      if (this.seededResponseMessage) {
        omDebug('[OM:observe] skipping response-id rotation — step-0 seeded response message holds the active id');
      } else {
        try {
          await this.turn.hooks?.onSyncObservationComplete?.();
        } catch (error) {
          omDebug(
            `[OM:observe] onSyncObservationComplete hook failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (messagesToSeal.length > 0) {
        await om.persistMessages(messagesToSeal, threadId, resourceId);
      }
    }

    return {
      succeeded: activated || obsResult.observed,
      record: obsResult.record,
      activatedMessageIds: activated ? activatedMessageIds : undefined,
      cleanupMessageIds: [
        ...new Set([
          ...activatedMessageIds,
          ...(obsResult.observed ? (obsResult.record.observedMessageIds ?? []) : []),
        ]),
      ],
      observerExchange: om.observer.lastExchange,
    };
  }
}
