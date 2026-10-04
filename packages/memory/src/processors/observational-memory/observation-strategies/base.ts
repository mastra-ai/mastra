import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { MessageHistory } from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import xxhash from 'xxhash-wasm';

import type { Memory } from '../../..';
import { getOMLockKey, runOMCommit } from '../commit-queue';
import { omDebug, omError } from '../debug';
import { formatOmError, getOmFailureMetadata, isOmModelExecutionError } from '../error';
import {
  findLastCompletedObservationBoundary,
  getObservableMessages,
  getUnobservedParts,
  stripThreadTags,
} from '../message-utils';
import { parseObservationGroups, wrapInObservationGroup } from '../observation-groups';
import type { ObserverRunner } from '../observer-runner';
import { getLineageHead } from '../record-lineage';
import type { ReflectorRunner } from '../reflector-runner';
import { withRetry } from '../retry';
import { stripSubconsciousSignals } from '../subconscious/origin';
import { getMaxThreshold } from '../thresholds';
import type { TokenCounter } from '../token-counter';
import type {
  ObservationDebugEvent,
  ObservationMarkerConfig,
  ResolvedObservationConfig,
  ResolvedReflectionConfig,
} from '../types';

import type {
  ObservationPersistOutcome,
  ObservationRunOpts,
  ObservationRunResult,
  ObserverOutput,
  ProcessedObservation,
} from './types';

/** Module-level xxhash singleton — loaded once, shared across all strategy instances. */
const hasherPromise = xxhash();

/** Recompose-and-retry rounds for an observation commit that hit a retired or changed head. */
const MAX_HEAD_COMMIT_RETRIES = 3;

const OBSERVATION_LIFECYCLE_MARKERS = new Set([
  'data-om-observation-start',
  'data-om-observation-end',
  'data-om-observation-failed',
]);

function isOmPart(part: unknown): boolean {
  return String((part as { type?: string } | undefined)?.type ?? '').startsWith('data-om-');
}

/**
 * Index in `message` right after this cycle's start marker (and any OM parts directly after it),
 * or -1 when the message doesn't carry it.
 */
function afterOwnStartMarker(message: MastraDBMessage, marker: { type: string; data: unknown }): number {
  const cycleId = (marker.data as { cycleId?: string } | undefined)?.cycleId;
  if (!cycleId || marker.type === 'data-om-observation-start') return -1;
  const parts = message.content?.parts ?? [];
  const start = parts.findIndex(
    (part: any) => part?.type === 'data-om-observation-start' && part?.data?.cycleId === cycleId,
  );
  if (start === -1) return -1;
  let index = start + 1;
  while (index < parts.length && isOmPart(parts[index])) index++;
  return index;
}

/** True when the message has parts no completed observation boundary covers (OM markers aside). */
function hasUnobservedContent(message: MastraDBMessage): boolean {
  return getUnobservedParts(message).some(part => !isOmPart(part));
}

function isObservationLifecycleMarker(marker: { type: string; data: unknown }): boolean {
  const operationType = (marker.data as { operationType?: string } | undefined)?.operationType;
  return OBSERVATION_LIFECYCLE_MARKERS.has(marker.type) && operationType !== 'reflection';
}

/**
 * Dependencies injected into observation strategies.
 * Built by the factory in index.ts from the ObservationalMemory instance.
 */
export interface StrategyDeps {
  storage: MemoryStorage;
  memory?: Memory;
  messageHistory: MessageHistory;
  tokenCounter: TokenCounter;
  observationConfig: ResolvedObservationConfig;
  reflectionConfig: ResolvedReflectionConfig;
  scope: 'thread' | 'resource';
  retrieval: boolean;
  observer: ObserverRunner;
  reflector: ReflectorRunner;
  observedMessageIds: Set<string>;
  obscureThreadIds: boolean;
  onIndexObservations?: (observation: {
    text: string;
    groupId: string;
    range: string;
    threadId: string;
    resourceId: string;
    observedAt?: Date;
    recordId?: string;
  }) => Promise<void>;
  emitDebugEvent: (event: ObservationDebugEvent) => void;
}

