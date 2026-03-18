import type { MastraDBMessage } from '@mastra/core/agent';

import { omDebug } from '../debug';
import { createBufferingEndMarker, createBufferingFailedMarker } from '../markers';
import { getBufferedChunks, combineObservationsForBuffering } from '../message-utils';
import type { ObservationalMemory } from '../observational-memory';

import { ObservationStrategy } from './base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

export class AsyncBufferObservationStrategy extends ObservationStrategy {
  private readonly startedAt: string;
  private readonly cycleId: string;

  constructor(om: ObservationalMemory, opts: ObservationRunOpts) {
    super(om, opts);
    this.cycleId = opts.cycleId!;
    this.startedAt = opts.startedAt ?? new Date().toISOString();
  }

  get needsLock() {
    return false;
  }
  get needsReflection() {
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
    return this.om.callObserver(existingObservations, messages, undefined, {
      skipContinuationHints: true,
      requestContext: this.opts.requestContext,
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

    let newObservations: string;
    if (this.scope === 'resource') {
      newObservations = await this.om.wrapWithThreadTag(threadId, output.observations);
    } else {
      newObservations = output.observations;
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
    };
  }

  async persist(processed: ProcessedObservation) {
    if (!processed.observations) return;

    const { record, messages } = this.opts;
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
      },
      lastBufferedAtTime: processed.lastObservedAt,
    });
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
    await this.om.persistMarkerToStorage(endMarker, threadId, record.resourceId ?? undefined);
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
    await this.om.persistMarkerToStorage(failedMarker, threadId, record.resourceId ?? undefined);
  }
}
