import type { MastraDBMessage } from '@mastra/core/agent';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';

import { OBSERVATIONAL_MEMORY_DEFAULTS } from '../constants';
import {
  createObservationEndMarker,
  createObservationFailedMarker,
  createObservationStartMarker,
  createThreadUpdateMarker,
} from '../markers';
import { getLastObservedMessageCursor, sortThreadsByOldestMessage } from '../message-utils';
import { buildMessageRange } from '../observational-memory';
import { getMaxThreshold } from '../thresholds';

import { ObservationStrategy } from './base';
import type { StrategyDeps } from './base';
import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

export class ResourceScopedObservationStrategy extends ObservationStrategy {
  private readonly startedAt = new Date().toISOString();
  private cycleId?: string;
  private readonly resourceId: string;

  private threadsWithMessages = new Map<string, MastraDBMessage[]>();
  private threadTokensToObserve = new Map<string, number>();
  private threadTokenCounts = new Map<string, number>();
  private threadOrder: string[] = [];
  private messagesByThread = new Map<string, MastraDBMessage[]>();
  private multiThreadResults = new Map<
    string,
    { observations: string; currentTask?: string; suggestedContinuation?: string; threadTitle?: string }
  >();
  private totalBatchUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private observationResults: Array<{
    threadId: string;
    threadMessages: MastraDBMessage[];
    result: { observations: string; currentTask?: string; suggestedContinuation?: string; threadTitle?: string };
  }> = [];
  private priorMetadataByThread = new Map<
    string,
    { currentTask?: string; suggestedResponse?: string; threadTitle?: string }
  >();

  constructor(deps: StrategyDeps, opts: ObservationRunOpts) {
    super(deps, opts);
    this.resourceId = opts.resourceId!;
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
    const { record, threadId: currentThreadId, messages: currentThreadMessages } = this.opts;

    const { threads: allThreads } = await this.storage.listThreads({ filter: { resourceId: this.resourceId } });
    const threadMetadataMap = new Map<string, { lastObservedAt?: string }>();

    for (const thread of allThreads) {
      const omMetadata = getThreadOMMetadata(thread.metadata);
      threadMetadataMap.set(thread.id, { lastObservedAt: omMetadata?.lastObservedAt });
      if (omMetadata?.currentTask || omMetadata?.suggestedResponse || omMetadata?.threadTitle) {
        this.priorMetadataByThread.set(thread.id, {
          currentTask: omMetadata.currentTask,
          suggestedResponse: omMetadata.suggestedResponse,
          threadTitle: omMetadata.threadTitle,
        });
      }
    }

    for (const thread of allThreads) {
      const threadLastObservedAt = threadMetadataMap.get(thread.id)?.lastObservedAt;
      const startDate = threadLastObservedAt ? new Date(new Date(threadLastObservedAt).getTime() + 1) : undefined;

      const result = await this.storage.listMessages({
        threadId: thread.id,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate ? { dateRange: { start: startDate } } : undefined,
      });

      if (result.messages.length > 0) {
        this.messagesByThread.set(thread.id, result.messages);
      }
    }

    if (currentThreadMessages.length > 0) {
      const existingCurrentThreadMsgs = this.messagesByThread.get(currentThreadId) ?? [];
      const messageMap = new Map<string, MastraDBMessage>();

      for (const msg of existingCurrentThreadMsgs) {
        if (msg.id) messageMap.set(msg.id, msg);
      }
      for (const msg of currentThreadMessages) {
        if (msg.id) messageMap.set(msg.id, msg);
      }

      this.messagesByThread.set(currentThreadId, Array.from(messageMap.values()));
    }

    for (const [tid, msgs] of this.messagesByThread) {
      const filtered = msgs.filter(m => !this.deps.observedMessageIds.has(m.id));
      if (filtered.length > 0) {
        this.messagesByThread.set(tid, filtered);
      } else {
        this.messagesByThread.delete(tid);
      }
    }

    let totalMessages = 0;
    for (const msgs of this.messagesByThread.values()) {
      totalMessages += msgs.length;
    }

    if (totalMessages === 0) {
      return { messages: [] as MastraDBMessage[], existingObservations: '' };
    }

    const threshold = getMaxThreshold(this.observationConfig.messageTokens);

    for (const [threadId, msgs] of this.messagesByThread) {
      const tokens = await this.tokenCounter.countMessagesAsync(msgs);
      this.threadTokenCounts.set(threadId, tokens);
    }

    const threadsBySize = Array.from(this.messagesByThread.keys()).sort((a, b) => {
      return (this.threadTokenCounts.get(b) ?? 0) - (this.threadTokenCounts.get(a) ?? 0);
    });

    let accumulatedTokens = 0;
    const threadsToObserve: string[] = [];

    for (const threadId of threadsBySize) {
      const threadTokens = this.threadTokenCounts.get(threadId) ?? 0;
      if (accumulatedTokens >= threshold) break;
      threadsToObserve.push(threadId);
      accumulatedTokens += threadTokens;
    }

    if (threadsToObserve.length === 0) {
      return { messages: [] as MastraDBMessage[], existingObservations: '' };
    }

    this.threadOrder = sortThreadsByOldestMessage(
      new Map(threadsToObserve.map(tid => [tid, this.messagesByThread.get(tid) ?? []])),
    );

    for (const threadId of this.threadOrder) {
      const msgs = this.messagesByThread.get(threadId);
      if (msgs && msgs.length > 0) {
        this.threadsWithMessages.set(threadId, msgs);
      }
    }

    this.deps.emitDebugEvent({
      type: 'observation_triggered',
      timestamp: new Date(),
      threadId: this.threadOrder.join(','),
      resourceId: this.resourceId,
      previousObservations: record.activeObservations,
      messages: Array.from(this.threadsWithMessages.values())
        .flat()
        .map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
    });

    const freshRecord = await this.storage.getObservationalMemory(null, this.resourceId);
    const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';

    const allMessages = Array.from(this.threadsWithMessages.values()).flat();
    return { messages: allMessages, existingObservations };
  }