/**
 * Abstract base class for observation strategies.
 *
 * Each strategy implements the phases of the observation lifecycle
 * (prepare → observe → process → persist) while the base class handles
 * the shared orchestration (lock guard, marker emission, reflection, error handling).
 */
export abstract class ObservationStrategy {
  protected readonly storage: MemoryStorage;
  protected readonly messageHistory: MessageHistory;
  protected readonly tokenCounter: TokenCounter;
  protected readonly observationConfig: ResolvedObservationConfig;
  protected readonly reflectionConfig: ResolvedReflectionConfig;
  protected readonly scope: 'thread' | 'resource';
  protected readonly retrieval: boolean;

  /** Select the right strategy based on scope and mode. Wired up by index.ts. */
  static create: (om: unknown, opts: ObservationRunOpts) => ObservationStrategy;

  constructor(
    protected readonly deps: StrategyDeps,
    protected readonly opts: ObservationRunOpts,
  ) {
    this.storage = deps.storage;
    this.messageHistory = deps.messageHistory;
    this.tokenCounter = deps.tokenCounter;
    this.observationConfig = deps.observationConfig;
    this.reflectionConfig = deps.reflectionConfig;
    this.scope = deps.scope;
    this.retrieval = deps.retrieval;
  }

  /**
   * Run the full observation lifecycle.
   * @returns Result with `observed` flag and optional `usage` from the observer LLM call.
   * @throws On sync/resource-scoped observer failure after failed markers (same as pre–Option-A contract).
   */
  async run(): Promise<ObservationRunResult> {
    const { record, threadId, abortSignal, writer, reflectionHooks, requestContext } = this.opts;
    const cycleId = this.generateCycleId();

    try {
      if (this.needsLock) {
        const fresh = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
        if (fresh?.lastObservedAt && record.lastObservedAt && fresh.lastObservedAt > record.lastObservedAt) {
          return { observed: false };
        }
      }

      const { messages, existingObservations } = await this.prepare();
      if (messages.length === 0) {
        // Nothing is unobserved (e.g. a stale persisted pending count met the threshold). Observing
        // nothing would still commit a cursor at the current time, past any message that is
        // timestamped earlier but not yet observed.
        return { observed: false };
      }
      const observationMessages = stripSubconsciousSignals(messages);
      await this.emitStartMarkers(cycleId);
      const output = await this.observe(existingObservations, observationMessages);
      let processed = await this.process(output, existingObservations);
      let committedRecord = record;
      const outcome = await this.persist(processed);
      if (outcome?.status === 'not-committed') {
        // Nothing landed on the head: no completion marker, no reflection, and the caller
        // keeps the source messages in context (`observed: false`).
        omDebug(`[OM:observe] cycle ${cycleId} not committed: ${outcome.reason}`);
        await this.emitFailedMarkers(cycleId, new Error(`Observation not committed: ${outcome.reason}`));
        return { observed: false, usage: output.usage, providerMetadata: output.providerMetadata };
      }
      if (outcome?.status === 'committed') {
        processed = outcome.processed;
        committedRecord = outcome.record;
      }
      await this.emitEndMarkers(cycleId, processed);

      if (this.needsReflection) {
        await this.deps.reflector.maybeReflect({
          // The reflection snapshot is the text this cycle committed; storage keeps anything
          // appended to it while the Reflector runs.
          record: {
            ...committedRecord,
            activeObservations: processed.observations,
            observationTokenCount: processed.observationTokens,
          },
          observationTokens: processed.observationTokens,
          threadId,
          writer,
          messageList: this.opts.messageList,
          abortSignal,
          mainAgent: this.opts.agent,
          sendSignal: this.opts.sendSignal,
          sendStateSignal: this.opts.sendStateSignal,
          reflectionHooks,
          trigger: this.opts.trigger,
          requestContext,
          observabilityContext: this.opts.observabilityContext,
        });
      }

      return { observed: true, usage: output.usage, providerMetadata: output.providerMetadata };
    } catch (error) {
      await this.emitFailedMarkers(cycleId, error);

      if (!this.rethrowOnFailure) {
        const failedMarkerForStorage = {
          type: 'data-om-observation-failed',
          data: {
            cycleId,
            operationType: 'observation',
            startedAt: new Date().toISOString(),
            error: formatOmError(error),
            ...getOmFailureMetadata(error, this.observationConfig.failurePolicy),
            recordId: record.id,
            threadId,
          },
        };
        const observed = this.getObservedMessagesForThread(threadId);
        await (
          observed?.length
            ? this.persistMarkerToObservedMessage(failedMarkerForStorage, observed, threadId, this.opts.resourceId)
            : this.persistMarkerToStorage(failedMarkerForStorage, threadId, this.opts.resourceId)
        ).catch(() => {});
        if (abortSignal?.aborted) throw error;
        omError('[OM] Observation failed', error);
        return { observed: false, error: error instanceof Error ? error : new Error(String(error)) };
      }

      omError('[OM] Observation failed', error);
      if (
        this.observationConfig.failurePolicy === 'continue' &&
        isOmModelExecutionError(error) &&
        error.failureKind === 'observer-model'
      ) {
        return { observed: false, error };
      }
      throw error;
    }
  }

