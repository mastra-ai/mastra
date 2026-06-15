import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { MessageHistory } from '@mastra/core/processors';
import type { MemoryStorage } from '@mastra/core/storage';
import xxhash from 'xxhash-wasm';

import { omDebug, omError } from '../debug';
import { stripThreadTags } from '../message-utils';
import { parseObservationGroups, wrapInObservationGroup } from '../observation-groups';
import type { ObserverRunner } from '../observer-runner';
import type { ReflectorRunner } from '../reflector-runner';
import { getMaxThreshold } from '../thresholds';
import type { TokenCounter } from '../token-counter';
import type {
  ObservationDebugEvent,
  ObservationMarkerConfig,
  ResolvedObservationConfig,
  ResolvedReflectionConfig,
} from '../types';

import type { ObservationRunOpts, ObservationRunResult, ObserverOutput, ProcessedObservation } from './types';

/** Module-level xxhash singleton — loaded once, shared across all strategy instances. */
const hasherPromise = xxhash();

/**
 * Dependencies injected into observation strategies.
 * Built by the factory in index.ts from the ObservationalMemory instance.
 */
export interface StrategyDeps {
  storage: MemoryStorage;
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
      await this.emitStartMarkers(cycleId);
      const output = await this.observe(existingObservations, messages);
      const processed = await this.process(output, existingObservations);
      await this.persist(processed);
      await this.emitEndMarkers(cycleId, processed);

      if (this.needsReflection) {
        await this.deps.reflector.maybeReflect({
          record: { ...record, activeObservations: processed.observations },
          observationTokens: processed.observationTokens,
          threadId,
          writer,
          abortSignal,
          reflectionHooks,
          requestContext,
          observabilityContext: this.opts.observabilityContext,
        });
      }

      return { observed: true, usage: output.usage };
    } catch (error) {
      await this.emitFailedMarkers(cycleId, error);

      if (!this.rethrowOnFailure) {
        const failedMarkerForStorage = {
          type: 'data-om-observation-failed',
          data: {
            cycleId,
            operationType: 'observation',
            startedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            recordId: record.id,
            threadId,
          },
        };
        await this.persistMarkerToStorage(failedMarkerForStorage, threadId, this.opts.resourceId).catch(() => {});
        if (abortSignal?.aborted) throw error;
        omError('[OM] Observation failed', error);
        return { observed: false };
      }

      // Sync + resource-scoped: same contract as pre-#14453 — rethrow after failed markers.
      omError('[OM] Observation failed', error);
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
    await this.persistMarkerToStorage(marker, markerThreadId, this.opts.resourceId);
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

  protected async indexObservationGroups(
    observations: string,
    threadId: string,
    resourceId?: string,
    observedAt?: Date,
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
        this.deps.onIndexObservations!({
          text: group.content,
          groupId: group.id,
          range: group.range,
          threadId,
          resourceId,
          observedAt,
        }),
      ),
    );
  }

  // ── Marker persistence ──────────────────────────────────────

  /**
   * Persist a marker to the last assistant message in storage.
   * Fetches messages directly from the DB so it works even when
   * no MessageList is available (e.g. async buffering ops).
   */
  protected async persistMarkerToStorage(
    marker: { type: string; data: unknown },
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    try {
      const result = await this.storage.listMessages({
        threadId,
        perPage: 20,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      const messages = result?.messages ?? [];
      for (const msg of messages) {
        if (msg?.role === 'assistant' && msg.content?.parts && Array.isArray(msg.content.parts)) {
          const markerData = marker.data as { cycleId?: string } | undefined;
          const alreadyPresent =
            markerData?.cycleId &&
            msg.content.parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
          if (!alreadyPresent) {
            msg.content.parts.push(marker as any);
          }
          await this.messageHistory.persistMessages({
            messages: [msg],
            threadId,
            resourceId,
          });
          return;
        }
      }
    } catch (e) {
      omDebug(`[OM:persistMarkerToStorage] failed to save marker to DB: ${e}`);
    }
  }

  /**
   * Persist a marker part on the last assistant message in a MessageList
   * AND save the updated message to the DB.
   */
  protected async persistMarkerToMessage(
    marker: { type: string; data: unknown },
    messageList: MessageList | undefined,
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    if (!messageList) return;
    const allMsgs = messageList.get.all.db();
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
        return;
      }
    }
  }

  // ── Abstract phase methods ──────────────────────────────────

  abstract get needsLock(): boolean;
  abstract get needsReflection(): boolean;
  abstract get rethrowOnFailure(): boolean;
  abstract prepare(): Promise<{ messages: MastraDBMessage[]; existingObservations: string }>;
  abstract observe(existingObservations: string, messages: MastraDBMessage[]): Promise<ObserverOutput>;
  abstract process(output: ObserverOutput, existingObservations: string): Promise<ProcessedObservation>;
  abstract persist(processed: ProcessedObservation): Promise<void>;
  abstract emitStartMarkers(cycleId: string): Promise<void>;
  abstract emitEndMarkers(cycleId: string, processed: ProcessedObservation): Promise<void>;
  abstract emitFailedMarkers(cycleId: string, error: unknown): Promise<void>;
}
