import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';

import { omDebug } from '../debug';
import { createBufferingEndMarker, createBufferingFailedMarker, createThreadUpdateMarker } from '../markers';
import { getBufferedChunks, combineObservationsForBuffering } from '../message-utils';

import { wrapInObservationGroup } from '../observation-groups';
import { buildMessageRange } from '../observational-memory';
import { ObservationStrategy } from './base';
import type { StrategyDeps } from './base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

/**
 * Filter the raw `customExtractorValues` returned from the observer down to
 * just the slugs registered for non-built-in extractors. Mirrors the helper
 * used by the sync strategy.
 */
function filterCustomExtractorValuesForStorage(
  values: Record<string, string> | undefined,
  customExtractors: ReadonlyArray<{ slug: string }>,
): Record<string, string> | undefined {
  if (!values || customExtractors.length === 0) return undefined;
  const result: Record<string, string> = {};
  for (const extractor of customExtractors) {
    const value = values[extractor.slug];
    if (value !== undefined && value !== '') {
      result[extractor.slug] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

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
    // Pull any prior custom-extractor values from thread metadata so the
    // observer can carry them forward if the user opted into that behaviour.
    let priorCustomExtractorValues: Record<string, unknown> | undefined;
    if (this.deps.customExtractors.length > 0) {
      const thread = await this.storage.getThreadById({ threadId: this.opts.threadId });
      priorCustomExtractorValues = thread ? getThreadOMMetadata(thread.metadata)?.extractors : undefined;
    }

    return this.deps.observer.call(existingObservations, messages, undefined, {
      skipContinuationHints: true,
      requestContext: this.opts.requestContext,
      observabilityContext: this.opts.observabilityContext,
      customExtractors: this.deps.customExtractors,
      priorCustomExtractorValues,
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
      customExtractorValues: filterCustomExtractorValuesForStorage(
        output.customExtractorValues,
        this.deps.customExtractors,
      ),
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

    // Update thread title immediately — don't wait for activation. Custom
    // extractor values are written through to thread metadata at the same
    // time so the next observation cycle can carry them forward and
    // onExtracted hooks see up-to-date persisted state.
    const newTitle = processed.threadTitle?.trim();
    const shouldWriteTitle = !!newTitle && newTitle.length >= 3;
    const customExtractorValues = processed.customExtractorValues;
    if (shouldWriteTitle || customExtractorValues) {
      const thread = await this.storage.getThreadById({ threadId });
      if (thread) {
        const oldTitle = thread.title?.trim();
        const titleChanged = shouldWriteTitle && newTitle !== oldTitle;
        const priorMeta = getThreadOMMetadata(thread.metadata);
        const mergedCustomExtractors =
          priorMeta?.extractors || customExtractorValues
            ? { ...(priorMeta?.extractors ?? {}), ...(customExtractorValues ?? {}) }
            : undefined;
        const newMetadata = setThreadOMMetadata(thread.metadata, {
          ...(shouldWriteTitle ? { threadTitle: processed.threadTitle } : {}),
          ...(mergedCustomExtractors ? { extractors: mergedCustomExtractors } : {}),
        });
        await this.storage.updateThread({
          id: threadId,
          title: titleChanged ? newTitle! : (thread.title ?? ''),
          metadata: newMetadata,
        });

        if (titleChanged) {
          const marker = createThreadUpdateMarker({
            cycleId: this.cycleId,
            threadId,
            oldTitle,
            newTitle: newTitle!,
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
