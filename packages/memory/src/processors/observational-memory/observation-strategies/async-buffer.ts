import type { MastraDBMessage } from '@mastra/core/agent';
import { setThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import { createBufferingEndMarker, createBufferingFailedMarker, createThreadUpdateMarker } from '../markers';
import { getBufferedChunks, combineObservationsForBuffering } from '../message-utils';

import { wrapInObservationGroup } from '../observation-groups';
import { buildMessageRange } from '../observational-memory';
import { ObservationStrategy } from './base';
import type { StrategyDeps } from './base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

export class AsyncBufferObservationStrategy extends ObservationStrategy {
  private readonly startedAt: string;
  private readonly cycleId: string;

  constructor(deps: StrategyDeps, opts: ObservationRunOpts) {
    super(deps, opts);
    this.cycleId = opts.cycleId!;
    this.startedAt = opts.startedAt ?? new Date().toISOString();
  }

  get needsLock() {
    return false;
  }
  get needsReflection() {
    return false;
  }
  get rethrowOnFailure() {
    return false;
  }

  protected override generateCycleId(): string {
    return this.cycleId;
  }

  async prepare() {
    const { record, messages } = this.opts;
    const bufferedChunks = getBufferedChunks(record);
    const bufferedChunksText = bufferedChunks.map(c => c.observations).join('\n\n');
    const existingObservations = combineObservationsForBuffering(record.activeObservations, bufferedChunksText) ?? '';
    return { messages, existingObservations };
  }

  async emitStartMarkers(_cycleId: string) {
    // START marker already emitted by the launch chain before strategy runs
  }

  async observe(existingObservations: string, messages: MastraDBMessage[]) {
    return this.deps.observer.call(existingObservations, messages, undefined, {
      skipContinuationHints: true,
      requestContext: this.opts.requestContext,
      observabilityContext: this.opts.observabilityContext,
    });
  }

  async process(output: ObserverOutput, _existingObservations: string): Promise<ProcessedObservation> {
    const { threadId, messages } = this.opts;

    if (!output.observations) {
      omDebug(`[OM:asyncBuffer] empty observations returned, skipping buffer storage`);
      return {
        observations: '',
        observationTokens: 0,
        cycleObservationTokens: 0,
        observedMessageIds: [],
        lastObservedAt: new Date(),
      };
    }

    const messageRange = this.retrieval ? buildMessageRange(messages) : undefined;
    let newObservations: string;
    if (this.scope === 'resource') {
      newObservations = await this.wrapWithThreadTag(threadId, output.observations, messageRange);
    } else {
      newObservations =
        this.retrieval && messageRange
          ? wrapInObservationGroup(output.observations, messageRange)
          : output.observations;
    }

    const observationTokens = this.tokenCounter.countObservations(newObservations);
    const messageIds = messages.map(m => m.id);
    const maxTs = this.getMaxMessageTimestamp(messages);
    const lastObservedAt = new Date(maxTs.getTime() + 1);

    return {
      observations: newObservations,
      observationTokens,
      cycleObservationTokens: observationTokens,
      observedMessageIds: messageIds,
      lastObservedAt,
      suggestedContinuation: output.suggestedContinuation,
      currentTask: output.currentTask,
      threadTitle: output.threadTitle,
    };
  }

  async persist(processed: ProcessedObservation) {
    if (!processed.observations) return;

    const { record, threadId, resourceId, messages } = this.opts;
    const messageTokens = await this.tokenCounter.countMessagesAsync(messages);
    await this.storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId: this.cycleId,
        observations: processed.observations,
        tokenCount: processed.observationTokens,
        messageIds: processed.observedMessageIds,
        messageTokens,
        lastObservedAt: processed.lastObservedAt,
        suggestedContinuation: processed.suggestedContinuation,
        currentTask: processed.currentTask,
        threadTitle: processed.threadTitle,
      },
      lastBufferedAtTime: processed.lastObservedAt,
    });

    await this.indexObservationGroups(processed.observations, threadId, resourceId, processed.lastObservedAt);

    // Update thread title immediately — don't wait for activation.
    const newTitle = processed.threadTitle?.trim();
    if (newTitle && newTitle.length >= 3) {
      const thread = await this.storage.getThreadById({ threadId });
      if (thread) {
        const oldTitle = thread.title?.trim();
        if (newTitle !== oldTitle) {
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            threadTitle: processed.threadTitle,
          });
          await this.storage.updateThread({
            id: threadId,
            title: newTitle,
            metadata: newMetadata,
          });

          const marker = createThreadUpdateMarker({
            cycleId: this.cycleId,
            threadId,
            oldTitle,
            newTitle,
          });
          await this.streamMarker(marker);
        }
      }
    }
  }

  async emitEndMarkers(_cycleId: string, processed: ProcessedObservation) {
    if (!processed.observations || !this.opts.writer) return;

    const { record, threadId, messages } = this.opts;
    const tokensBuffered = await this.tokenCounter.countMessagesAsync(messages);
    const updatedRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const updatedChunks = getBufferedChunks(updatedRecord);
    const totalBufferedTokens =
      updatedChunks.reduce((sum, c) => sum + (c.tokenCount ?? 0), 0) || processed.observationTokens;

    const endMarker = createBufferingEndMarker({
      cycleId: this.cycleId,
      operationType: 'observation',
      startedAt: this.startedAt,
      tokensBuffered,
      bufferedTokens: totalBufferedTokens,
      recordId: record.id,
      threadId,
      observations: processed.observations,
    });
    void this.opts.writer.custom(endMarker).catch(() => {});
    await this.persistMarkerToStorage(endMarker, threadId, record.resourceId ?? undefined);
  }

  async emitFailedMarkers(_cycleId: string, error: unknown) {
    if (!this.opts.writer) return;

    const { record, threadId, messages } = this.opts;
    const tokensAttempted = await this.tokenCounter.countMessagesAsync(messages);
    const failedMarker = createBufferingFailedMarker({
      cycleId: this.cycleId,
      operationType: 'observation',
      startedAt: this.startedAt,
      tokensAttempted,
      error: error instanceof Error ? error.message : String(error),
      recordId: record.id,
      threadId,
    });
    void this.opts.writer.custom(failedMarker).catch(() => {});
    await this.persistMarkerToStorage(failedMarker, threadId, record.resourceId ?? undefined);
  }
}
