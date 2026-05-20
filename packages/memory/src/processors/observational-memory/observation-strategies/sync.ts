import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import {
  createObservationEndMarker,
  createObservationFailedMarker,
  createObservationStartMarker,
  createThreadUpdateMarker,
} from '../markers';
import { getLastObservedMessageCursor } from '../message-utils';

import { buildMessageRange } from '../observational-memory';
import { ObservationStrategy } from './base';
import type { StrategyDeps } from './base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

export class SyncObservationStrategy extends ObservationStrategy {
  private readonly startedAt = new Date().toISOString();
  private readonly lastMessage: MastraDBMessage | undefined;
  private cycleId?: string;
  private tokensToObserve = 0;
  private observerResult!: ObserverOutput;

  constructor(deps: StrategyDeps, opts: ObservationRunOpts) {
    super(deps, opts);
    this.lastMessage = opts.messages[opts.messages.length - 1];
  }

  get needsLock() {
    return true;
  }
  get needsReflection() {
    return true;
  }
  get rethrowOnFailure() {
    return true;
  }

  async prepare() {
    const { record, threadId, messages } = this.opts;

    this.deps.emitDebugEvent({
      type: 'observation_triggered',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      previousObservations: record.activeObservations,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    });

    const bufferActivation = this.observationConfig.bufferActivation;
    if (bufferActivation && bufferActivation < 1 && messages.length >= 1) {
      const newestMsg = messages[messages.length - 1];
      if (newestMsg?.content?.parts?.length) {
        // Set message-level sealed flag (same pattern as OM.sealMessagesForBuffering on main)
        if (!newestMsg.content.metadata) {
          newestMsg.content.metadata = {};
        }
        const metadata = newestMsg.content.metadata as { mastra?: { sealed?: boolean } };
        if (!metadata.mastra) {
          metadata.mastra = {};
        }
        metadata.mastra.sealed = true;
        omDebug(
          `[OM:sync-obs] sealed newest message (${newestMsg.role}, ${newestMsg.content.parts.length} parts) for ratio-aware observation`,
        );
      }
    }

    this.tokensToObserve = await this.tokenCounter.countMessagesAsync(messages);

    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';
    return { messages, existingObservations };
  }

  async emitStartMarkers(cycleId: string) {
    this.cycleId = cycleId;
    if (this.lastMessage?.id) {
      const startMarker = createObservationStartMarker({
        cycleId,
        operationType: 'observation',
        tokensToObserve: this.tokensToObserve,
        recordId: this.opts.record.id,
        threadId: this.opts.threadId,
        threadIds: [this.opts.threadId],
        config: this.getObservationMarkerConfig(),
      });
      await this.streamMarker(startMarker);
    }
  }

  async observe(existingObservations: string, messages: MastraDBMessage[]) {
    // Fetch prior thread metadata for observer prompt continuity
    const thread = await this.storage.getThreadById({ threadId: this.opts.threadId });
    const omMeta = thread ? getThreadOMMetadata(thread.metadata) : undefined;

    const result = await this.deps.observer.call(existingObservations, messages, this.opts.abortSignal, {
      requestContext: this.opts.requestContext,
      observabilityContext: this.opts.observabilityContext,
      priorCurrentTask: omMeta?.currentTask,
      priorSuggestedResponse: omMeta?.suggestedResponse,
      priorThreadTitle: omMeta?.threadTitle,
    });
    this.observerResult = result;
    return result;
  }

  async process(output: ObserverOutput, existingObservations: string): Promise<ProcessedObservation> {
    const { record, threadId, messages } = this.opts;

    const lastObservedAt = this.getMaxMessageTimestamp(messages);
    const messageRange = this.retrieval ? buildMessageRange(messages) : undefined;
    const newObservations = await this.wrapObservations(
      output.observations,
      existingObservations,
      threadId,
      lastObservedAt,
      messageRange,
    );
    const observationTokens = this.tokenCounter.countObservations(newObservations);
    const cycleObservationTokens = this.tokenCounter.countObservations(output.observations);

    const newMessageIds = messages.map(m => m.id);
    const existingIds = record.observedMessageIds ?? [];
    const observedMessageIds = [...new Set([...(Array.isArray(existingIds) ? existingIds : []), ...newMessageIds])];

    this.deps.emitDebugEvent({
      type: 'observation_complete',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      observations: newObservations,
      rawObserverOutput: output.observations,
      previousObservations: record.activeObservations,
      messages: messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      usage: output.usage,
    });

    return {
      observations: newObservations,
      observationTokens,
      cycleObservationTokens,
      observedMessageIds,
      lastObservedAt,
      suggestedContinuation: output.suggestedContinuation,
      currentTask: output.currentTask,
      threadTitle: output.threadTitle,
    };
  }

  async persist(processed: ProcessedObservation) {
    const { record, threadId, resourceId, messages } = this.opts;

    const thread = await this.storage.getThreadById({ threadId });
    let threadUpdateMarker: ReturnType<typeof createThreadUpdateMarker> | undefined;

    if (thread) {
      const oldTitle = thread.title?.trim();
      const newTitle = processed.threadTitle?.trim();
      const shouldUpdateThreadTitle = !!newTitle && newTitle.length >= 3 && newTitle !== oldTitle;
      const newMetadata = setThreadOMMetadata(thread.metadata, {
        suggestedResponse: processed.suggestedContinuation,
        currentTask: processed.currentTask,
        threadTitle: processed.threadTitle,
        lastObservedMessageCursor: getLastObservedMessageCursor(messages),
      });
      await this.storage.updateThread({
        id: threadId,
        title: shouldUpdateThreadTitle ? newTitle : (thread.title ?? ''),
        metadata: newMetadata,
      });

      if (shouldUpdateThreadTitle) {
        threadUpdateMarker = createThreadUpdateMarker({
          cycleId: this.cycleId ?? crypto.randomUUID(),
          threadId,
          oldTitle,
          newTitle,
        });
      }
    }

    if (threadUpdateMarker) {
      await this.streamMarker(threadUpdateMarker);
    }

    await this.storage.updateActiveObservations({
      id: record.id,
      observations: processed.observations,
      tokenCount: processed.observationTokens,
      lastObservedAt: processed.lastObservedAt,
      observedMessageIds: processed.observedMessageIds,
    });

    await this.indexObservationGroups(processed.observations, threadId, resourceId, processed.lastObservedAt);
  }

  async emitEndMarkers(cycleId: string, processed: ProcessedObservation) {
    const actualTokensObserved = await this.tokenCounter.countMessagesAsync(this.opts.messages);
    if (this.lastMessage?.id) {
      const endMarker = createObservationEndMarker({
        cycleId,
        operationType: 'observation',
        startedAt: this.startedAt,
        tokensObserved: actualTokensObserved,
        observationTokens: processed.cycleObservationTokens,
        observations: this.observerResult.observations,
        currentTask: this.observerResult.currentTask,
        suggestedResponse: this.observerResult.suggestedContinuation,
        recordId: this.opts.record.id,
        threadId: this.opts.threadId,
      });
      await this.streamMarker(endMarker);
    }
  }

  async emitFailedMarkers(cycleId: string, error: unknown) {
    if (this.lastMessage?.id) {
      const failedMarker = createObservationFailedMarker({
        cycleId,
        operationType: 'observation',
        startedAt: this.startedAt,
        tokensAttempted: this.tokensToObserve,
        error: error instanceof Error ? error.message : String(error),
        recordId: this.opts.record.id,
        threadId: this.opts.threadId,
      });
      await this.streamMarker(failedMarker);
    }
  }
}