  // ── Shared helpers ──────────────────────────────────────────

  protected generateCycleId(): string {
    return crypto.randomUUID();
  }

  protected async streamMarker(marker: { type: string; data: unknown }): Promise<void> {
    if (this.opts.writer) {
      // Stream OM lifecycle markers as transient so the OutputWriter does not persist standalone data-only messages; OM persists the durable marker explicitly.
      await this.opts.writer.custom({ ...marker, transient: true }).catch(() => {});
    }

    const markerThreadId = (marker.data as { threadId?: string } | undefined)?.threadId ?? this.opts.threadId;
    const observed = isObservationLifecycleMarker(marker)
      ? this.getObservedMessagesForThread(markerThreadId)
      : undefined;
    if (observed?.length) {
      await this.persistMarkerToObservedMessage(marker, observed, markerThreadId, this.opts.resourceId);
      return;
    }
    // Prefer the live MessageList (markers land on the pending assistant message
    // before it reaches storage); fall back to the storage scan when no list was
    // provided or the list contains no assistant message yet.
    const persisted = await this.persistMarkerToMessage(
      marker,
      this.opts.messageList,
      markerThreadId,
      this.opts.resourceId,
    );
    if (!persisted) {
      await this.persistMarkerToStorage(marker, markerThreadId, this.opts.resourceId);
    }
  }

  protected getObservationMarkerConfig(): ObservationMarkerConfig {
    return {
      messageTokens: getMaxThreshold(this.observationConfig.messageTokens),
      observationTokens: getMaxThreshold(this.reflectionConfig.observationTokens),
      scope: this.scope,
    };
  }

