import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import {
  applyExtractorHooks,
  buildThreadMetadataFromExtractedValues,
  getPriorExtractedValues,
} from '../extracted-values';
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
  private priorExtractedValues?: Record<string, unknown>;

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
    const thread = await this.storage.getThreadById({ threadId: this.opts.threadId });
    const omMeta = thread ? getThreadOMMetadata(thread.metadata) : undefined;
    this.priorExtractedValues = getPriorExtractedValues(omMeta, this.observationConfig.extractors);

    const result = await this.deps.observer.call(existingObservations, messages, undefined, {
      skipContinuationHints: true,
      requestContext: this.opts.requestContext,
      observabilityContext: this.opts.observabilityContext,
      priorExtractedValues: this.priorExtractedValues,
      resourceId: this.opts.resourceId,
      mainAgent: this.opts.agent,
    });
    const hookedValues = await applyExtractorHooks({
      source: 'observer',
      extractors: result.extractors ?? this.observationConfig.extractors,
      values: result.extractedValues,
      failures: result.extractionFailures,
      previousValues: this.priorExtractedValues,
      threadId: this.opts.threadId,
      resourceId: this.opts.resourceId,
      mainAgent: this.opts.agent,
      memory: this.deps.memory,
      sendSignal: this.opts.sendSignal,
      requestContext: this.opts.requestContext,
    });
    return {
      ...result,
      extractedValues: hookedValues.values,
      extractionFailures: hookedValues.failures,
    };
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
      extractedValues: output.extractedValues,
      extractionFailures: output.extractionFailures,
      extractors: output.extractors,
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
        extractedValues: processed.extractedValues,
        extractionFailures: processed.extractionFailures,
      },
      lastBufferedAtTime: processed.lastObservedAt,
    });

    await this.indexObservationGroups(processed.observations, threadId, resourceId, processed.lastObservedAt);

    // Persist extracted values immediately; buffered observation activation is unrelated to extractor state.
    const newTitle = processed.threadTitle?.trim();
    const hasValidThreadTitle = !!newTitle && newTitle.length >= 3;
    if (hasValidThreadTitle || processed.extractedValues) {
      const thread = await this.storage.getThreadById({ threadId });
      if (thread) {
        const oldTitle = thread.title?.trim();
        const shouldUpdateThreadTitle = hasValidThreadTitle && newTitle !== oldTitle;
        const previousOmMetadata = getThreadOMMetadata(thread.metadata);
        const metadataUpdate = buildThreadMetadataFromExtractedValues(
          processed.extractors ?? this.observationConfig.extractors,
          processed.extractedValues,
        );
        const newMetadata = setThreadOMMetadata(thread.metadata, {
          ...(hasValidThreadTitle || metadataUpdate.threadTitle
            ? { threadTitle: metadataUpdate.threadTitle ?? processed.threadTitle }
            : {}),
          extracted: {
            ...(previousOmMetadata?.extracted ?? {}),
            ...(metadataUpdate.extracted ?? {}),
          },
        });
        await this.storage.updateThread({
          id: threadId,
          title: shouldUpdateThreadTitle ? newTitle : (thread.title ?? ''),
          metadata: newMetadata,
        });

        if (shouldUpdateThreadTitle) {
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
    if (!processed.observations) return;

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
      extractedValues: processed.extractedValues,
      extractionFailures: processed.extractionFailures,
    });
    if (this.opts.writer) {
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      void this.opts.writer.custom({ ...endMarker, transient: true }).catch(() => {});
    }
    await this.persistMarkerToStorage(endMarker, threadId, record.resourceId ?? undefined);
  }

  async emitFailedMarkers(_cycleId: string, error: unknown) {
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
    if (this.opts.writer) {
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      void this.opts.writer.custom({ ...failedMarker, transient: true }).catch(() => {});
    }
    await this.persistMarkerToStorage(failedMarker, threadId, record.resourceId ?? undefined);
  }
}