  async emitStartMarkers(cycleId: string) {
    this.cycleId = cycleId;
    const allThreadIds = Array.from(this.threadsWithMessages.keys());

    for (const [threadId, msgs] of this.threadsWithMessages) {
      const lastMessage = msgs[msgs.length - 1];
      const tokensToObserve = await this.tokenCounter.countMessagesAsync(msgs);
      this.threadTokensToObserve.set(threadId, tokensToObserve);

      if (lastMessage?.id) {
        const startMarker = createObservationStartMarker({
          cycleId,
          operationType: 'observation',
          tokensToObserve,
          recordId: this.opts.record.id,
          threadId,
          threadIds: allThreadIds,
          config: this.getObservationMarkerConfig(),
        });
        await this.streamMarker(startMarker);
      }
    }
  }

  async observe(_existingObservations: string, _messages: MastraDBMessage[]) {
    const maxTokensPerBatch =
      this.observationConfig.maxTokensPerBatch ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.maxTokensPerBatch;
    const orderedThreadIds = this.threadOrder.filter(tid => this.threadsWithMessages.has(tid));

    const batches: Array<{ threadIds: string[]; threadMap: Map<string, MastraDBMessage[]> }> = [];
    let currentBatch: { threadIds: string[]; threadMap: Map<string, MastraDBMessage[]> } = {
      threadIds: [],
      threadMap: new Map(),
    };
    let currentBatchTokens = 0;

    for (const threadId of orderedThreadIds) {
      const msgs = this.threadsWithMessages.get(threadId)!;
      const threadTokens = this.threadTokenCounts.get(threadId) ?? 0;

      if (currentBatchTokens + threadTokens > maxTokensPerBatch && currentBatch.threadIds.length > 0) {
        batches.push(currentBatch);
        currentBatch = { threadIds: [], threadMap: new Map() };
        currentBatchTokens = 0;
      }

      currentBatch.threadIds.push(threadId);
      currentBatch.threadMap.set(threadId, msgs);
      currentBatchTokens += threadTokens;
    }

    if (currentBatch.threadIds.length > 0) {
      batches.push(currentBatch);
    }

    const batchResults = await Promise.all(
      batches.map(async batch => {
        return this.deps.observer.callMultiThread(
          _existingObservations,
          batch.threadMap,
          batch.threadIds,
          this.opts.abortSignal,
          this.opts.requestContext,
          this.priorMetadataByThread,
          this.opts.observabilityContext,
        );
      }),
    );

    for (const batchResult of batchResults) {
      for (const [threadId, result] of batchResult.results) {
        this.multiThreadResults.set(threadId, result);
      }
      if (batchResult.usage) {
        this.totalBatchUsage.inputTokens += batchResult.usage.inputTokens ?? 0;
        this.totalBatchUsage.outputTokens += batchResult.usage.outputTokens ?? 0;
        this.totalBatchUsage.totalTokens += batchResult.usage.totalTokens ?? 0;
      }
    }

    return {
      observations: '',
      usage: this.totalBatchUsage.totalTokens > 0 ? this.totalBatchUsage : undefined,
    };
  }

