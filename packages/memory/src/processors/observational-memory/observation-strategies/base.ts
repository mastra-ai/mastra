import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryStorage } from '@mastra/core/storage';

import { omError } from '../debug';
import type { ObservationalMemory } from '../observational-memory';
import { getMaxThreshold } from '../thresholds';
import type { TokenCounter } from '../token-counter';
import type { ObservationMarkerConfig, ResolvedObservationConfig, ResolvedReflectionConfig } from '../types';

import type { ObservationRunOpts, ObserverOutput, ProcessedObservation } from './types';

/**
 * Abstract base class for observation strategies.
 *
 * Each strategy implements the phases of the observation lifecycle
 * (prepare → observe → process → persist) while the base class handles
 * the shared orchestration (lock guard, marker emission, reflection, error handling).
 */
export abstract class ObservationStrategy {
  protected readonly storage: MemoryStorage;
  protected readonly tokenCounter: TokenCounter;
  protected readonly observationConfig: ResolvedObservationConfig;
  protected readonly reflectionConfig: ResolvedReflectionConfig;
  protected readonly scope: 'thread' | 'resource';

  /** Select the right strategy based on scope and mode. Wired up by index.ts. */
  static create: (om: ObservationalMemory, opts: ObservationRunOpts) => ObservationStrategy;

  constructor(
    protected readonly om: ObservationalMemory,
    protected readonly opts: ObservationRunOpts,
  ) {
    this.storage = om.getStorage();
    this.tokenCounter = om.getTokenCounter();
    this.observationConfig = om.getObservationConfig();
    this.reflectionConfig = om.getReflectionConfig();
    this.scope = om.scope;
  }

  /** Run the full observation lifecycle. */
  async run(): Promise<void> {
    const { record, threadId, abortSignal, writer, reflectionHooks, requestContext } = this.opts;
    const cycleId = this.generateCycleId();

    try {
      if (this.needsLock) {
        const fresh = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
        if (fresh?.lastObservedAt && record.lastObservedAt && fresh.lastObservedAt > record.lastObservedAt) {
          return;
        }
      }

      const { messages, existingObservations } = await this.prepare();
      await this.emitStartMarkers(cycleId);
      const output = await this.observe(existingObservations, messages);
      const processed = await this.process(output, existingObservations);
      await this.persist(processed);
      await this.emitEndMarkers(cycleId, processed);

      if (this.needsReflection) {
        await this.om.reflector.maybeReflect({
          record: { ...record, activeObservations: processed.observations },
          observationTokens: processed.observationTokens,
          threadId,
          writer,
          abortSignal,
          reflectionHooks,
          requestContext,
        });
      }
    } catch (error) {
      await this.emitFailedMarkers(cycleId, error);
      if (abortSignal?.aborted) throw error;
      omError('[OM] Observation failed', error);
    }
  }

  // ── Shared helpers ──────────────────────────────────────────

  protected generateCycleId(): string {
    return crypto.randomUUID();
  }

  protected async streamMarker(marker: { type: string; data: unknown }): Promise<void> {
    if (this.opts.writer) {
      await this.opts.writer.custom(marker).catch(() => {});
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

  protected replaceOrAppendThreadSection(
    existingObservations: string,
    _threadId: string,
    newThreadSection: string,
  ): string {
    if (!existingObservations) {
      return newThreadSection;
    }

    const threadIdMatch = newThreadSection.match(/<thread id="([^"]+)">/);
    const dateMatch = newThreadSection.match(/Date:\s*([A-Za-z]+\s+\d+,\s+\d+)/);

    if (!threadIdMatch || !dateMatch) {
      return `${existingObservations}\n\n${newThreadSection}`;
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

    return `${existingObservations}\n\n${newThreadSection}`;
  }

  // ── Abstract phase methods ──────────────────────────────────

  abstract get needsLock(): boolean;
  abstract get needsReflection(): boolean;
  abstract prepare(): Promise<{ messages: MastraDBMessage[]; existingObservations: string }>;
  abstract observe(existingObservations: string, messages: MastraDBMessage[]): Promise<ObserverOutput>;
  abstract process(output: ObserverOutput, existingObservations: string): Promise<ProcessedObservation>;
  abstract persist(processed: ProcessedObservation): Promise<void>;
  abstract emitStartMarkers(cycleId: string): Promise<void>;
  abstract emitEndMarkers(cycleId: string, processed: ProcessedObservation): Promise<void>;
  abstract emitFailedMarkers(cycleId: string, error: unknown): Promise<void>;
}