  protected getMaxMessageTimestamp(messages: MastraDBMessage[]): Date {
    let maxTime = 0;
    for (const msg of messages) {
      if (msg.createdAt) {
        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime > maxTime) {
          maxTime = msgTime;
        }
      }
    }
    return maxTime > 0 ? new Date(maxTime) : new Date();
  }

  // ── Observation formatting ──────────────────────────────────

  /**
   * Wrap observations in a thread attribution tag.
   * In resource scope, thread IDs can be obscured via xxhash.
   */
  protected async wrapWithThreadTag(threadId: string, observations: string, messageRange?: string): Promise<string> {
    const cleanObservations = stripThreadTags(observations);
    const groupedObservations =
      this.retrieval && messageRange ? wrapInObservationGroup(cleanObservations, messageRange) : cleanObservations;
    let displayId = threadId;
    if (this.deps.obscureThreadIds) {
      const hasher = await hasherPromise;
      displayId = hasher.h32ToString(threadId);
    }
    return `<thread id="${displayId}">\n${groupedObservations}\n</thread>`;
  }

  /**
   * Create a message boundary delimiter with an ISO 8601 date.
   * Used to separate observation chunks for cache stability.
   */
  protected static createMessageBoundary(date: Date): string {
    return `\n\n--- message boundary (${date.toISOString()}) ---\n\n`;
  }

  /**
   * Wrap raw observations — in resource scope, wraps with thread tag and merges;
   * in thread scope, simply appends with a message boundary delimiter.
   */
  protected wrapObservations(
    rawObservations: string,
    existingObservations: string,
    threadId: string,
    lastObservedAt?: Date,
    messageRange?: string,
  ): Promise<string> | string {
    if (this.scope === 'resource') {
      return (async () => {
        const threadSection = await this.wrapWithThreadTag(threadId, rawObservations, messageRange);
        return this.replaceOrAppendThreadSection(existingObservations, threadId, threadSection, lastObservedAt);
      })();
    }
    const grouped =
      this.retrieval && messageRange ? wrapInObservationGroup(rawObservations, messageRange) : rawObservations;
    if (!existingObservations) return grouped;
    const boundary = lastObservedAt ? ObservationStrategy.createMessageBoundary(lastObservedAt) : '\n\n';
    return `${existingObservations}${boundary}${grouped}`;
  }

  protected replaceOrAppendThreadSection(
    existingObservations: string,
    _threadId: string,
    newThreadSection: string,
    lastObservedAt?: Date,
  ): string {
    if (!existingObservations) {
      return newThreadSection;
    }

    const threadIdMatch = newThreadSection.match(/<thread id="([^"]+)">/);
    const dateMatch = newThreadSection.match(/Date:\s*([A-Za-z]+\s+\d+,\s+\d+)/);

    if (!threadIdMatch || !dateMatch) {
      const boundary = lastObservedAt ? ObservationStrategy.createMessageBoundary(lastObservedAt) : '\n\n';
      return `${existingObservations}${boundary}${newThreadSection}`;
    }

    const newThreadId = threadIdMatch[1]!;
    const newDate = dateMatch[1]!;

    const threadOpen = `<thread id="${newThreadId}">`;
    const threadClose = '</thread>';
    const startIdx = existingObservations.indexOf(threadOpen);
    let existingSection: string | null = null;
    let existingSectionStart = -1;
    let existingSectionEnd = -1;

    if (startIdx !== -1) {
      const closeIdx = existingObservations.indexOf(threadClose, startIdx);
      if (closeIdx !== -1) {
        existingSectionEnd = closeIdx + threadClose.length;
        existingSectionStart = startIdx;
        const section = existingObservations.slice(startIdx, existingSectionEnd);
        if (section.includes(`Date: ${newDate}`) || section.includes(`Date:${newDate}`)) {
          existingSection = section;
        }
      }
    }

    if (existingSection) {
      const dateLineEnd = newThreadSection.indexOf('\n', newThreadSection.indexOf('Date:'));
      const newCloseIdx = newThreadSection.lastIndexOf(threadClose);
      if (dateLineEnd !== -1 && newCloseIdx !== -1) {
        const newObsContent = newThreadSection.slice(dateLineEnd + 1, newCloseIdx).trim();
        if (newObsContent) {
          const withoutClose = existingSection.slice(0, existingSection.length - threadClose.length).trimEnd();
          const merged = `${withoutClose}\n${newObsContent}\n${threadClose}`;
          return (
            existingObservations.slice(0, existingSectionStart) +
            merged +
            existingObservations.slice(existingSectionEnd)
          );
        }
      }
    }

    const boundary = lastObservedAt ? ObservationStrategy.createMessageBoundary(lastObservedAt) : '\n\n';
    return `${existingObservations}${boundary}${newThreadSection}`;
  }

  /**
   * Commit composed observations to the current head generation.
   *
   * The write is conditional on the head text the observations were composed from. When the
   * target generation was retired by a reflection, or another writer changed the text, the
   * observations are recomposed against the fresh head and the commit is retried (bounded).
   * Returns null when no commit landed — callers must then leave cursors, markers, and the live
   * context untouched.
   */
  protected async commitActiveObservationsToHead(opts: {
    processed: ProcessedObservation;
    composedFrom: string;
    target: ObservationalMemoryRecord;
    recompose: (head: ObservationalMemoryRecord) => Promise<ProcessedObservation>;
  }): Promise<{ processed: ProcessedObservation; record: ObservationalMemoryRecord } | null> {
    let { processed, composedFrom, target } = opts;
    for (let attempt = 0; attempt <= MAX_HEAD_COMMIT_RETRIES; attempt++) {
      // Inside the queue slot, compose against the head as it is now, so in-process writers
      // never conflict; the conditional write still guards against other processes.
      const result = await this.runCommit(async () => {
        // Never the record a clear left behind: a new record created since is not this lineage.
        const head = await getLineageHead(this.storage, target);
        if (!head) return null;
        if (head.id !== target.id || (head.activeObservations ?? '') !== composedFrom) {
          target = head;
          composedFrom = head.activeObservations ?? '';
          processed = await opts.recompose(head);
        }
        return (
          (await this.storage.updateActiveObservations({
            id: target.id,
            observations: processed.observations,
            tokenCount: processed.observationTokens,
            lastObservedAt: processed.lastObservedAt,
            observedMessageIds: processed.observedMessageIds,
            expectedActiveObservations: composedFrom,
          })) ?? { applied: true as const }
        );
      });
      if (!result) return null;
      if (result.applied) return { processed, record: target };
      omDebug(`[OM:observe] commit to ${target.id} not applied (${result.reason}); retrying against the head`);
    }
    return null;
  }

  /** Runs one storage commit in this thread's (or resource's) slot of the process-wide commit queue. */
  protected runCommit<T>(op: () => Promise<T>): Promise<T> {
    const { threadId, resourceId, record } = this.opts;
    return runOMCommit(getOMLockKey(this.scope, record.threadId ?? threadId, record.resourceId ?? resourceId), op);
  }

  protected async indexObservationGroups(
    observations: string,
    threadId: string,
    resourceId: string | undefined,
    observedAt: Date | undefined,
    recordId: string,
  ): Promise<void> {
    if (!resourceId || !this.deps.onIndexObservations) {
      return;
    }

    const groups = parseObservationGroups(observations);
    if (groups.length === 0) {
      return;
    }

    await Promise.all(
      groups.map(group =>
        withRetry(
          () =>
            this.deps.onIndexObservations!({
              text: group.content,
              groupId: group.id,
              range: group.range,
              threadId,
              resourceId,
              observedAt,
              recordId,
            }),
          { label: 'index-observations', abortSignal: this.opts.abortSignal },
        ),
      ),
    );
  }

  // ── Marker persistence ──────────────────────────────────────

  /**
   * Messages this cycle observed for `threadId`, or undefined when the strategy does not
   * place observation lifecycle markers.
   */
  protected getObservedMessagesForThread(_threadId: string): MastraDBMessage[] | undefined {
    return undefined;
  }

  /**
   * Persist an observation start/end/failed marker without hiding unobserved content. A completed
   * end marker tells `getUnobservedMessages` that everything before it in that message is observed
   * (whatever thread the marker names), so it must only follow content this cycle observed.
   * Placement, in order:
   * 1. the live MessageList's newest assistant message (this turn's response or its seed), when the
   *    list belongs to the marker's thread and the cycle observed that message or it has no
   *    unobserved content;
   * 2. the newest observed assistant message; a stored copy (no live list, or another instance's
   *    message) gets the marker right after the parts this cycle observed (end/failed markers right
   *    after this cycle's start marker), so parts added while the Observer ran stay unobserved;
   * 3. the newest stored assistant message that is not newer than the observed range, only when it
   *    has nothing unobserved (or already carries this cycle's start marker); otherwise no marker,
   *    and the thread cursor alone records the cycle.
   * Lifecycle markers never go on user messages.
   */
  protected async persistMarkerToObservedMessage(
    marker: { type: string; data: unknown },
    observed: MastraDBMessage[],
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    const observedIds = new Set(observed.map(m => m.id));
    const list = threadId === this.opts.threadId ? this.opts.messageList : undefined;
    const listMessages = list ? getObservableMessages(list) : [];
    const live = [...listMessages].reverse().find(m => m.role === 'assistant');
    if (live && (observedIds.has(live.id) || !hasUnobservedContent(live))) {
      await this.attachMarker(marker, live, live.content.parts.length, threadId, resourceId);
      return;
    }

    const target = [...observed].reverse().find(m => m.role === 'assistant');
    if (target) {
      const fromList = listMessages.find(m => m.id === target.id);
      if (fromList) {
        await this.attachMarker(marker, fromList, fromList.content.parts.length, threadId, resourceId);
        return;
      }
      try {
        const stored = (await this.storage.listMessagesById({ messageIds: [target.id] })).messages[0];
        if (stored?.content?.parts && Array.isArray(stored.content.parts)) {
          const afterStart = afterOwnStartMarker(stored, marker);
          const index = afterStart !== -1 ? afterStart : this.insertionAfterObserved(stored, target);
          await this.attachMarker(marker, stored, index, threadId, resourceId);
        }
      } catch (e) {
        omDebug(`[OM:persistMarkerToObservedMessage] failed to load marker target: ${e}`);
      }
      return;
    }

    const observedTimes = observed.filter(m => m.createdAt).map(m => new Date(m.createdAt!).getTime());
    if (observedTimes.length === 0) return;
    await this.persistMarkerToStorage(marker, threadId, resourceId, {
      notAfter: new Date(Math.max(...observedTimes)),
      onlyIfObserved: true,
    });
  }

  /** What the cycle observed of each message, captured when it placed its first marker there. */
  private readonly observedParts = new Map<string, { count: number; observedIsTrimmed: boolean }>();

  /**
   * Index in `stored` right after the parts the cycle observed in `observed` (and any OM markers
   * directly after them). Parts are only ever appended, so the observed message's non-marker part
   * count locates them, counted from the start of the message or, when `observed` is the trimmed
   * copy `getUnobservedMessages` returns for an already marked message, from just after the stored
   * copy's last completed boundary. Captured at the cycle's first marker, before the Observer runs,
   * because `observed` may be a live reference that grows meanwhile. Falls back to the end when the
   * stored copy has fewer parts than were observed.
   */
  private insertionAfterObserved(stored: MastraDBMessage, observed: MastraDBMessage): number {
    if (!this.observedParts.has(observed.id)) {
      this.observedParts.set(observed.id, {
        count: (observed.content?.parts ?? []).filter(part => !isOmPart(part)).length,
        observedIsTrimmed: findLastCompletedObservationBoundary(observed) === -1,
      });
    }
    const { count, observedIsTrimmed } = this.observedParts.get(observed.id)!;
    const parts = stored.content.parts;
    let index = observedIsTrimmed ? findLastCompletedObservationBoundary(stored) + 1 : 0;
    let seen = 0;
    while (index < parts.length && seen < count) {
      if (!isOmPart(parts[index])) seen++;
      index++;
    }
    if (seen < count) return parts.length;
    while (index < parts.length && isOmPart(parts[index])) index++;
    return index;
  }

  private async attachMarker(
    marker: { type: string; data: unknown },
    msg: MastraDBMessage,
    index: number,
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    const parts = msg.content?.parts;
    if (!parts || !Array.isArray(parts)) return;
    const markerData = marker.data as { cycleId?: string } | undefined;
    const alreadyPresent =
      markerData?.cycleId && parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
    if (!alreadyPresent) {
      parts.splice(index, 0, marker as any);
    }
    try {
      await this.messageHistory.persistMessages({ messages: [msg], threadId, resourceId });
    } catch (e) {
      omDebug(`[OM:persistMarkerToObservedMessage] failed to save marker to DB: ${e}`);
    }
  }

  /**
   * Persist a marker to the last assistant message in storage.
   * Fetches messages directly from the DB so it works even when
   * no MessageList is available (e.g. async buffering ops).
   */
  protected async persistMarkerToStorage(
    marker: { type: string; data: unknown },
    threadId: string,
    resourceId?: string,
    opts?: {
      notAfter?: Date;
      /** Only mark a message whose content is all observed, or that carries this cycle's start marker. */
      onlyIfObserved?: boolean;
    },
  ): Promise<void> {
    try {
      const result = await this.storage.listMessages({
        threadId,
        perPage: 20,
        orderBy: { field: 'createdAt', direction: 'DESC' },
        ...(opts?.notAfter ? { filter: { dateRange: { end: opts.notAfter } } } : {}),
      });
      const assistants = (result?.messages ?? []).filter(
        msg => msg?.role === 'assistant' && Array.isArray(msg.content?.parts),
      );
      // An end/failed marker belongs with this cycle's start marker, even if a newer assistant
      // message was saved meanwhile; otherwise the start marker would look in progress forever.
      const msg =
        (opts?.onlyIfObserved ? assistants.find(m => afterOwnStartMarker(m, marker) !== -1) : undefined) ??
        assistants[0];
      if (!msg) return;
      const markerData = marker.data as { cycleId?: string } | undefined;
      const alreadyPresent =
        markerData?.cycleId &&
        msg.content.parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
      const afterStart = afterOwnStartMarker(msg, marker);
      // A marker after content the cycle never observed would hide it from the actor.
      if (opts?.onlyIfObserved && afterStart === -1 && hasUnobservedContent(msg)) return;
      if (!alreadyPresent) {
        msg.content.parts.splice(afterStart !== -1 ? afterStart : msg.content.parts.length, 0, marker as any);
      }
      await this.messageHistory.persistMessages({ messages: [msg], threadId, resourceId });
    } catch (e) {
      omDebug(`[OM:persistMarkerToStorage] failed to save marker to DB: ${e}`);
    }
  }

  /**
   * Persist a marker part on the last assistant message in a MessageList
   * AND save the updated message to the DB.
   *
   * @returns true when a marker was placed on an assistant message, false when
   *   no list was provided or the list contains no assistant message (caller
   *   should fall back to `persistMarkerToStorage`).
   */
  protected async persistMarkerToMessage(
    marker: { type: string; data: unknown },
    messageList: MessageList | undefined,
    threadId: string,
    resourceId?: string,
  ): Promise<boolean> {
    if (!messageList) return false;
    const allMsgs = getObservableMessages(messageList);
    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (msg?.role === 'assistant' && msg.content?.parts && Array.isArray(msg.content.parts)) {
        const markerData = marker.data as { cycleId?: string } | undefined;
        const alreadyPresent =
          markerData?.cycleId &&
          msg.content.parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
        if (!alreadyPresent) {
          msg.content.parts.push(marker as any);
        }
        try {
          await this.messageHistory.persistMessages({
            messages: [msg],
            threadId,
            resourceId,
          });
        } catch (e) {
          omDebug(`[OM:persistMarker] failed to save marker to DB: ${e}`);
        }
        return true;
      }
    }
    return false;
  }

  // ── Abstract phase methods ──────────────────────────────────

  abstract get needsLock(): boolean;
  abstract get needsReflection(): boolean;
  abstract get rethrowOnFailure(): boolean;
  abstract prepare(): Promise<{ messages: MastraDBMessage[]; existingObservations: string }>;
  abstract observe(existingObservations: string, messages: MastraDBMessage[]): Promise<ObserverOutput>;
  abstract process(output: ObserverOutput, existingObservations: string): Promise<ProcessedObservation>;
  abstract persist(processed: ProcessedObservation): Promise<ObservationPersistOutcome | void>;
  abstract emitStartMarkers(cycleId: string): Promise<void>;
  abstract emitEndMarkers(cycleId: string, processed: ProcessedObservation): Promise<void>;
  abstract emitFailedMarkers(cycleId: string, error: unknown): Promise<void>;
}