  async process(_output: ObserverOutput, existingObservations: string): Promise<ProcessedObservation> {
    const { record } = this.opts;

    this.observationResults = [];
    for (const threadId of this.threadOrder) {
      const threadMessages = this.messagesByThread.get(threadId) ?? [];
      if (threadMessages.length === 0) continue;

      const result = this.multiThreadResults.get(threadId);
      if (!result) continue;

      this.observationResults.push({ threadId, threadMessages, result });
    }

    let currentObservations = existingObservations;
    let cycleObservationTokens = 0;
    const threadMetadataUpdates: ProcessedObservation['threadMetadataUpdates'] = [];

    for (const obsResult of this.observationResults) {
      const { threadId, threadMessages, result } = obsResult;

      cycleObservationTokens += this.tokenCounter.countObservations(result.observations);

      const messageRange = this.retrieval ? buildMessageRange(threadMessages) : undefined;
      const threadSection = await this.wrapWithThreadTag(threadId, result.observations, messageRange);
      const threadLastObservedAt = this.getMaxMessageTimestamp(threadMessages);
      currentObservations = this.replaceOrAppendThreadSection(
        currentObservations,
        threadId,
        threadSection,
        threadLastObservedAt,
      );
      threadMetadataUpdates!.push({
        threadId,
        lastObservedAt: threadLastObservedAt.toISOString(),
        suggestedResponse: result.suggestedContinuation,
        currentTask: result.currentTask,
        threadTitle: result.threadTitle,
        lastObservedMessageCursor: getLastObservedMessageCursor(threadMessages),
      });

      const isFirstThread = this.observationResults.indexOf(obsResult) === 0;
      this.deps.emitDebugEvent({
        type: 'observation_complete',
        timestamp: new Date(),
        threadId,
        resourceId: this.resourceId,
        observations: threadSection,
        rawObserverOutput: result.observations,
        previousObservations: record.activeObservations,
        messages: threadMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        usage: isFirstThread && this.totalBatchUsage.totalTokens > 0 ? this.totalBatchUsage : undefined,
      });
    }

    const observedMessages = this.observationResults.flatMap(r => r.threadMessages);
    const lastObservedAt = this.getMaxMessageTimestamp(observedMessages);
    const newMessageIds = observedMessages.map(m => m.id);
    const existingIds = record.observedMessageIds ?? [];
    const observedMessageIds = [...new Set([...existingIds, ...newMessageIds])];
    const observationTokens = this.tokenCounter.countObservations(currentObservations);

    return {
      observations: currentObservations,
      observationTokens,
      cycleObservationTokens,
      observedMessageIds,
      lastObservedAt,
      threadMetadataUpdates,
    };
  }

  async persist(processed: ProcessedObservation) {
    const { record, resourceId } = this.opts;
    const threadUpdateMarkers: Array<ReturnType<typeof createThreadUpdateMarker>> = [];

    if (processed.threadMetadataUpdates) {
      for (const update of processed.threadMetadataUpdates) {
        const thread = await this.storage.getThreadById({ threadId: update.threadId });
        if (thread) {
          const oldTitle = thread.title?.trim();
          const newTitle = update.threadTitle?.trim();
          const shouldUpdateThreadTitle = !!newTitle && newTitle.length >= 3 && newTitle !== oldTitle;
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            lastObservedAt: update.lastObservedAt,
            suggestedResponse: update.suggestedResponse,
            currentTask: update.currentTask,
            threadTitle: update.threadTitle,
            lastObservedMessageCursor: update.lastObservedMessageCursor,
          });
          await this.storage.updateThread({
            id: update.threadId,
            title: shouldUpdateThreadTitle ? newTitle : (thread.title ?? ''),
            metadata: newMetadata,
          });

          if (shouldUpdateThreadTitle) {
            threadUpdateMarkers.push(
              createThreadUpdateMarker({
                cycleId: this.cycleId ?? crypto.randomUUID(),
                threadId: update.threadId,
                oldTitle,
                newTitle,
              }),
            );
          }
        }
      }
    }

    for (const marker of threadUpdateMarkers) {
      await this.streamMarker(marker);
    }

    await this.storage.updateActiveObservations({
      id: record.id,
      observations: processed.observations,
      tokenCount: processed.observationTokens,
      lastObservedAt: processed.lastObservedAt,
      observedMessageIds: processed.observedMessageIds,
    });

    if (resourceId) {
      await Promise.all(
        this.observationResults.map(({ threadId, threadMessages, result }) =>
          this.indexObservationGroups(
            result.observations,
            threadId,
            resourceId,
            this.getMaxMessageTimestamp(threadMessages),
          ),
        ),
      );
    }
  }

  async emitEndMarkers(cycleId: string, processed: ProcessedObservation) {
    for (const obsResult of this.observationResults) {
      const { threadId, threadMessages, result } = obsResult;
      const lastMessage = threadMessages[threadMessages.length - 1];
      if (lastMessage?.id) {
        const tokensObserved =
          this.threadTokensToObserve.get(threadId) ?? (await this.tokenCounter.countMessagesAsync(threadMessages));
        const endMarker = createObservationEndMarker({
          cycleId,
          operationType: 'observation',
          startedAt: this.startedAt,
          tokensObserved,
          observationTokens: processed.cycleObservationTokens,
          observations: result.observations,
          currentTask: result.currentTask,
          suggestedResponse: result.suggestedContinuation,
          recordId: this.opts.record.id,
          threadId,
        });
        await this.streamMarker(endMarker);
      }
    }
  }

  async emitFailedMarkers(cycleId: string, error: unknown) {
    for (const [threadId, msgs] of this.threadsWithMessages) {
      const lastMessage = msgs[msgs.length - 1];
      if (lastMessage?.id) {
        const tokensAttempted = this.threadTokensToObserve.get(threadId) ?? 0;
        const failedMarker = createObservationFailedMarker({
          cycleId,
          operationType: 'observation',
          startedAt: this.startedAt,
          tokensAttempted,
          error: error instanceof Error ? error.message : String(error),
          recordId: this.opts.record.id,
          threadId,
        });
        await this.streamMarker(failedMarker);
      }
    }
  }
}
