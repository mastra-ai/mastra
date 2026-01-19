import { Agent, convertMessages } from '@mastra/core/agent';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { getThreadOMMetadata, setThreadOMMetadata } from '@mastra/core/memory';
import type {
  Processor,
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import * as fs from 'fs';
import xxhash from 'xxhash-wasm';
import { z } from 'zod';

// ════════════════════════════════════════════════════════════
// DEBUG INSTRUMENTATION - writes to /tmp/om-debug.json
// Set OM_DEBUG_FILE=1 to enable file-based debug output
// ════════════════════════════════════════════════════════════
const OM_DEBUG_FILE = process.env.OM_DEBUG_FILE === '1' || process.env.OM_DEBUG_FILE === 'true';
const OM_DEBUG_PATH = process.env.OM_DEBUG_PATH || '/tmp/om-debug.json';

interface DebugEntry {
  timestamp: string;
  stage: string;
  data: Record<string, unknown>;
}

const debugEntries: DebugEntry[] = [];

function writeDebugEntry(stage: string, data: Record<string, unknown>): void {
  if (!OM_DEBUG_FILE) return;

  const entry: DebugEntry = {
    timestamp: new Date().toISOString(),
    stage,
    data,
  };
  debugEntries.push(entry);

  // Write to file after each entry (so we don't lose data on crash)
  try {
    fs.writeFileSync(OM_DEBUG_PATH, JSON.stringify(debugEntries, null, 2));
  } catch (e) {
    console.error(`[OM Debug] Failed to write debug file: ${e}`);
  }
}

function clearDebugEntries(): void {
  if (!OM_DEBUG_FILE) return;
  debugEntries.length = 0;
  try {
    fs.writeFileSync(OM_DEBUG_PATH, '[]');
  } catch (e) {
    // ignore
  }
}

import {
  buildObserverSystemPrompt,
  buildObserverPrompt,
  buildMultiThreadObserverPrompt,
  parseObserverOutput,
  parseMultiThreadObserverOutput,
  optimizeObservationsForContext,
  formatMessagesForObserver,
} from './observer-agent';
import {
  buildReflectorSystemPrompt,
  buildReflectorPrompt,
  parseReflectorOutput,
  validateCompression,
} from './reflector-agent';
import { TokenCounter } from './token-counter';
import type { ObserverConfig, ReflectorConfig, ThresholdRange, ModelSettings, ProviderOptions } from './types';

/**
 * Debug logging controlled by OM_DEV_DEBUG environment variable.
 * Set OM_DEV_DEBUG=1 or OM_DEV_DEBUG=true to enable debug logs.
 */
const OM_DEBUG = process.env.OM_DEV_DEBUG === '1' || process.env.OM_DEV_DEBUG === 'true';

function omDebug(...args: unknown[]): void {
  if (OM_DEBUG) {
    console.info(...args);
  }
}

function omWarn(...args: unknown[]): void {
  if (OM_DEBUG) {
    console.warn(...args);
  }
}

/**
 * Format a relative time string like "5 days ago", "2 weeks ago", "today", etc.
 */
function formatRelativeTime(date: Date, currentDate: Date): string {
  const diffMs = currentDate.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

/**
 * Add relative time annotations to date headers in observations.
 * Transforms "Date: May 15, 2023" to "Date: May 15, 2023 (5 days ago)"
 */
function formatGapBetweenDates(prevDate: Date, currDate: Date): string | null {
  const diffMs = currDate.getTime() - prevDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return null; // No gap marker for consecutive days
  } else if (diffDays < 7) {
    return `[${diffDays} days later]`;
  } else if (diffDays < 14) {
    return `[1 week later]`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `[${weeks} weeks later]`;
  } else if (diffDays < 60) {
    return `[1 month later]`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `[${months} months later]`;
  }
}

/**
 * Expand inline estimated dates with relative time.
 * Matches patterns like "(estimated May 27-28, 2023)" or "(meaning May 30, 2023)"
 * and expands them to "(meaning May 30, 2023 - which was 3 weeks ago)"
 */
/**
 * Parses a date string like "May 30, 2023", "May 27-28, 2023", "late April 2023", etc.
 * Returns the parsed Date or null if unparseable.
 */
function parseDateFromContent(dateContent: string): Date | null {
  let targetDate: Date | null = null;

  // Try simple date format first: "May 30, 2023"
  const simpleDateMatch = dateContent.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (simpleDateMatch) {
    const parsed = new Date(`${simpleDateMatch[1]} ${simpleDateMatch[2]}, ${simpleDateMatch[3]}`);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  // Try range format: "May 27-28, 2023" - use first date
  if (!targetDate) {
    const rangeMatch = dateContent.match(/([A-Z][a-z]+)\s+(\d{1,2})-\d{1,2},?\s+(\d{4})/);
    if (rangeMatch) {
      const parsed = new Date(`${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[3]}`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // Try "late/early/mid Month Year" format
  if (!targetDate) {
    const vagueMatch = dateContent.match(
      /(late|early|mid)[- ]?(?:to[- ]?(?:late|early|mid)[- ]?)?([A-Z][a-z]+)\s+(\d{4})/i,
    );
    if (vagueMatch) {
      const month = vagueMatch[2];
      const year = vagueMatch[3];
      const modifier = vagueMatch[1]!.toLowerCase();
      let day = 15; // default to middle
      if (modifier === 'early') day = 7;
      if (modifier === 'late') day = 23;
      const parsed = new Date(`${month} ${day}, ${year}`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // Try "Month to Month Year" format (cross-month range)
  if (!targetDate) {
    const crossMonthMatch = dateContent.match(/([A-Z][a-z]+)\s+to\s+(?:early\s+)?([A-Z][a-z]+)\s+(\d{4})/i);
    if (crossMonthMatch) {
      // Use the middle of the range - approximate with second month
      const parsed = new Date(`${crossMonthMatch[2]} 1, ${crossMonthMatch[3]}`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  return targetDate;
}

/**
 * Detects if an observation line indicates future intent (will do, plans to, looking forward to, etc.)
 */
function isFutureIntentObservation(line: string): boolean {
  const futureIntentPatterns = [
    /\bwill\s+(?:be\s+)?(?:\w+ing|\w+)\b/i,
    /\bplans?\s+to\b/i,
    /\bplanning\s+to\b/i,
    /\blooking\s+forward\s+to\b/i,
    /\bgoing\s+to\b/i,
    /\bintends?\s+to\b/i,
    /\bwants?\s+to\b/i,
    /\bneeds?\s+to\b/i,
    /\babout\s+to\b/i,
  ];
  return futureIntentPatterns.some(pattern => pattern.test(line));
}

function expandInlineEstimatedDates(observations: string, currentDate: Date): string {
  // Match patterns like:
  // (estimated May 27-28, 2023)
  // (meaning May 30, 2023)
  // (estimated late April to early May 2023)
  // (estimated mid-to-late May 2023)
  // These should now be at the END of observation lines
  const inlineDateRegex = /\((estimated|meaning)\s+([^)]+\d{4})\)/gi;

  return observations.replace(inlineDateRegex, (match, prefix: string, dateContent: string) => {
    const targetDate = parseDateFromContent(dateContent);

    if (targetDate) {
      const relative = formatRelativeTime(targetDate, currentDate);

      // Check if this is a future-intent observation that's now in the past
      // We need to look at the text BEFORE this match to determine intent
      const matchIndex = observations.indexOf(match);
      const lineStart = observations.lastIndexOf('\n', matchIndex) + 1;
      const lineBeforeDate = observations.substring(lineStart, matchIndex);

      const isPastDate = targetDate < currentDate;
      const isFutureIntent = isFutureIntentObservation(lineBeforeDate);

      if (isPastDate && isFutureIntent) {
        // This was a planned action that should have happened by now
        return `(${prefix} ${dateContent} - ${relative}, likely already happened)`;
      }

      return `(${prefix} ${dateContent} - ${relative})`;
    }

    // Couldn't parse, return original
    return match;
  });
}

function addRelativeTimeToObservations(observations: string, currentDate: Date): string {
  // First, expand inline estimated dates with relative time
  const withInlineDates = expandInlineEstimatedDates(observations, currentDate);

  // Match date headers like "Date: May 15, 2023" or "Date: January 1, 2024"
  const dateHeaderRegex = /^(Date:\s*)([A-Z][a-z]+ \d{1,2}, \d{4})$/gm;

  // First pass: collect all dates in order
  const dates: { index: number; date: Date; match: string; prefix: string; dateStr: string }[] = [];
  let regexMatch: RegExpExecArray | null;
  while ((regexMatch = dateHeaderRegex.exec(withInlineDates)) !== null) {
    const dateStr = regexMatch[2]!;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      dates.push({
        index: regexMatch.index,
        date: parsed,
        match: regexMatch[0],
        prefix: regexMatch[1]!,
        dateStr,
      });
    }
  }

  // If no dates found, return the inline-expanded version
  if (dates.length === 0) {
    return withInlineDates;
  }

  // Second pass: build result with relative times and gap markers
  let result = '';
  let lastIndex = 0;

  for (let i = 0; i < dates.length; i++) {
    const curr = dates[i]!;
    const prev = i > 0 ? dates[i - 1]! : null;

    // Add text before this date header
    result += withInlineDates.slice(lastIndex, curr.index);

    // Add gap marker if there's a significant gap from previous date
    if (prev) {
      const gap = formatGapBetweenDates(prev.date, curr.date);
      if (gap) {
        result += `\n${gap}\n\n`;
      }
    }

    // Add the date header with relative time
    const relative = formatRelativeTime(curr.date, currentDate);
    result += `${curr.prefix}${curr.dateStr} (${relative})`;

    lastIndex = curr.index + curr.match.length;
  }

  // Add remaining text after last date header
  result += withInlineDates.slice(lastIndex);

  return result;
}

/**
 * Simple slugify utility - converts a string to a URL-friendly slug.
 * Avoids external dependency for this simple use case.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}

/**
 * Debug event emitted when observation-related events occur.
 * Useful for understanding what the Observer is doing.
 */
export interface ObservationDebugEvent {
  type:
    | 'observation_triggered'
    | 'observation_complete'
    | 'reflection_triggered'
    | 'reflection_complete'
    | 'tokens_accumulated';
  timestamp: Date;
  threadId: string;
  resourceId: string;
  /** Messages that were sent to the Observer */
  messages?: Array<{ role: string; content: string }>;
  /** Token counts */
  pendingTokens?: number;
  sessionTokens?: number;
  totalPendingTokens?: number;
  threshold?: number;
  /** Input token count (for reflection events) */
  inputTokens?: number;
  /** Number of active observations (for reflection events) */
  activeObservationsLength?: number;
  /** Output token count after reflection */
  outputTokens?: number;
  /** The observations that were generated */
  observations?: string;
  /** Previous observations (before this event) */
  previousObservations?: string;
  /** Observer's raw output */
  rawObserverOutput?: string;
  /** LLM usage from Observer/Reflector calls */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Configuration for ObservationalMemory
 */
export interface ObservationalMemoryConfig {
  /**
   * Storage adapter for persisting observations.
   * Must be a MemoryStorage instance (from MastraStorage.stores.memory).
   */
  storage: MemoryStorage;

  /**
   * Observer configuration
   */
  observer?: ObserverConfig;

  /**
   * Reflector configuration
   */
  reflector?: ReflectorConfig;

  /**
   * Memory scope for observations.
   * - 'resource': Observations span all threads for a resource (cross-thread memory)
   * - 'thread': Observations are per-thread (default)
   */
  scope?: 'resource' | 'thread';

  /**
   * Debug callback for observation events.
   * Called whenever observation-related events occur.
   * Useful for debugging and understanding the observation flow.
   */
  onDebugEvent?: (event: ObservationDebugEvent) => void;

  obscureThreadIds?: boolean;

  /**
   * Only observe messages created after OM is enabled.
   * When true (default), historical messages are skipped on first observation.
   * This prevents churning through millions of existing messages.
   *
   * @default true
   */
  observeFutureOnly?: boolean;
}

/**
 * Internal resolved config with all defaults applied
 */
interface ResolvedObserverConfig {
  model: MastraModelConfig;
  observationThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
  maxTokensPerBatch: number;
  sequentialBatches: boolean;
}

interface ResolvedReflectorConfig {
  model: MastraModelConfig;
  reflectionThreshold: number | ThresholdRange;
  bufferEvery?: number;
  modelSettings: Required<ModelSettings>;
  providerOptions: ProviderOptions;
}

/**
 * Default configuration values matching the spec
 */
export const OBSERVATIONAL_MEMORY_DEFAULTS = {
  observer: {
    model: 'google/gemini-2.5-flash',
    observationThreshold: 30_000,
    modelSettings: {
      temperature: 0.3,
      maxOutputTokens: 100_000,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 215,
        },
      },
    },
  },
  reflector: {
    model: 'google/gemini-2.5-flash',
    reflectionThreshold: 40_000,
    modelSettings: {
      temperature: 0, // Use 0 for maximum consistency in reflections
      maxOutputTokens: 100_000,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC BUFFERING - DISABLED FOR INITIAL IMPLEMENTATION
// The buffering system is commented out to ensure correctness with a simple
// blocking implementation first. Re-enable once the core logic is verified.
// ═══════════════════════════════════════════════════════════════════════════

// /**
//  * Tracks in-progress async buffering operations
//  */
// interface BufferingOperation {
//   /** Promise that resolves when buffering completes */
//   promise: Promise<void>;
//   /** Token count when buffering started */
//   startedAtTokens: number;
//   /** Timestamp when buffering started */
//   startedAt: Date;
// }

// /** Timeout for waiting on in-progress buffering (ms) */
// const BUFFERING_WAIT_TIMEOUT = 60_000; // 60 seconds

/**
 * ObservationalMemory - A three-agent memory system for long conversations.
 *
 * This processor:
 * 1. On input: Injects observations into context, filters out observed messages
 * 2. On output: Tracks new messages, triggers Observer/Reflector when thresholds hit
 *
 * The Actor (main agent) sees:
 * - Observations (compressed history)
 * - Suggested continuation message
 * - Recent unobserved messages
 *
 * @example
 * ```ts
 * import { ObservationalMemory } from '@mastra/memory/experiments';
 *
 * // Minimal configuration
 * const om = new ObservationalMemory({ storage });
 *
 * // Full configuration
 * const om = new ObservationalMemory({
 *   storage,
 *   observer: {
 *     model: 'google/gemini-2.5-flash',
 *     observationThreshold: 10_000, // or { min: 8_000, max: 15_000 }
 *     bufferEvery: 4_000,
 *     modelSettings: { temperature: 0.3 },
 *   },
 *   reflector: {
 *     model: 'google/gemini-2.5-flash',
 *     reflectionThreshold: 30_000,
 *     bufferEvery: 15_000,
 *   },
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [om],
 *   outputProcessors: [om],
 * });
 * ```
 */
export class ObservationalMemory implements Processor<'observational-memory'> {
  readonly id = 'observational-memory' as const;
  readonly name = 'Observational Memory';

  private storage: MemoryStorage;
  private tokenCounter: TokenCounter;
  private scope: 'resource' | 'thread';
  private observerConfig: ResolvedObserverConfig;
  private reflectorConfig: ResolvedReflectorConfig;
  private onDebugEvent?: (event: ObservationDebugEvent) => void;

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  // ASYNC BUFFERING DISABLED - See note at top of file
  // /**
  //  * Track in-progress observation buffering per record.
  //  * Key is recordId, value is the buffering operation.
  //  */
  // private observationBuffering: Map<string, BufferingOperation> = new Map();

  // /**
  //  * Track in-progress reflection buffering per record.
  //  * Key is recordId, value is the buffering operation.
  //  */
  // private reflectionBuffering: Map<string, BufferingOperation> = new Map();

  private shouldObscureThreadIds = false;
  private hasher = xxhash();
  private threadIdCache = new Map<string, string>();

  /**
   * TEMPORARY DEBUG: Track all message IDs that have been observed during this instance's lifetime.
   * Used to detect duplicate observation bugs. Throws an error if the same message is observed twice.
   */
  private observedMessageIds = new Set<string>();

  /** Whether to extract patterns in Observer */
  private observerRecognizePatterns: boolean;

  /** Whether to consolidate patterns in Reflector */
  private reflectorRecognizePatterns: boolean;

  /** Only observe messages created after OM is enabled */
  private observeFutureOnly: boolean;

  constructor(config: ObservationalMemoryConfig) {
    this.shouldObscureThreadIds = config.obscureThreadIds || false;
    this.storage = config.storage;
    this.scope = config.scope ?? 'thread';
    this.observerRecognizePatterns = config.observer?.recognizePatterns ?? false;
    this.reflectorRecognizePatterns = config.reflector?.recognizePatterns ?? false;
    this.observeFutureOnly = config.observeFutureOnly ?? true;

    // Resolve observer config with defaults
    this.observerConfig = {
      model: config.observer?.model ?? OBSERVATIONAL_MEMORY_DEFAULTS.observer.model,
      observationThreshold:
        config.observer?.observationThreshold ?? OBSERVATIONAL_MEMORY_DEFAULTS.observer.observationThreshold,
      bufferEvery: config.observer?.bufferEvery,
      modelSettings: {
        temperature:
          config.observer?.modelSettings?.temperature ??
          OBSERVATIONAL_MEMORY_DEFAULTS.observer.modelSettings.temperature,
        maxOutputTokens:
          config.observer?.modelSettings?.maxOutputTokens ??
          OBSERVATIONAL_MEMORY_DEFAULTS.observer.modelSettings.maxOutputTokens,
      },
      providerOptions: config.observer?.providerOptions ?? OBSERVATIONAL_MEMORY_DEFAULTS.observer.providerOptions,
      maxTokensPerBatch: config.observer?.maxTokensPerBatch ?? 5000,
      sequentialBatches: config.observer?.sequentialBatches ?? false,
    };

    // Resolve reflector config with defaults
    this.reflectorConfig = {
      model: config.reflector?.model ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflector.model,
      reflectionThreshold:
        config.reflector?.reflectionThreshold ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflector.reflectionThreshold,
      bufferEvery: config.reflector?.bufferEvery,
      modelSettings: {
        temperature:
          config.reflector?.modelSettings?.temperature ??
          OBSERVATIONAL_MEMORY_DEFAULTS.reflector.modelSettings.temperature,
        maxOutputTokens:
          config.reflector?.modelSettings?.maxOutputTokens ??
          OBSERVATIONAL_MEMORY_DEFAULTS.reflector.modelSettings.maxOutputTokens,
      },
      providerOptions: config.reflector?.providerOptions ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflector.providerOptions,
    };

    this.tokenCounter = new TokenCounter();
    this.onDebugEvent = config.onDebugEvent;

    // ASYNC BUFFERING DISABLED - validation not needed
    // this.validateBufferConfig();
  }

  /**
   * Emit a debug event if the callback is configured
   */
  private emitDebugEvent(event: ObservationDebugEvent): void {
    if (this.onDebugEvent) {
      this.onDebugEvent(event);
    }
  }

  // ASYNC BUFFERING DISABLED - See note at top of file
  // /**
  //  * Validate that bufferEvery is less than the threshold
  //  */
  // private validateBufferConfig(): void {
  //   const observerThreshold = this.getMaxThreshold(this.observerConfig.observationThreshold);
  //   if (this.observerConfig.bufferEvery && this.observerConfig.bufferEvery >= observerThreshold) {
  //     throw new Error(
  //       `observer.bufferEvery (${this.observerConfig.bufferEvery}) must be less than observationThreshold (${observerThreshold})`,
  //     );
  //   }

  //   const reflectorThreshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
  //   if (this.reflectorConfig.bufferEvery && this.reflectorConfig.bufferEvery >= reflectorThreshold) {
  //     throw new Error(
  //       `reflector.bufferEvery (${this.reflectorConfig.bufferEvery}) must be less than reflectionThreshold (${reflectorThreshold})`,
  //     );
  //   }
  // }

  /**
   * Get the maximum value from a threshold (simple number or range)
   */
  private getMaxThreshold(threshold: number | ThresholdRange): number {
    if (typeof threshold === 'number') {
      return threshold;
    }
    return threshold.max;
  }

  /**
   * Get the minimum value from a threshold (simple number or range)
   */
  private getMinThreshold(threshold: number | ThresholdRange): number {
    if (typeof threshold === 'number') {
      return threshold;
    }
    return threshold.min;
  }

  /**
   * Calculate dynamic threshold based on observation space.
   * When observations are full, use min threshold.
   * When observations have room, use max threshold.
   */
  private calculateDynamicThreshold(
    threshold: number | ThresholdRange,
    currentObservationTokens: number,
    maxObservationTokens: number,
  ): number {
    if (typeof threshold === 'number') {
      return threshold;
    }

    // Calculate how "full" observations are (0 = empty, 1 = full)
    const fullness = Math.min(currentObservationTokens / maxObservationTokens, 1);

    // Interpolate: full observations = min threshold, empty = max threshold
    return Math.round(threshold.max - fullness * (threshold.max - threshold.min));
  }

  /**
   * Get or create the Observer agent
   */
  private getObserverAgent(): Agent {
    if (!this.observerAgent) {
      // Build system prompt with pattern recognition configuration
      const systemPrompt = buildObserverSystemPrompt(this.observerRecognizePatterns);

      this.observerAgent = new Agent({
        id: 'observational-memory-observer',
        name: 'Observer',
        instructions: systemPrompt,
        model: this.observerConfig.model,
      });
    }
    return this.observerAgent;
  }

  /**
   * Get or create the Reflector agent
   */
  private getReflectorAgent(): Agent {
    if (!this.reflectorAgent) {
      // Build system prompt with pattern recognition configuration
      const systemPrompt = buildReflectorSystemPrompt(this.reflectorRecognizePatterns);

      this.reflectorAgent = new Agent({
        id: 'observational-memory-reflector',
        name: 'Reflector',
        instructions: systemPrompt,
        model: this.reflectorConfig.model,
      });
    }
    return this.reflectorAgent;
  }

  /**
   * Get thread/resource IDs for storage lookup
   */
  private getStorageIds(threadId: string, resourceId?: string): { threadId: string | null; resourceId: string } {
    if (this.scope === 'resource') {
      return {
        threadId: null,
        resourceId: resourceId ?? threadId,
      };
    }
    return {
      threadId,
      resourceId: resourceId ?? threadId,
    };
  }

  /**
   * Get or create the observational memory record
   */
  private async getOrCreateRecord(threadId: string, resourceId?: string): Promise<ObservationalMemoryRecord> {
    const ids = this.getStorageIds(threadId, resourceId);
    let record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);

    if (!record) {
      // When observeFutureOnly is true, set lastObservedAt to now so we skip historical messages
      const initialLastObservedAt = this.observeFutureOnly ? new Date() : undefined;

      record = await this.storage.initializeObservationalMemory({
        threadId: ids.threadId,
        resourceId: ids.resourceId,
        scope: this.scope,
        config: {
          observer: this.observerConfig,
          reflector: this.reflectorConfig,
          scope: this.scope,
        },
      });

      // If observeFutureOnly, immediately update the record with the current timestamp
      if (initialLastObservedAt && record.id) {
        await this.storage.updateActiveObservations({
          id: record.id,
          observations: record.activeObservations || '',
          tokenCount: 0,
          lastObservedAt: initialLastObservedAt,
        });
        record.lastObservedAt = initialLastObservedAt;
      }
    }

    return record;
  }

  /**
   * Check if we need to trigger observation.
   * Uses dynamic threshold if range is configured.
   */
  private shouldObserve(messageTokens: number, observationTokens: number = 0): boolean {
    const threshold = this.calculateDynamicThreshold(
      this.observerConfig.observationThreshold,
      observationTokens,
      this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
    );
    return messageTokens > threshold;
  }

  /**
   * Check if we need to trigger reflection.
   */
  private shouldReflect(observationTokens: number): boolean {
    const threshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
    return observationTokens > threshold;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASYNC BUFFERING METHODS - DISABLED FOR INITIAL IMPLEMENTATION
  // ═══════════════════════════════════════════════════════════════════════════

  // /**
  //  * Check if we should start buffering observations.
  //  * Returns true if:
  //  * - bufferEvery is configured
  //  * - We've crossed the bufferEvery threshold
  //  * - We haven't crossed the main threshold yet
  //  * - No buffering is already in progress for this record
  //  */
  // private shouldStartObservationBuffering(recordId: string, messageTokens: number, observationTokens: number): boolean {
  //   const bufferEvery = this.observerConfig.bufferEvery;
  //   if (!bufferEvery) return false;

  //   // Check if buffering is already in progress
  //   if (this.observationBuffering.has(recordId)) return false;

  //   // Check if there's already buffered content waiting
  //   // (This would be checked via record.bufferedObservations, but we keep it simple here)

  //   // Check if we've crossed bufferEvery but not the main threshold
  //   const mainThreshold = this.calculateDynamicThreshold(
  //     this.observerConfig.observationThreshold,
  //     observationTokens,
  //     this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
  //   );

  //   return messageTokens >= bufferEvery && messageTokens < mainThreshold;
  // }

  // /**
  //  * Check if we should start buffering reflections.
  //  */
  // private shouldStartReflectionBuffering(recordId: string, observationTokens: number): boolean {
  //   const bufferEvery = this.reflectorConfig.bufferEvery;
  //   if (!bufferEvery) return false;

  //   // Check if buffering is already in progress
  //   if (this.reflectionBuffering.has(recordId)) return false;

  //   // Check if we've crossed bufferEvery but not the main threshold
  //   const mainThreshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);

  //   return observationTokens >= bufferEvery && observationTokens < mainThreshold;
  // }

  // /**
  //  * Start async observation buffering in the background.
  //  * Does NOT block - returns immediately and runs in background.
  //  */
  // private startObservationBuffering(
  //   record: ObservationalMemoryRecord,
  //   threadId: string,
  //   unobservedMessages: MastraDBMessage[],
  //   currentTokens: number,
  // ): void {
  //   const messageIds = unobservedMessages.map(m => m.id).filter((id): id is string => !!id);

  //   omDebug(`[OM Buffering] Starting async observation buffering for ${record.id} (${currentTokens} tokens)`);

  //   // Create the async operation
  //   const bufferingPromise = (async () => {
  //     try {
  //       // Mark messages as being buffered
  //       await this.storage.markMessagesAsBuffering(record.id, messageIds);

  //       // Call Observer agent
  //       const result = await this.callObserver(record.activeObservations, unobservedMessages);

  //       // In resource scope, add thread header
  //       let observationsWithHeader = result.observations;
  //       if (this.scope === 'resource') {
  //         observationsWithHeader = `**Thread: ${threadId}**\n\n${result.observations}`;
  //       }

  //       // Store as buffered (NOT active yet)
  //       await this.storage.updateBufferedObservations({
  //         id: record.id,
  //         observations: observationsWithHeader,
  //         messageIds,
  //         suggestedContinuation: result.suggestedContinuation,
  //       });

  //       omDebug(`[OM Buffering] Observation buffering complete for ${record.id}`);
  //     } catch (error) {
  //       console.error(`[OM Buffering] Observation buffering failed for ${record.id}:`, error);
  //       // Clear buffering state on failure
  //       await this.storage.markMessagesAsBuffering(record.id, []);
  //       throw error;
  //     } finally {
  //       // Remove from tracking
  //       this.observationBuffering.delete(record.id);
  //     }
  //   })();

  //   // Track the operation
  //   this.observationBuffering.set(record.id, {
  //     promise: bufferingPromise,
  //     startedAtTokens: currentTokens,
  //     startedAt: new Date(),
  //   });
  // }

  // /**
  //  * Start async reflection buffering in the background.
  //  */
  // private startReflectionBuffering(record: ObservationalMemoryRecord, observations: string): void {
  //   omDebug(`[OM Buffering] Starting async reflection buffering for ${record.id}`);

  //   const bufferingPromise = (async () => {
  //     try {
  //       const result = await this.callReflector(observations);

  //       // Store as buffered reflection
  //       await this.storage.updateBufferedReflection(record.id, result.observations);

  //       omDebug(`[OM Buffering] Reflection buffering complete for ${record.id}`);
  //     } catch (error) {
  //       console.error(`[OM Buffering] Reflection buffering failed for ${record.id}:`, error);
  //       throw error;
  //     } finally {
  //       this.reflectionBuffering.delete(record.id);
  //     }
  //   })();

  //   this.reflectionBuffering.set(record.id, {
  //     promise: bufferingPromise,
  //     startedAtTokens: record.observationTokenCount,
  //     startedAt: new Date(),
  //   });
  // }

  // /**
  //  * Wait for in-progress buffering with timeout.
  //  */
  // private async waitForBuffering(operation: BufferingOperation, type: 'observation' | 'reflection'): Promise<void> {
  //   const elapsed = Date.now() - operation.startedAt.getTime();
  //   const remaining = BUFFERING_WAIT_TIMEOUT - elapsed;

  //   if (remaining <= 0) {
  //     throw new Error(`[OM] ${type} buffering timeout exceeded (started ${elapsed}ms ago)`);
  //   }

  //   omDebug(`[OM] Waiting for in-progress ${type} buffering (max ${remaining}ms)...`);

  //   // Race between the operation and timeout
  //   await Promise.race([
  //     operation.promise,
  //     new Promise<never>((_, reject) =>
  //       setTimeout(() => reject(new Error(`[OM] ${type} buffering wait timeout`)), remaining),
  //     ),
  //   ]);
  // }

  /**
   * Get unobserved messages.
   * With cursor-based loading via lastObservedAt, all messages returned from
   * loadUnobservedMessages are already unobserved. This method is kept for
   * compatibility with processOutputResult which receives messages from messageList.
   */
  private getUnobservedMessages(allMessages: MastraDBMessage[], record: ObservationalMemoryRecord): MastraDBMessage[] {
    // With cursor-based loading, messages after lastObservedAt are unobserved.
    // Filter by createdAt timestamp instead of message IDs.
    const lastObservedAt = record.lastObservedAt;
    if (!lastObservedAt) {
      // No observations yet - all messages are unobserved
      return allMessages;
    }

    return allMessages.filter(msg => {
      if (!msg.createdAt) return true; // Include messages without timestamps
      const msgDate = new Date(msg.createdAt);
      // Use > (exclusive) because lastObservedAt is the timestamp of the last observed message
      return msgDate > lastObservedAt;
    });
  }

  /**
   * Retry wrapper for LLM calls with exponential backoff.
   * Handles 429 rate limit errors by waiting and retrying.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    context = 'LLM call',
    contextData?: { prompt?: string; messages?: MastraDBMessage[] },
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const is429 = error?.statusCode === 429 || error?.message?.includes('Too Many Requests');
        const errorMessage = error?.message || '';
        const errorString = String(error);
        const causeString = error?.cause ? String(error.cause) : '';
        const isProhibited =
          errorMessage.includes('PROHIBITED_CONTENT') ||
          errorMessage.includes('blockReason') ||
          errorString.includes('PROHIBITED_CONTENT') ||
          causeString.includes('PROHIBITED_CONTENT');

        console.error(`\n🔍 [OM] Error caught in withRetry. isProhibited=${isProhibited}`);

        // If PROHIBITED_CONTENT, dump context for debugging
        if (isProhibited && contextData) {
          const dumpPath = `/tmp/om-prohibited-${Date.now()}.json`;
          console.error(`\n🔍 [OM] Attempting to dump context to: ${dumpPath}`);
          const contextDump = {
            context,
            prompt: contextData.prompt?.slice(0, 50000), // Truncate to avoid huge files
            messageCount: contextData.messages?.length,
            messages: contextData.messages?.map(m => ({
              id: m.id,
              role: m.role,
              content: JSON.stringify(m.content).slice(0, 2000),
              createdAt: m.createdAt,
            })),
            error: error?.message?.slice(0, 1000),
            timestamp: new Date().toISOString(),
          };
          try {
            const fs = await import('fs/promises');
            await fs.writeFile(dumpPath, JSON.stringify(contextDump, null, 2));
            console.error(`\n⚠️ [OM] PROHIBITED_CONTENT detected! Context dumped to: ${dumpPath}`);
          } catch {
            // Ignore write errors
          }
        }

        if (is429 && attempt < maxRetries) {
          // Extract retry-after header or use exponential backoff
          const retryAfter = parseInt(error?.responseHeaders?.['retry-after'] || '0', 10);
          const waitSeconds = retryAfter > 0 ? retryAfter : Math.pow(2, attempt + 1) * 15; // 30s, 60s, 120s

          omWarn(
            `[OM] ${context} rate limited (429). Attempt ${attempt + 1}/${maxRetries + 1}. Waiting ${waitSeconds}s...`,
          );

          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }

        throw error;
      }
    }
    throw new Error(`[OM] ${context} failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Call the Observer agent to extract observations.
   */
  private async callObserver(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    existingPatterns?: Record<string, string[]>,
  ): Promise<{
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    patterns?: Record<string, string[]>;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.getObserverAgent();

    // Format existing patterns into the observations if present
    let observationsWithPatterns = existingObservations;
    if (existingPatterns && Object.keys(existingPatterns).length > 0) {
      let patternsContent = '\n\n<patterns>';
      for (const [patternName, items] of Object.entries(existingPatterns)) {
        patternsContent += `\n<${patternName}>`;
        for (const item of items) {
          patternsContent += `\n* ${item}`;
        }
        patternsContent += `\n</${patternName}>`;
      }
      patternsContent += '\n</patterns>';
      observationsWithPatterns = (observationsWithPatterns || '') + patternsContent;
    }

    const prompt = buildObserverPrompt(observationsWithPatterns, messagesToObserve);

    const result = await this.withRetry(
      () =>
        agent.generate(prompt, {
          modelSettings: {
            temperature: this.observerConfig.modelSettings.temperature,
            maxOutputTokens: this.observerConfig.modelSettings.maxOutputTokens,
          },
          providerOptions: this.observerConfig.providerOptions as any,
        }),
      3,
      'Observer',
      { prompt, messages: messagesToObserve },
    );

    const parsed = parseObserverOutput(result.text);

    // Extract usage from result (totalUsage or usage)
    const usage = result.totalUsage ?? result.usage;

    return {
      observations: parsed.observations,
      currentTask: parsed.currentTask,
      suggestedContinuation: parsed.suggestedContinuation,
      // Only include patterns if observer patterns are enabled
      patterns: this.observerRecognizePatterns ? parsed.patterns : undefined,
      usage: usage
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    };
  }

  /**
   * Call the Observer agent for multiple threads in a single batched request.
   * This is more efficient than calling the Observer for each thread individually.
   * Returns per-thread results with observations, currentTask, and suggestedContinuation,
   * plus the total usage for the batch.
   */
  private async callMultiThreadObserver(
    existingObservations: string | undefined,
    messagesByThread: Map<string, MastraDBMessage[]>,
    threadOrder: string[],
    existingPatterns?: Record<string, string[]>,
  ): Promise<{
    results: Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
        patterns?: Record<string, string[]>;
      }
    >;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    // Create a multi-thread observer agent with the special system prompt
    const agent = new Agent({
      id: 'multi-thread-observer',
      name: 'multi-thread-observer',
      model: this.observerConfig.model,
      instructions: buildObserverSystemPrompt(this.observerRecognizePatterns, true),
    });

    // Format existing patterns into the observations if present
    let observationsWithPatterns = existingObservations;
    if (existingPatterns && Object.keys(existingPatterns).length > 0) {
      let patternsContent = '\n\n<patterns>';
      for (const [patternName, items] of Object.entries(existingPatterns)) {
        patternsContent += `\n<${patternName}>`;
        for (const item of items) {
          patternsContent += `\n* ${item}`;
        }
        patternsContent += `\n</${patternName}>`;
      }
      patternsContent += '\n</patterns>';
      observationsWithPatterns = (observationsWithPatterns || '') + patternsContent;
    }

    const prompt = buildMultiThreadObserverPrompt(observationsWithPatterns, messagesByThread, threadOrder);

    omDebug(`[OM] Calling multi-thread Observer for ${threadOrder.length} threads`);
    console.log('[OM DEBUG] Observer providerOptions:', JSON.stringify(this.observerConfig.providerOptions, null, 2));

    // Flatten all messages for context dump
    const allMessages: MastraDBMessage[] = [];
    for (const msgs of messagesByThread.values()) {
      allMessages.push(...msgs);
    }

    // TEMPORARY DEBUG: Check for duplicate message observation
    const duplicateIds: string[] = [];
    for (const msg of allMessages) {
      if (this.observedMessageIds.has(msg.id)) {
        duplicateIds.push(msg.id);
      }
    }
    if (duplicateIds.length > 0) {
      throw new Error(
        `[OM BUG] Attempting to observe ${duplicateIds.length} messages that were already observed! ` +
          `Message IDs: ${duplicateIds.slice(0, 5).join(', ')}${duplicateIds.length > 5 ? '...' : ''}. ` +
          `This indicates a bug in the observation flow - messages should only be observed once.`,
      );
    }
    // Mark all messages as observed
    for (const msg of allMessages) {
      this.observedMessageIds.add(msg.id);
    }

    debugger;
    const result = await this.withRetry(
      () =>
        agent.generate(prompt, {
          modelSettings: {
            temperature: this.observerConfig.modelSettings.temperature,
            maxOutputTokens: this.observerConfig.modelSettings.maxOutputTokens,
          },
          providerOptions: this.observerConfig.providerOptions as any,
        }),
      3,
      'MultiThreadObserver',
      { prompt, messages: allMessages },
    );

    const parsed = parseMultiThreadObserverOutput(result.text);

    omDebug(`[OM] Multi-thread Observer returned results for ${parsed.threads.size} threads`);

    // Convert to the expected return format
    const results = new Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
        patterns?: Record<string, string[]>;
      }
    >();

    for (const [threadId, threadResult] of parsed.threads) {
      results.set(threadId, {
        observations: threadResult.observations,
        currentTask: threadResult.currentTask,
        suggestedContinuation: threadResult.suggestedContinuation,
        patterns: this.observerRecognizePatterns ? threadResult.patterns : undefined,
      });
    }

    // If some threads didn't get results, log a warning
    for (const threadId of threadOrder) {
      if (!results.has(threadId)) {
        omDebug(`[OM] Warning: No observations returned for thread ${threadId}`);
        // Add empty result so we still update the cursor
        results.set(threadId, { observations: '' });
      }
    }

    // Extract usage from result
    const usage = result.totalUsage ?? result.usage;

    return {
      results,
      usage: usage
        ? {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined,
    };
  }

  /**
   * Call the Reflector agent to condense observations.
   * Includes compression validation and retry logic.
   */
  private async callReflector(
    observations: string,
    manualPrompt?: string,
    patterns?: Record<string, string[]>,
  ): Promise<{
    observations: string;
    suggestedContinuation?: string;
    patterns?: Record<string, string[]>;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    writeDebugEntry('callReflector:start', {
      inputObservationsLength: observations.length,
      inputObservationsPreview: observations.slice(0, 500),
      hasManualPrompt: !!manualPrompt,
      hasPatterns: !!patterns && Object.keys(patterns).length > 0,
    });

    const agent = this.getReflectorAgent();

    // Format patterns into the observations if present
    let observationsWithPatterns = observations;
    if (patterns && Object.keys(patterns).length > 0) {
      let patternsContent = '\n\n<patterns>';
      for (const [patternName, items] of Object.entries(patterns)) {
        patternsContent += `\n<${patternName}>`;
        for (const item of items) {
          patternsContent += `\n* ${item}`;
        }
        patternsContent += `\n</${patternName}>`;
      }
      patternsContent += '\n</patterns>';
      observationsWithPatterns += patternsContent;
    }

    const originalTokens = this.tokenCounter.countObservations(observationsWithPatterns);

    // Track total usage across attempts
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    // First attempt
    let prompt = buildReflectorPrompt(observationsWithPatterns, manualPrompt, false);
    let result = await this.withRetry(
      () =>
        agent.generate(prompt, {
          modelSettings: {
            temperature: this.reflectorConfig.modelSettings.temperature,
            maxOutputTokens: this.reflectorConfig.modelSettings.maxOutputTokens,
          },
          providerOptions: this.reflectorConfig.providerOptions as any,
        }),
      3,
      'Reflector',
    );

    // Accumulate usage from first attempt
    const firstUsage = result.totalUsage ?? result.usage;
    if (firstUsage) {
      totalUsage.inputTokens += firstUsage.inputTokens ?? 0;
      totalUsage.outputTokens += firstUsage.outputTokens ?? 0;
      totalUsage.totalTokens += firstUsage.totalTokens ?? 0;
    }

    let parsed = parseReflectorOutput(result.text);
    let reflectedTokens = this.tokenCounter.countObservations(parsed.observations);

    // Check if compression was successful
    if (!validateCompression(originalTokens, reflectedTokens)) {
      omDebug(
        `[OM] Reflection did not compress (${originalTokens} -> ${reflectedTokens}), retrying with compression guidance`,
      );

      // Retry with compression prompt
      prompt = buildReflectorPrompt(observationsWithPatterns, manualPrompt, true);
      result = await this.withRetry(
        () =>
          agent.generate(prompt, {
            modelSettings: {
              temperature: this.reflectorConfig.modelSettings.temperature,
              maxOutputTokens: this.reflectorConfig.modelSettings.maxOutputTokens,
            },
            providerOptions: this.reflectorConfig.providerOptions as any,
          }),
        3,
        'Reflector (compression retry)',
      );

      // Accumulate usage from retry attempt
      const retryUsage = result.totalUsage ?? result.usage;
      if (retryUsage) {
        totalUsage.inputTokens += retryUsage.inputTokens ?? 0;
        totalUsage.outputTokens += retryUsage.outputTokens ?? 0;
        totalUsage.totalTokens += retryUsage.totalTokens ?? 0;
      }

      parsed = parseReflectorOutput(result.text);
      reflectedTokens = this.tokenCounter.countObservations(parsed.observations);

      // Log result of retry
      if (!validateCompression(originalTokens, reflectedTokens)) {
        omWarn(
          `[OM] Reflection still did not compress after retry (${originalTokens} -> ${reflectedTokens}). ` +
            `This may indicate the observations cannot be further condensed.`,
        );
      } else {
        omDebug(`[OM] Compression successful after retry (${originalTokens} -> ${reflectedTokens})`);
      }
    } else {
      omDebug(`[OM] Compression successful (${originalTokens} -> ${reflectedTokens})`);
    }

    writeDebugEntry('callReflector:result', {
      originalTokens,
      reflectedTokens,
      outputObservationsLength: parsed.observations.length,
      outputObservationsPreview: parsed.observations.slice(0, 500),
      hasSuggestedContinuation: !!parsed.suggestedContinuation,
      hasPatterns: !!parsed.patterns && Object.keys(parsed.patterns).length > 0,
    });

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
      patterns: parsed.patterns,
      usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
    };
  }

  /**
   * Format observations for injection into context.
   * Applies token optimization before presenting to the Actor.
   *
   * In resource scope mode, filters continuity messages to only show
   * the message for the current thread.
   */
  /**
   * Format observations for injection into the Actor's context.
   * @param observations - The observations to inject
   * @param suggestedResponse - Thread-specific suggested response (from thread metadata)
   * @param unobservedContextBlocks - Formatted <unobserved-context> blocks from other threads
   */
  private formatObservationsForContext(
    observations: string,
    currentTask?: string,
    suggestedResponse?: string,
    unobservedContextBlocks?: string,
    patterns?: Record<string, string[]>,
    currentDate?: Date,
  ): string {
    // Optimize observations to save tokens
    let optimized = optimizeObservationsForContext(observations);

    // Add relative time annotations to date headers if currentDate is provided
    if (currentDate) {
      optimized = addRelativeTimeToObservations(optimized, currentDate);
    }

    let content = `
The following observations block contains your memory of past conversations with this user.

<observations>
${optimized}
</observations>

IMPORTANT: When responding, reference specific details from these observations. Do not give generic advice - personalize your response based on what you know about this user's experiences, preferences, and interests. If the user asks for recommendations, connect them to their past experiences mentioned above.

KNOWLEDGE UPDATES: When asked about current state (e.g., "where do I currently...", "what is my current..."), always prefer the MOST RECENT information. Observations include dates - if you see conflicting information, the newer observation supersedes the older one. Look for phrases like "will start", "is switching", "changed to", "moved to" as indicators that previous information has been updated.

PLANNED ACTIONS: If the user stated they planned to do something (e.g., "I'm going to...", "I'm looking forward to...", "I will...") and the date they planned to do it is now in the past (check the relative time like "3 weeks ago"), assume they completed the action unless there's evidence they didn't. For example, if someone said "I'll start my new diet on Monday" and that was 2 weeks ago, assume they started the diet.`;

    // Dynamically inject patterns from thread metadata
    if (patterns && Object.keys(patterns).length > 0) {
      let patternsContent = '\n\n<patterns>';
      for (const [patternName, items] of Object.entries(patterns)) {
        patternsContent += `\n<${patternName}>`;
        for (const item of items) {
          patternsContent += `\n* ${item}`;
        }
        patternsContent += `\n</${patternName}>`;
      }
      patternsContent += '\n</patterns>';
      content += patternsContent;
    }

    // Add unobserved context from other threads (resource scope only)
    if (unobservedContextBlocks) {
      content += `\n\n${unobservedContextBlocks}`;
    }

    // Dynamically inject current-task from thread metadata (not stored in observations)
    if (currentTask) {
      content += `

<current-task>
${currentTask}
</current-task>`;
    }

    if (suggestedResponse) {
      content += `

<suggested-response>
${suggestedResponse}
</suggested-response>
`;
    }

    return content;
  }

  /**
   * Get threadId and resourceId from either RequestContext or MessageList
   */
  private getThreadContext(
    requestContext: ProcessInputArgs['requestContext'],
    messageList: MessageList,
  ): { threadId: string; resourceId?: string } | null {
    // First try RequestContext (set by Memory)
    const memoryContext = requestContext?.get('MastraMemory') as
      | { thread?: { id: string }; resourceId?: string }
      | undefined;

    if (memoryContext?.thread?.id) {
      return {
        threadId: memoryContext.thread.id,
        resourceId: memoryContext.resourceId,
      };
    }

    // Fallback to MessageList's memoryInfo
    const serialized = messageList.serialize();
    if (serialized.memoryInfo?.threadId) {
      return {
        threadId: serialized.memoryInfo.threadId,
        resourceId: serialized.memoryInfo.resourceId,
      };
    }

    return null;
  }

  /**
   * Process input at each step - inject observations and filter messages.
   * Unlike processInput which runs once, this runs at every step of the agentic loop.
   *
   * - Step 0: Load historical messages + inject observations + filter observed messages
   * - Step N: Re-inject observations + filter any new observed messages (e.g., after tool calls)
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, messages, requestContext, stepNumber, state } = args;

    omDebug(`[OM processInputStep] Step ${stepNumber}, Messages: ${messages.length}`);

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      omDebug('[OM processInputStep] No thread context found, skipping');
      return messageList;
    }

    const { threadId, resourceId } = context;
    omDebug(`[OM processInputStep] Thread: ${threadId}, Resource: ${resourceId}`);

    const record = await this.getOrCreateRecord(threadId, resourceId);
    omDebug(
      `[OM processInputStep] Record found - observations: ${record.activeObservations ? 'YES' : 'NO'}, lastObservedAt: ${record.lastObservedAt?.toISOString() ?? 'never'}`,
    );

    // Historical message loading should only happen once per request (on step 0)
    // Use state to track this so we don't re-load on subsequent steps
    let unobservedContextBlocks: string | undefined;

    if (!state.initialSetupDone) {
      state.initialSetupDone = true;

      // Load unobserved messages from storage using cursor-based query
      // In resource scope, this loads messages from ALL threads for the resource
      const lastObservedAt = record.lastObservedAt;
      const historicalMessages = await this.loadUnobservedMessages(threadId, resourceId, lastObservedAt);

      if (historicalMessages.length > 0) {
        omDebug(
          `[OM processInputStep] Loaded ${historicalMessages.length} messages since ${lastObservedAt?.toISOString() ?? 'beginning'}`,
        );

        if (this.scope === 'resource' && resourceId) {
          // Resource scope: group messages by thread
          const messagesByThread = this.groupMessagesByThread(historicalMessages);

          // Format other threads' messages as <unobserved-context> blocks
          unobservedContextBlocks = await this.formatUnobservedContextBlocks(messagesByThread, threadId);
          if (unobservedContextBlocks) {
            omDebug(
              `[OM processInputStep] Including unobserved context from ${messagesByThread.size - 1} other threads`,
            );
          }

          // Store in state so we can access it when injecting observations
          state.unobservedContextBlocks = unobservedContextBlocks;

          // Add only current thread's messages to messageList
          const currentThreadMessages = messagesByThread.get(threadId) || [];
          for (const msg of currentThreadMessages) {
            if (msg.role !== 'system') {
              messageList.add(msg, 'memory');
            }
          }
        } else {
          // Thread scope: add all messages to messageList
          for (const msg of historicalMessages) {
            if (msg.role !== 'system') {
              messageList.add(msg, 'memory');
            }
          }
        }
      }
    } else {
      omDebug(`[OM processInputStep] Step ${stepNumber}: skipping historical message load (already done)`);
      // Retrieve unobserved context blocks from state for subsequent steps
      unobservedContextBlocks = state.unobservedContextBlocks as string | undefined;
    }

    // Fetch thread metadata to get current task and suggested response
    const thread = await this.storage.getThreadById({ threadId });
    const threadOMMetadata = getThreadOMMetadata(thread?.metadata);
    const currentTask = threadOMMetadata?.currentTask;
    const suggestedResponse = threadOMMetadata?.suggestedResponse;
    // Patterns are stored on the OM record (resource-level), not thread metadata
    const patterns = record.patterns;

    // Get currentDate from request context (for relative time annotations)
    // Defaults to actual current date if not provided
    const currentDate = (requestContext?.get('currentDate') as Date | undefined) ?? new Date();

    // Inject observations as a system message (every step)
    // This happens after historical message loading so we have unobservedContextBlocks
    if (record.activeObservations) {
      const observationSystemMessage = this.formatObservationsForContext(
        record.activeObservations,
        currentTask,
        suggestedResponse,
        unobservedContextBlocks,
        patterns,
        currentDate,
      );
      omDebug(`[OM processInputStep] Injecting observations (${observationSystemMessage.length} chars)`);
      if (this.scope === 'resource') {
        omDebug(`[OM processInputStep] Resource scope enabled`);
      }
      messageList.addSystem(observationSystemMessage, 'observational-memory');
    }

    // Log what agent will actually see
    const finalMessages = messageList.get.all.db();
    omDebug(`[OM processInputStep] Agent will see: observations + ${finalMessages.length} unobserved messages`);

    return messageList;
  }

  /**
   * Load messages from storage that haven't been observed yet.
   * Uses cursor-based query with lastObservedAt timestamp for efficiency.
   *
   * In resource scope mode, loads messages for the entire resource (all threads).
   * In thread scope mode, loads messages for just the current thread.
   */
  private async loadUnobservedMessages(
    threadId: string,
    resourceId: string | undefined,
    lastObservedAt?: Date,
  ): Promise<MastraDBMessage[]> {
    // Add 1ms to lastObservedAt to make the filter exclusive (since dateRange.start is inclusive)
    // This prevents re-loading the same messages that were already observed
    const startDate = lastObservedAt ? new Date(lastObservedAt.getTime() + 1) : undefined;

    const result = await this.storage.listMessages({
      // In resource scope, query by resourceId directly (no need to list threads first)
      // In thread scope, query by threadId
      ...(this.scope === 'resource' && resourceId ? { resourceId } : { threadId }),
      perPage: false, // Get all messages (no pagination limit)
      orderBy: { field: 'createdAt', direction: 'ASC' },
      filter: startDate
        ? {
            dateRange: {
              start: startDate,
            },
          }
        : undefined,
    });

    return result.messages;
  }

  /**
   * Group messages by threadId for resource-scoped processing.
   */
  private groupMessagesByThread(messages: MastraDBMessage[]): Map<string, MastraDBMessage[]> {
    const grouped = new Map<string, MastraDBMessage[]>();
    for (const msg of messages) {
      if (!msg.threadId) continue;
      const existing = grouped.get(msg.threadId) || [];
      existing.push(msg);
      grouped.set(msg.threadId, existing);
    }
    return grouped;
  }

  /**
   * Format unobserved messages from other threads as <unobserved-context> blocks.
   * These are injected into the Actor's context so it has awareness of activity
   * in other threads for the same resource.
   */
  private async formatUnobservedContextBlocks(
    messagesByThread: Map<string, MastraDBMessage[]>,
    currentThreadId: string,
  ): Promise<string> {
    const blocks: string[] = [];

    for (const [threadId, messages] of messagesByThread) {
      // Skip current thread - those go in normal message history
      if (threadId === currentThreadId) continue;

      // Skip if no messages
      if (messages.length === 0) continue;

      // Format messages with timestamps
      const formattedMessages = formatMessagesForObserver(messages);

      if (formattedMessages) {
        const obscuredId = await this.representThreadIDInContext(threadId);
        blocks.push(`<other-conversation id="${obscuredId}">
${formattedMessages}
</other-conversation>`);
      }
    }

    return blocks.join('\n\n');
  }

  private async representThreadIDInContext(threadId: string): Promise<string> {
    if (this.shouldObscureThreadIds) {
      // Check cache first
      const cached = this.threadIdCache.get(threadId);
      if (cached) return cached;

      // Use xxhash (32-bit) to create short, opaque, non-reversible identifiers
      // This prevents LLMs from recognizing patterns like "answer_" in base64
      const hasher = await this.hasher;
      const hashed = hasher.h32ToString(threadId);
      this.threadIdCache.set(threadId, hashed);
      return hashed;
    }
    return threadId;
  }

  /**
   * Strip any thread tags that the Observer might have added.
   * Thread attribution is handled externally by the system, not by the Observer.
   * This is a defense-in-depth measure.
   */
  private stripThreadTags(observations: string): string {
    // Remove any <thread...> or </thread> tags the Observer might add
    return observations.replace(/<thread[^>]*>|<\/thread>/gi, '').trim();
  }

  /**
   * Get the maximum createdAt timestamp from a list of messages.
   * Used to set lastObservedAt to the most recent message timestamp instead of current time.
   * This ensures historical data (like LongMemEval fixtures) works correctly.
   */
  private getMaxMessageTimestamp(messages: MastraDBMessage[]): Date {
    let maxTime = 0;
    for (const msg of messages) {
      if (msg.createdAt) {
        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime > maxTime) {
          maxTime = msgTime;
        }
      }
    }
    // If no valid timestamps found, fall back to current time
    return maxTime > 0 ? new Date(maxTime) : new Date();
  }

  /**
   * Merge new patterns with existing patterns.
   * Deduplicates items within each pattern by content.
   */
  private mergePatterns(
    existing: Record<string, string[]>,
    newPatterns: Record<string, string[]>,
  ): Record<string, string[]> {
    const merged: Record<string, string[]> = { ...existing };

    for (const [patternName, items] of Object.entries(newPatterns)) {
      if (!merged[patternName]) {
        merged[patternName] = [];
      }
      // Add new items that don't already exist (deduplicate by exact match)
      for (const item of items) {
        if (!merged[patternName].includes(item)) {
          merged[patternName].push(item);
        }
      }
    }

    return merged;
  }

  /**
   * Format patterns into a string for token counting.
   * This mirrors the format used in formatObservationsForContext and callReflector.
   */
  private formatPatternsForTokenCount(patterns: Record<string, string[]>): string {
    if (!patterns || Object.keys(patterns).length === 0) {
      return '';
    }

    let patternsContent = '<patterns>';
    for (const [patternName, items] of Object.entries(patterns)) {
      patternsContent += `\n<${patternName}>`;
      for (const item of items) {
        patternsContent += `\n* ${item}`;
      }
      patternsContent += `\n</${patternName}>`;
    }
    patternsContent += '\n</patterns>';

    return patternsContent;
  }

  /**
   * Wrap observations in a thread attribution tag.
   * Used in resource scope to track which thread observations came from.
   */
  private async wrapWithThreadTag(threadId: string, observations: string): Promise<string> {
    // First strip any thread tags the Observer might have added
    const cleanObservations = this.stripThreadTags(observations);
    const obscuredId = await this.representThreadIDInContext(threadId);
    return `<thread id="${obscuredId}">\n${cleanObservations}\n</thread>`;
  }

  /**
   * Append or merge new thread sections.
   * If the new section has the same thread ID and date as an existing section,
   * merge the observations into that section to reduce token usage.
   * Otherwise, append as a new section.
   */
  private replaceOrAppendThreadSection(
    existingObservations: string,
    _threadId: string,
    newThreadSection: string,
  ): string {
    if (!existingObservations) {
      return newThreadSection;
    }

    // Extract thread ID and date from new section
    const threadIdMatch = newThreadSection.match(/<thread id="([^"]+)">/);
    const dateMatch = newThreadSection.match(/Date:\s*([A-Za-z]+\s+\d+,\s+\d+)/);

    if (!threadIdMatch || !dateMatch) {
      // Can't parse, just append
      return `${existingObservations}\n\n${newThreadSection}`;
    }

    const newThreadId = threadIdMatch[1]!;
    const newDate = dateMatch[1]!;

    // Look for existing section with same thread ID and date
    const existingPattern = new RegExp(
      `<thread id="${newThreadId}">\\s*Date:\\s*${newDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)</thread>`,
    );
    const existingMatch = existingObservations.match(existingPattern);

    if (existingMatch) {
      // Found existing section with same thread ID and date - merge observations
      // Extract just the observations from the new section (after the Date: line)
      const newObsMatch = newThreadSection.match(/<thread id="[^"]+">[\s\S]*?Date:[^\n]*\n([\s\S]*?)\n<\/thread>/);
      if (newObsMatch && newObsMatch[1]) {
        const newObsContent = newObsMatch[1].trim();
        // Insert new observations at the end of the existing section (before </thread>)
        const mergedSection = existingObservations.replace(existingPattern, match => {
          // Remove closing </thread>, add new observations, add closing </thread>
          const withoutClose = match.replace(/<\/thread>$/, '').trimEnd();
          return `${withoutClose}\n${newObsContent}\n</thread>`;
        });
        omDebug(`[OM] Merged observations for thread ${newThreadId} on ${newDate}`);
        return mergedSection;
      }
    }

    // No existing section with same thread ID and date - append
    return `${existingObservations}\n\n${newThreadSection}`;
  }

  /**
   * Sort threads by their oldest unobserved message.
   * Returns thread IDs in order from oldest to most recent.
   * This ensures no thread's messages get "stuck" unobserved.
   */
  private sortThreadsByOldestMessage(messagesByThread: Map<string, MastraDBMessage[]>): string[] {
    const threadOrder = Array.from(messagesByThread.entries())
      .map(([threadId, messages]) => {
        // Find oldest message timestamp
        const oldestTimestamp = Math.min(
          ...messages.map(m => (m.createdAt ? new Date(m.createdAt).getTime() : Date.now())),
        );
        return { threadId, oldestTimestamp };
      })
      .sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);

    return threadOrder.map(t => t.threadId);
  }

  /**
   * Process output - track messages and trigger Observer/Reflector.
   * Supports async buffering when bufferEvery is configured.
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList> {
    const { messageList, requestContext } = args;

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    // Re-fetch record to get latest state (buffering may have completed)
    let record = await this.getOrCreateRecord(threadId, resourceId);

    const allMessages = messageList.get.all.db();
    const unobservedMessages = this.getUnobservedMessages(allMessages, record);
    const currentSessionTokens = this.tokenCounter.countMessages(unobservedMessages);
    const currentObservationTokens = record.observationTokenCount ?? 0;
    // Include pending tokens from previous sessions for threshold check
    // Use type assertion since pendingMessageTokens was just added to ObservationalMemoryRecord
    const pendingTokens = record.pendingMessageTokens ?? 0;
    const totalPendingTokens = pendingTokens + currentSessionTokens;

    const threshold = this.calculateDynamicThreshold(
      this.observerConfig.observationThreshold,
      currentObservationTokens,
      this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
    );

    omDebug(
      `[OM processOutputResult] Messages: ${allMessages.length}, Unobserved: ${unobservedMessages.length}, ` +
        `SessionTokens: ${currentSessionTokens}, PendingTokens: ${pendingTokens}, TotalPending: ${totalPendingTokens}, ` +
        `Threshold: ${threshold}`,
    );

    // ═══════════════════════════════════════════════════════════════════
    // SIMPLIFIED SYNC-ONLY FLOW (async buffering disabled)
    // ═══════════════════════════════════════════════════════════════════

    const shouldObserveNow = this.shouldObserve(totalPendingTokens, currentObservationTokens);
    omDebug(`[OM] Observe check: totalPending=${totalPendingTokens} > threshold=${threshold} ? ${shouldObserveNow}`);

    if (shouldObserveNow) {
      // ════════════════════════════════════════════════════════════
      // LOCKING: Check if observation is already in progress
      // This prevents race conditions when multiple threads are active
      // ════════════════════════════════════════════════════════════
      if (record.isObserving) {
        omDebug(`[OM] Observation already in progress for ${record.id}, skipping`);
      } else {
        // ════════════════════════════════════════════════════════════
        // SYNC PATH: Do synchronous observation (blocking)
        // ════════════════════════════════════════════════════════════
        omDebug(`[OM] Observation threshold exceeded (${totalPendingTokens} > ${threshold}), triggering Observer`);

        if (this.scope === 'resource' && resourceId) {
          // Resource scope: observe ALL threads with unobserved messages
          // Pass current thread's messages from messageList since they may not be in DB yet
          await this.doResourceScopedObservation(record, threadId, resourceId, unobservedMessages);
        } else {
          // Thread scope: observe only current thread
          await this.doSynchronousObservation(record, threadId, unobservedMessages);
        }
      }
    } else if (currentSessionTokens > 0) {
      // ═══════════════════════════════════════════════════════════════════
      // Observation not triggered - accumulate pending tokens for next check
      // This allows observations to trigger after multiple small sessions
      // ═══════════════════════════════════════════════════════════════════
      omDebug(`[OM] Accumulating ${currentSessionTokens} pending tokens (total will be ${totalPendingTokens})`);
      // Use type assertion since addPendingMessageTokens was just added to MemoryStorage
      await (this.storage as any).addPendingMessageTokens(record.id, currentSessionTokens);

      // Emit debug event for token accumulation
      this.emitDebugEvent({
        type: 'tokens_accumulated',
        timestamp: new Date(),
        threadId,
        resourceId: resourceId ?? '',
        pendingTokens,
        sessionTokens: currentSessionTokens,
        totalPendingTokens,
        threshold,
        messages: unobservedMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      });
    }

    // NOTE: Async reflection buffering disabled - reflection happens synchronously in maybeReflect()

    return messageList;
  }

  /**
   * Do synchronous observation (fallback when no buffering)
   */
  private async doSynchronousObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
  ): Promise<void> {
    // Note: Message ID tracking removed in favor of cursor-based lastObservedAt

    // Emit debug event for observation triggered
    this.emitDebugEvent({
      type: 'observation_triggered',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      previousObservations: record.activeObservations,
      messages: unobservedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    });

    // ════════════════════════════════════════════════════════════
    // LOCKING: Acquire lock and re-check
    // ════════════════════════════════════════════════════════════
    await this.storage.setObservingFlag(record.id, true);

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          omDebug(`[OM] Another request already observed, skipping (lastObservedAt updated)`);
          return;
        }
      }

      const result = await this.callObserver(
        freshRecord?.activeObservations ?? record.activeObservations,
        unobservedMessages,
        freshRecord?.patterns ?? record.patterns,
      );

      omDebug(`[OM] Observer returned observations (${result.observations.length} chars)`);

      // Build new observations (use freshRecord if available)
      const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';
      let newObservations: string;
      if (this.scope === 'resource') {
        // In resource scope: wrap with thread tag and replace/append
        const threadSection = await this.wrapWithThreadTag(threadId, result.observations);
        newObservations = this.replaceOrAppendThreadSection(existingObservations, threadId, threadSection);
      } else {
        // In thread scope: simple append
        newObservations = existingObservations
          ? `${existingObservations}\n\n${result.observations}`
          : result.observations;
      }

      // Calculate total tokens including patterns
      // Merge existing patterns with new patterns to get the full picture
      const existingPatterns = freshRecord?.patterns ?? record.patterns ?? {};
      const mergedPatterns = result.patterns ? this.mergePatterns(existingPatterns, result.patterns) : existingPatterns;

      let totalTokenCount = this.tokenCounter.countObservations(newObservations);
      if (Object.keys(mergedPatterns).length > 0) {
        const patternsString = this.formatPatternsForTokenCount(mergedPatterns);
        totalTokenCount += this.tokenCounter.countObservations(patternsString);
      }

      omDebug(`[OM] Storing observations: ${totalTokenCount} tokens (including patterns)`);

      // Use the max message timestamp as cursor instead of current time
      // This ensures historical data (like LongMemEval fixtures) works correctly
      const lastObservedAt = this.getMaxMessageTimestamp(unobservedMessages);

      // Pass patterns to storage - they'll be merged with existing patterns on the OM record
      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        patterns: result.patterns,
      });

      // Save thread-specific metadata (currentTask, suggestedResponse only - patterns are on OM record)
      if (result.suggestedContinuation || result.currentTask) {
        const thread = await this.storage.getThreadById({ threadId });
        if (thread) {
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            suggestedResponse: result.suggestedContinuation,
            currentTask: result.currentTask,
          });
          await this.storage.updateThread({
            id: threadId,
            title: thread.title ?? '',
            metadata: newMetadata,
          });
          omDebug(`[OM] Updated thread metadata with suggestedResponse and currentTask`);
        }
      }

      omDebug(`[OM] Observations stored successfully`);

      // Emit debug event for observation complete
      this.emitDebugEvent({
        type: 'observation_complete',
        timestamp: new Date(),
        threadId,
        resourceId: record.resourceId ?? '',
        observations: newObservations,
        rawObserverOutput: result.observations,
        previousObservations: record.activeObservations,
        messages: unobservedMessages.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        usage: result.usage,
      });

      // Check for reflection (pass threadId so patterns can be cleared)
      await this.maybeReflect({ ...record, activeObservations: newObservations }, totalTokenCount, threadId);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
    }
  }

  /**
   * Resource-scoped observation: observe ALL threads with unobserved messages.
   * Threads are observed in oldest-first order to ensure no thread's messages
   * get "stuck" unobserved forever.
   *
   * Key differences from thread-scoped observation:
   * 1. Loads messages from ALL threads for the resource
   * 2. Observes threads one-by-one in oldest-first order
   * 3. Only updates lastObservedAt AFTER all threads are observed
   * 4. Only triggers reflection AFTER all threads are observed
   */
  private async doResourceScopedObservation(
    record: ObservationalMemoryRecord,
    currentThreadId: string,
    resourceId: string,
    currentThreadMessages: MastraDBMessage[],
  ): Promise<void> {
    omDebug(`[OM] Starting resource-scoped observation for resource ${resourceId}`);

    // Clear debug entries at start of observation cycle
    clearDebugEntries();
    writeDebugEntry('doResourceScopedObservation:start', {
      resourceId,
      currentThreadId,
      recordId: record.id,
      lastObservedAt: record.lastObservedAt,
      existingObservationsLength: record.activeObservations?.length ?? 0,
      currentThreadMessagesCount: currentThreadMessages.length,
    });

    // ════════════════════════════════════════════════════════════
    // PER-THREAD CURSORS: Load unobserved messages for each thread using its own lastObservedAt
    // This prevents message loss when threads have different observation progress
    // ════════════════════════════════════════════════════════════

    // First, get all threads for this resource to access their per-thread lastObservedAt
    const { threads: allThreads } = await this.storage.listThreadsByResourceId({ resourceId });
    const threadMetadataMap = new Map<string, { lastObservedAt?: string }>();

    for (const thread of allThreads) {
      const omMetadata = getThreadOMMetadata(thread.metadata);
      threadMetadataMap.set(thread.id, { lastObservedAt: omMetadata?.lastObservedAt });
    }

    // Load messages per-thread using each thread's own cursor
    const messagesByThread = new Map<string, MastraDBMessage[]>();
    let totalDbMessages = 0;

    for (const thread of allThreads) {
      const threadLastObservedAt = threadMetadataMap.get(thread.id)?.lastObservedAt;

      // Query messages for this specific thread AFTER its lastObservedAt
      // Add 1ms to make the filter exclusive (since dateRange.start is inclusive)
      // This prevents re-observing the same messages
      const startDate = threadLastObservedAt ? new Date(new Date(threadLastObservedAt).getTime() + 1) : undefined;

      const result = await this.storage.listMessages({
        threadId: thread.id,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate ? { dateRange: { start: startDate } } : undefined,
      });

      if (result.messages.length > 0) {
        messagesByThread.set(thread.id, result.messages);
        totalDbMessages += result.messages.length;
        omDebug(
          `[OM] Thread ${thread.id}: loaded ${result.messages.length} messages after ${threadLastObservedAt ?? 'beginning'}`,
        );
      }
    }

    // Handle current thread messages (may not be in DB yet)
    // Merge with any DB messages for the current thread
    if (currentThreadMessages.length > 0) {
      const existingCurrentThreadMsgs = messagesByThread.get(currentThreadId) ?? [];
      const messageMap = new Map<string, MastraDBMessage>();

      // Add DB messages first
      for (const msg of existingCurrentThreadMsgs) {
        if (msg.id) messageMap.set(msg.id, msg);
      }

      // Add/override with current thread messages (they're more up-to-date)
      for (const msg of currentThreadMessages) {
        if (msg.id) messageMap.set(msg.id, msg);
      }

      messagesByThread.set(currentThreadId, Array.from(messageMap.values()));
    }

    // Count total messages
    let totalMessages = 0;
    for (const msgs of messagesByThread.values()) {
      totalMessages += msgs.length;
    }

    omDebug(
      `[OM] Per-thread loading: ${totalDbMessages} from DB + ${currentThreadMessages.length} from current session = ${totalMessages} total across ${messagesByThread.size} threads`,
    );

    if (totalMessages === 0) {
      omDebug(`[OM] No unobserved messages found for resource ${resourceId}`);
      return;
    }

    omDebug(`[OM] Found ${messagesByThread.size} threads with messages to observe`);

    // ════════════════════════════════════════════════════════════
    // THREAD SELECTION: Pick which threads to observe based on token threshold
    // - Sort by largest threads first (most messages = most value per Observer call)
    // - Accumulate until we hit the threshold
    // - This prevents making many small Observer calls for 1-message threads
    // ════════════════════════════════════════════════════════════
    const threshold = this.getMaxThreshold(this.observerConfig.observationThreshold);

    // Calculate tokens per thread and sort by size (largest first)
    const threadTokenCounts = new Map<string, number>();
    for (const [threadId, msgs] of messagesByThread) {
      let tokens = 0;
      for (const msg of msgs) {
        tokens += this.tokenCounter.countMessage(msg);
      }
      threadTokenCounts.set(threadId, tokens);
    }

    const threadsBySize = Array.from(messagesByThread.keys()).sort((a, b) => {
      return (threadTokenCounts.get(b) ?? 0) - (threadTokenCounts.get(a) ?? 0);
    });

    // Select threads to observe until we hit the threshold
    let accumulatedTokens = 0;
    const threadsToObserve: string[] = [];

    for (const threadId of threadsBySize) {
      const threadTokens = threadTokenCounts.get(threadId) ?? 0;

      // If we've already accumulated enough, stop adding threads
      if (accumulatedTokens >= threshold) {
        omDebug(
          `[OM] Token threshold reached (${accumulatedTokens} >= ${threshold}), selected ${threadsToObserve.length} threads`,
        );
        break;
      }

      threadsToObserve.push(threadId);
      accumulatedTokens += threadTokens;
    }

    omDebug(
      `[OM] Selected ${threadsToObserve.length} of ${messagesByThread.size} threads to observe (${accumulatedTokens} tokens, threshold: ${threshold})`,
    );

    if (threadsToObserve.length === 0) {
      omDebug(`[OM] No threads selected for observation`);
      return;
    }

    // Now sort the selected threads by oldest message for consistent observation order
    const threadOrder = this.sortThreadsByOldestMessage(
      new Map(threadsToObserve.map(tid => [tid, messagesByThread.get(tid) ?? []])),
    );
    omDebug(`[OM] Thread observation order: ${threadOrder.join(', ')}`);

    // Debug: Log message counts per thread and date ranges
    writeDebugEntry('doResourceScopedObservation:messages_loaded', {
      totalDbMessagesCount: totalDbMessages,
      currentThreadMessagesCount: currentThreadMessages.length,
      totalMessagesCount: totalMessages,
      threadCount: messagesByThread.size,
      threadOrder,
      messagesByThread: Object.fromEntries(
        Array.from(messagesByThread.entries()).map(([tid, msgs]) => [
          tid,
          {
            count: msgs.length,
            lastObservedAt: threadMetadataMap.get(tid)?.lastObservedAt ?? null,
            dateRange:
              msgs.length > 0
                ? {
                    earliest: msgs.reduce(
                      (min, m) => (m.createdAt && m.createdAt < min ? m.createdAt : min),
                      msgs[0]?.createdAt ?? '',
                    ),
                    latest: msgs.reduce(
                      (max, m) => (m.createdAt && m.createdAt > max ? m.createdAt : max),
                      msgs[0]?.createdAt ?? '',
                    ),
                  }
                : null,
          },
        ]),
      ),
    });

    // ════════════════════════════════════════════════════════════
    // LOCKING: Acquire lock and re-check
    // Another request may have already observed while we were loading messages
    // ════════════════════════════════════════════════════════════
    await this.storage.setObservingFlag(record.id, true);

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(null, resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          omDebug(`[OM] Another request already observed, skipping (lastObservedAt updated)`);
          return;
        }
      }

      const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';
      const existingPatterns = freshRecord?.patterns ?? record.patterns;

      // ════════════════════════════════════════════════════════════
      // BATCHED MULTI-THREAD OBSERVATION: Single Observer call for all threads
      // This is much more efficient than calling the Observer for each thread individually
      // ════════════════════════════════════════════════════════════

      // Filter to only threads with messages
      const threadsWithMessages = new Map<string, MastraDBMessage[]>();
      for (const threadId of threadOrder) {
        const msgs = messagesByThread.get(threadId);
        if (msgs && msgs.length > 0) {
          threadsWithMessages.set(threadId, msgs);
        }
      }

      // Emit debug event for observation triggered (combined for all threads)
      this.emitDebugEvent({
        type: 'observation_triggered',
        timestamp: new Date(),
        threadId: threadOrder.join(','),
        resourceId,
        previousObservations: existingObservations,
        messages: Array.from(threadsWithMessages.values())
          .flat()
          .map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
      });

      omDebug(`[OM] Starting batched observation of ${threadsWithMessages.size} threads`);

      // ════════════════════════════════════════════════════════════
      // PARALLEL BATCHING: Chunk threads into batches and process in parallel
      // This combines batching efficiency with parallel execution
      // ════════════════════════════════════════════════════════════
      const maxTokensPerBatch = this.observerConfig.maxTokensPerBatch ?? 5000;
      const orderedThreadIds = threadOrder.filter(tid => threadsWithMessages.has(tid));

      // Chunk threads into batches based on token count
      const batches: Array<{ threadIds: string[]; threadMap: Map<string, MastraDBMessage[]> }> = [];
      let currentBatch: { threadIds: string[]; threadMap: Map<string, MastraDBMessage[]> } = {
        threadIds: [],
        threadMap: new Map(),
      };
      let currentBatchTokens = 0;

      for (const threadId of orderedThreadIds) {
        const msgs = threadsWithMessages.get(threadId)!;
        const threadTokens = threadTokenCounts.get(threadId) ?? 0;

        // If adding this thread would exceed the batch limit, start a new batch
        // (unless the current batch is empty - always include at least one thread)
        if (currentBatchTokens + threadTokens > maxTokensPerBatch && currentBatch.threadIds.length > 0) {
          batches.push(currentBatch);
          currentBatch = { threadIds: [], threadMap: new Map() };
          currentBatchTokens = 0;
        }

        currentBatch.threadIds.push(threadId);
        currentBatch.threadMap.set(threadId, msgs);
        currentBatchTokens += threadTokens;
      }

      // Don't forget the last batch
      if (currentBatch.threadIds.length > 0) {
        batches.push(currentBatch);
      }

      const sequentialBatches = this.observerConfig.sequentialBatches;
      omDebug(
        `[OM] Split ${orderedThreadIds.length} threads into ${batches.length} batches ` +
          `(maxTokensPerBatch: ${maxTokensPerBatch}, sequential: ${sequentialBatches})`,
      );

      // Process batches either sequentially or in parallel
      let batchResults: Array<{
        results: Map<string, { observations: string; currentTask?: string; suggestedContinuation?: string; patterns?: Record<string, string[]> }>;
        usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
      }>;

      if (sequentialBatches) {
        // Sequential: each batch sees previous batches' observations
        batchResults = [];
        let cumulativeObservations = existingObservations;

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex]!;
          omDebug(`[OM] Starting batch ${batchIndex + 1}/${batches.length} with ${batch.threadIds.length} threads (sequential)`);
          
          const batchResult = await this.callMultiThreadObserver(
            cumulativeObservations,
            batch.threadMap,
            batch.threadIds,
            existingPatterns,
          );
          
          omDebug(
            `[OM] Batch ${batchIndex + 1}/${batches.length} complete, got results for ${batchResult.results.size} threads`,
          );
          
          batchResults.push(batchResult);

          // Accumulate observations for next batch
          for (const [, result] of batchResult.results) {
            if (result.observations) {
              cumulativeObservations = cumulativeObservations
                ? `${cumulativeObservations}\n\n${result.observations}`
                : result.observations;
            }
          }
        }
      } else {
        // Parallel: all batches see only the original existingObservations
        const batchPromises = batches.map(async (batch, batchIndex) => {
          omDebug(`[OM] Starting batch ${batchIndex + 1}/${batches.length} with ${batch.threadIds.length} threads`);
          const batchResult = await this.callMultiThreadObserver(
            existingObservations,
            batch.threadMap,
            batch.threadIds,
            existingPatterns,
          );
          omDebug(
            `[OM] Batch ${batchIndex + 1}/${batches.length} complete, got results for ${batchResult.results.size} threads`,
          );
          return batchResult;
        });

        batchResults = await Promise.all(batchPromises);
      }

      // Merge all batch results into a single map and accumulate usage
      const multiThreadResults = new Map<
        string,
        {
          observations: string;
          currentTask?: string;
          suggestedContinuation?: string;
          patterns?: Record<string, string[]>;
        }
      >();
      let totalBatchUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      for (const batchResult of batchResults) {
        for (const [threadId, result] of batchResult.results) {
          multiThreadResults.set(threadId, result);
        }
        // Accumulate usage from each batch
        if (batchResult.usage) {
          totalBatchUsage.inputTokens += batchResult.usage.inputTokens ?? 0;
          totalBatchUsage.outputTokens += batchResult.usage.outputTokens ?? 0;
          totalBatchUsage.totalTokens += batchResult.usage.totalTokens ?? 0;
        }
      }

      omDebug(`[OM] All batches complete, got results for ${multiThreadResults.size} threads total`);

      // Convert to the expected format for downstream processing
      const observationResults: Array<{
        threadId: string;
        threadMessages: MastraDBMessage[];
        result: {
          observations: string;
          currentTask?: string;
          suggestedContinuation?: string;
          patterns?: Record<string, string[]>;
        };
      } | null> = [];

      for (const threadId of threadOrder) {
        const threadMessages = messagesByThread.get(threadId) ?? [];
        if (threadMessages.length === 0) continue;

        const result = multiThreadResults.get(threadId);
        if (!result) {
          omDebug(`[OM] Warning: No result for thread ${threadId}`);
          continue;
        }

        omDebug(`[OM] Thread ${threadId}: ${result.observations.length} chars of observations`);

        // Debug: Log Observer output for this thread
        writeDebugEntry('doResourceScopedObservation:observer_result', {
          threadId,
          messagesCount: threadMessages.length,
          messagesDateRange: {
            earliest: threadMessages.reduce(
              (min, m) => (m.createdAt && m.createdAt < min ? m.createdAt : min),
              threadMessages[0]?.createdAt ?? '',
            ),
            latest: threadMessages.reduce(
              (max, m) => (m.createdAt && m.createdAt > max ? m.createdAt : max),
              threadMessages[0]?.createdAt ?? '',
            ),
          },
          observationsLength: result.observations.length,
          observationsPreview: result.observations.substring(0, 1000),
          hasCurrentTask: !!result.currentTask,
          hasSuggestedContinuation: !!result.suggestedContinuation,
          hasPatterns: !!result.patterns && Object.keys(result.patterns).length > 0,
        });

        observationResults.push({
          threadId,
          threadMessages,
          result,
        });
      }

      // Combine results: wrap each thread's observations and append to existing
      // Also collect all patterns from all threads to store on the OM record
      // Start with existing patterns from the record
      let currentObservations = existingObservations;
      let allPatterns: Record<string, string[]> = { ...(existingPatterns ?? {}) };

      for (const obsResult of observationResults) {
        if (!obsResult) continue;

        const { threadId, threadMessages, result } = obsResult;

        // Wrap with thread tag and append (in thread order for consistency)
        const threadSection = await this.wrapWithThreadTag(threadId, result.observations);
        currentObservations = this.replaceOrAppendThreadSection(currentObservations, threadId, threadSection);

        // Collect patterns from this thread's observation (will be merged into OM record)
        if (result.patterns) {
          allPatterns = this.mergePatterns(allPatterns, result.patterns);
        }

        // Update thread-specific metadata:
        // - lastObservedAt: ALWAYS update to track per-thread observation progress
        // - currentTask, suggestedResponse: only if present in result
        // - patterns go on OM record, not thread metadata
        const threadLastObservedAt = this.getMaxMessageTimestamp(threadMessages);
        const thread = await this.storage.getThreadById({ threadId });
        if (thread) {
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            lastObservedAt: threadLastObservedAt.toISOString(),
            ...(result.suggestedContinuation && { suggestedResponse: result.suggestedContinuation }),
            ...(result.currentTask && { currentTask: result.currentTask }),
          });
          await this.storage.updateThread({
            id: threadId,
            title: thread.title ?? '',
            metadata: newMetadata,
          });
          omDebug(
            `[OM] Updated thread ${threadId} metadata: lastObservedAt=${threadLastObservedAt.toISOString()}` +
              (result.suggestedContinuation ? ', suggestedResponse' : '') +
              (result.currentTask ? ', currentTask' : ''),
          );
        }

        // Emit debug event for observation complete (usage is for the entire batch, added to first thread only)
        const isFirstThread = observationResults.indexOf(obsResult) === 0;
        this.emitDebugEvent({
          type: 'observation_complete',
          timestamp: new Date(),
          threadId,
          resourceId,
          observations: threadSection,
          rawObserverOutput: result.observations,
          previousObservations: record.activeObservations,
          messages: threadMessages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          })),
          // Add batch usage to first thread's event only (to avoid double-counting)
          usage: isFirstThread && totalBatchUsage.totalTokens > 0 ? totalBatchUsage : undefined,
        });
      }

      // After ALL threads observed, update the record with final observations and merged patterns
      // Calculate total tokens including patterns
      let totalTokenCount = this.tokenCounter.countObservations(currentObservations);
      if (Object.keys(allPatterns).length > 0) {
        const patternsString = this.formatPatternsForTokenCount(allPatterns);
        totalTokenCount += this.tokenCounter.countObservations(patternsString);
      }

      // Compute global lastObservedAt as a "high water mark" across all threads
      // Note: Per-thread cursors (stored in ThreadOMMetadata.lastObservedAt) are the authoritative source
      // for determining which messages each thread has observed. This global value is used for:
      // - Quick concurrency checks (has any observation happened since we started?)
      // - Thread-scoped observation (non-resource scope)
      // - finalize() and getRecallTool() methods
      const observedMessages = observationResults
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .flatMap(r => r.threadMessages);
      const lastObservedAt = this.getMaxMessageTimestamp(observedMessages);

      omDebug(`[OM] All threads observed. Storing ${totalTokenCount} tokens (including patterns)`);

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: currentObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        patterns: Object.keys(allPatterns).length > 0 ? allPatterns : undefined,
      });

      omDebug(`[OM] Resource-scoped observation complete`);

      writeDebugEntry('doResourceScopedObservation:before_maybeReflect', {
        recordId: record.id,
        totalTokenCount,
        currentObservationsLength: currentObservations.length,
        currentObservationsPreview: currentObservations.slice(0, 1000),
        currentObservationsTail: currentObservations.slice(-500),
        lastObservedAt: lastObservedAt.toISOString(),
        patternsCount: Object.keys(allPatterns).length,
      });

      // Check for reflection AFTER all threads are observed (pass currentThreadId so patterns can be cleared)
      await this.maybeReflect({ ...record, activeObservations: currentObservations }, totalTokenCount, currentThreadId);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
    }
  }

  /**
   * Check if reflection needed and trigger if so.
   * SIMPLIFIED: Always uses synchronous reflection (async buffering disabled).
   */
  private async maybeReflect(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    _threadId?: string,
  ): Promise<void> {
    writeDebugEntry('maybeReflect:start', {
      recordId: record.id,
      observationTokens,
      activeObservationsLength: record.activeObservations?.length ?? 0,
      activeObservationsPreview: record.activeObservations?.slice(0, 500) ?? '',
    });

    if (!this.shouldReflect(observationTokens)) {
      writeDebugEntry('maybeReflect:skip', {
        reason: 'below_threshold',
        observationTokens,
        threshold: this.getMaxThreshold(this.reflectorConfig.reflectionThreshold),
      });
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // LOCKING: Check if reflection is already in progress
    // ════════════════════════════════════════════════════════════
    if (record.isReflecting) {
      writeDebugEntry('maybeReflect:skip', {
        reason: 'already_reflecting',
      });
      omDebug(`[OM] Reflection already in progress for ${record.id}, skipping`);
      return;
    }

    const reflectThreshold = this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
    omDebug(`[OM] Reflection threshold exceeded (${observationTokens} > ${reflectThreshold}), triggering Reflector`);

    // ════════════════════════════════════════════════════════════
    // SYNC PATH: Do synchronous reflection (blocking)
    // ════════════════════════════════════════════════════════════
    await this.storage.setReflectingFlag(record.id, true);

    // Emit reflection_triggered debug event
    this.emitDebugEvent({
      type: 'reflection_triggered',
      timestamp: new Date(),
      threadId: _threadId ?? 'unknown',
      resourceId: record.resourceId ?? '',
      inputTokens: observationTokens,
      activeObservationsLength: record.activeObservations?.length ?? 0,
    });

    try {
      // Only pass patterns to Reflector if reflector patterns are enabled
      const patternsToReflect = this.reflectorRecognizePatterns ? record.patterns : undefined;
      const reflectResult = await this.callReflector(record.activeObservations, undefined, patternsToReflect);
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      writeDebugEntry('maybeReflect:before_createReflectionGeneration', {
        recordId: record.id,
        inputObservationsLength: record.activeObservations?.length ?? 0,
        outputObservationsLength: reflectResult.observations.length,
        reflectionTokenCount,
        outputObservationsPreview: reflectResult.observations.slice(0, 500),
      });

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
        patterns: reflectResult.patterns,
      });

      writeDebugEntry('maybeReflect:complete', {
        recordId: record.id,
        reflectionTokenCount,
      });

      // Emit reflection_complete debug event with usage
      this.emitDebugEvent({
        type: 'reflection_complete',
        timestamp: new Date(),
        threadId: _threadId ?? 'unknown',
        resourceId: record.resourceId ?? '',
        inputTokens: observationTokens,
        outputTokens: reflectionTokenCount,
        observations: reflectResult.observations,
        usage: reflectResult.usage,
      });

      // Note: Patterns from the Reflector are preserved in the new OM record.
      // The Reflector consolidates patterns from observations into its output.
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
    }
  }

  /**
   * Manually trigger observation.
   */
  async observe(threadId: string, resourceId?: string, _prompt?: string): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);
    omDebug(`[OM] Manual observation triggered for ${record.id}`);
    // TODO: Implement manual observation
  }

  /**
   * Manually trigger reflection with optional guidance prompt.
   *
   * @example
   * ```ts
   * // Trigger reflection with specific focus
   * await om.reflect(threadId, resourceId,
   *   "focus on the authentication implementation, only keep minimal details about UI styling"
   * );
   * ```
   */
  async reflect(threadId: string, resourceId?: string, prompt?: string): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);

    if (!record.activeObservations) {
      omDebug(`[OM] No observations to reflect on for ${record.id}`);
      return;
    }

    omDebug(`[OM] Manual reflection triggered for ${record.id}`);

    await this.storage.setReflectingFlag(record.id, true);

    try {
      // Manual reflect also passes patterns if enabled
      const patternsToReflect = this.reflectorRecognizePatterns ? record.patterns : undefined;
      const reflectResult = await this.callReflector(record.activeObservations, prompt, patternsToReflect);
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
        patterns: reflectResult.patterns,
      });

      // Note: Thread metadata (currentTask, suggestedResponse) is preserved on each thread
      // and doesn't need to be updated during reflection - it was set during observation

      omDebug(`[OM] Manual reflection complete, new generation created`);
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
    }
  }

  /**
   * Finalize observations for a thread/resource.
   *
   * This method forces observation and optional reflection regardless of thresholds.
   * Useful for "shortcut" preparation where you accumulate all messages first,
   * then run a single observation + reflection pass at the end.
   *
   * @param threadId - The thread ID
   * @param resourceId - Optional resource ID (required for resource scope)
   * @param options - Optional configuration
   * @param options.reflect - Whether to also run reflection after observation (default: true)
   * @param options.reflectionThreshold - Only reflect if observations exceed this token count
   *
   * @example
   * ```ts
   * // Process all sessions with Infinity thresholds, then finalize
   * await om.finalize(threadId, resourceId, {
   *   reflect: true,
   *   reflectionThreshold: 40000, // Only reflect if > 40k tokens
   * });
   * ```
   */
  async finalize(
    threadId: string,
    resourceId?: string,
    options?: {
      reflect?: boolean;
      reflectionThreshold?: number;
      /**
       * Maximum input tokens for the Observer/Reflector model.
       * If set, finalize() will trigger reflection mid-observation when approaching this limit.
       * This prevents exceeding model context limits for large datasets.
       */
      maxInputTokens?: number;
    },
  ): Promise<{ observed: boolean; reflected: boolean; observationTokens: number; reflectionCount: number }> {
    const { reflect = true, reflectionThreshold, maxInputTokens } = options ?? {};
    const ids = this.getStorageIds(threadId, resourceId);

    // Get or create the record
    // For resource scope, threadId is null but we pass the original threadId for record creation
    let record = await this.getOrCreateRecord(ids.threadId ?? threadId, ids.resourceId);

    // Load ALL unobserved messages (no threshold check)
    // For resource scope, pass null threadId to load from all threads
    const unobservedMessages = await this.loadUnobservedMessages(
      ids.threadId ?? threadId,
      ids.resourceId,
      record.lastObservedAt,
    );

    let observed = false;
    let reflected = false;
    let reflectionCount = 0;
    let observationTokens = record.observationTokenCount;

    // Run observation if there are unobserved messages
    if (unobservedMessages.length > 0) {
      omDebug(`[OM Finalize] Running observation on ${unobservedMessages.length} messages`);

      if (this.scope === 'resource') {
        // Resource scope: group by thread and observe each, with optional mid-loop reflection
        const result = await this.doResourceScopedObservationWithTokenLimit(
          record,
          threadId,
          ids.resourceId,
          unobservedMessages,
          {
            maxInputTokens,
            reflectionThreshold,
            reflect,
          },
        );
        reflectionCount = result.reflectionCount;
        reflected = result.reflected;
      } else {
        // Thread scope: observe all messages together
        await this.doSynchronousObservation(record, threadId, unobservedMessages);
      }

      observed = true;

      // Reload record to get updated token count
      const updatedRecord = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
      observationTokens = updatedRecord?.observationTokenCount ?? 0;

      omDebug(`[OM Finalize] Observation complete: ${observationTokens} tokens`);
    } else {
      omDebug(`[OM Finalize] No unobserved messages, skipping observation`);
    }

    // Run final reflection if requested and threshold is met (and we haven't already reflected enough)
    if (reflect && observationTokens > 0) {
      const threshold = reflectionThreshold ?? this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);

      if (observationTokens >= threshold) {
        omDebug(`[OM Finalize] Running final reflection (${observationTokens} >= ${threshold} tokens)`);

        // Get fresh record for reflection
        const recordForReflection = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
        if (recordForReflection?.activeObservations) {
          await this.storage.setReflectingFlag(recordForReflection.id, true);

          try {
            const patternsToReflect = this.reflectorRecognizePatterns ? recordForReflection.patterns : undefined;
            const reflectResult = await this.callReflector(
              recordForReflection.activeObservations,
              undefined,
              patternsToReflect,
            );
            const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

            await this.storage.createReflectionGeneration({
              currentRecord: recordForReflection,
              reflection: reflectResult.observations,
              tokenCount: reflectionTokenCount,
              patterns: reflectResult.patterns,
            });

            reflected = true;
            reflectionCount++;
            observationTokens = reflectionTokenCount;
            omDebug(`[OM Finalize] Final reflection complete: ${reflectionTokenCount} tokens`);
          } finally {
            await this.storage.setReflectingFlag(recordForReflection.id, false);
          }
        }
      } else {
        omDebug(`[OM Finalize] Skipping final reflection (${observationTokens} < ${threshold} tokens)`);
      }
    }

    return { observed, reflected, observationTokens, reflectionCount };
  }

  /**
   * Resource-scoped observation with token limit awareness.
   * Triggers mid-loop reflection when approaching maxInputTokens to stay within model limits.
   */
  private async doResourceScopedObservationWithTokenLimit(
    record: ObservationalMemoryRecord,
    currentThreadId: string,
    resourceId: string,
    allUnobservedMessages: MastraDBMessage[],
    options: {
      maxInputTokens?: number;
      reflectionThreshold?: number;
      reflect?: boolean;
    },
  ): Promise<{ reflected: boolean; reflectionCount: number }> {
    const { maxInputTokens, reflectionThreshold, reflect = true } = options;

    // If no maxInputTokens, use the standard parallel observation
    if (!maxInputTokens) {
      await this.doResourceScopedObservation(record, currentThreadId, resourceId, allUnobservedMessages);
      return { reflected: false, reflectionCount: 0 };
    }

    omDebug(`[OM Finalize] Token-limited observation for resource ${resourceId} (max: ${maxInputTokens} tokens)`);

    // Group by thread
    const messagesByThread = this.groupMessagesByThread(allUnobservedMessages);
    omDebug(`[OM Finalize] Found ${messagesByThread.size} threads with unobserved messages`);

    // Sort threads by oldest message (oldest first)
    const threadOrder = this.sortThreadsByOldestMessage(messagesByThread);

    // Calculate threshold for triggering mid-loop reflection
    // Leave buffer for the Observer prompt overhead (~5k tokens) and safety margin
    const reflectAtTokens = Math.floor(maxInputTokens * 0.7); // Reflect at 70% of max
    omDebug(`[OM Finalize] Will trigger reflection when observations reach ${reflectAtTokens} tokens`);

    let currentRecord = record;
    let reflectionCount = 0;
    let reflected = false;

    // Process threads sequentially (not parallel) to track token growth
    for (let i = 0; i < threadOrder.length; i++) {
      const threadId = threadOrder[i]!;
      const threadMessages = messagesByThread.get(threadId) ?? [];
      if (threadMessages.length === 0) continue;

      omDebug(
        `[OM Finalize] Observing thread ${i + 1}/${threadOrder.length}: ${threadId} (${threadMessages.length} messages)`,
      );

      // Get current observations
      const existingObservations = currentRecord.activeObservations ?? '';
      const existingPatterns = currentRecord.patterns;

      // Call observer for this thread
      const result = await this.callObserver(existingObservations, threadMessages, existingPatterns);

      // Wrap with thread tag and update observations
      const threadSection = await this.wrapWithThreadTag(threadId, result.observations);
      const updatedObservations = this.replaceOrAppendThreadSection(existingObservations, threadId, threadSection);

      // Merge patterns
      let allPatterns: Record<string, string[]> = { ...(existingPatterns ?? {}) };
      if (result.patterns) {
        allPatterns = this.mergePatterns(allPatterns, result.patterns);
      }

      // Calculate new token count
      let totalTokenCount = this.tokenCounter.countObservations(updatedObservations);
      if (Object.keys(allPatterns).length > 0) {
        const patternsString = this.formatPatternsForTokenCount(allPatterns);
        totalTokenCount += this.tokenCounter.countObservations(patternsString);
      }

      // Update thread metadata
      if (result.suggestedContinuation || result.currentTask) {
        const thread = await this.storage.getThreadById({ threadId });
        if (thread) {
          const newMetadata = setThreadOMMetadata(thread.metadata, {
            suggestedResponse: result.suggestedContinuation,
            currentTask: result.currentTask,
          });
          await this.storage.updateThread({
            id: threadId,
            title: thread.title ?? '',
            metadata: newMetadata,
          });
        }
      }

      // Use the max message timestamp as cursor
      const lastObservedAt = this.getMaxMessageTimestamp(threadMessages);

      // Save observations after each thread
      await this.storage.updateActiveObservations({
        id: currentRecord.id,
        observations: updatedObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        patterns: Object.keys(allPatterns).length > 0 ? allPatterns : undefined,
      });

      omDebug(`[OM Finalize] Thread ${threadId} complete: ${totalTokenCount} tokens total`);

      // Check if we need to reflect mid-loop
      const effectiveReflectionThreshold =
        reflectionThreshold ?? this.getMaxThreshold(this.reflectorConfig.reflectionThreshold);
      const shouldReflectMidLoop =
        reflect && totalTokenCount >= reflectAtTokens && totalTokenCount >= effectiveReflectionThreshold;

      if (shouldReflectMidLoop && i < threadOrder.length - 1) {
        // Not the last thread, so reflect to compress before continuing
        omDebug(`[OM Finalize] Mid-loop reflection triggered (${totalTokenCount} >= ${reflectAtTokens} tokens)`);

        // Get fresh record for reflection
        const recordForReflection = await this.storage.getObservationalMemory(null, resourceId);
        if (recordForReflection?.activeObservations) {
          await this.storage.setReflectingFlag(recordForReflection.id, true);

          try {
            const patternsToReflect = this.reflectorRecognizePatterns ? recordForReflection.patterns : undefined;
            const reflectResult = await this.callReflector(
              recordForReflection.activeObservations,
              undefined,
              patternsToReflect,
            );
            const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

            await this.storage.createReflectionGeneration({
              currentRecord: recordForReflection,
              reflection: reflectResult.observations,
              tokenCount: reflectionTokenCount,
              patterns: reflectResult.patterns,
            });

            reflectionCount++;
            reflected = true;
            omDebug(`[OM Finalize] Mid-loop reflection complete: ${totalTokenCount} -> ${reflectionTokenCount} tokens`);

            // Reload record to continue with compressed observations
            const newRecord = await this.storage.getObservationalMemory(null, resourceId);
            if (newRecord) {
              currentRecord = newRecord;
            }
          } finally {
            await this.storage.setReflectingFlag(recordForReflection.id, false);
          }
        }
      } else {
        // Update currentRecord for next iteration
        currentRecord = {
          ...currentRecord,
          activeObservations: updatedObservations,
          observationTokenCount: totalTokenCount,
          patterns: allPatterns,
          lastObservedAt,
        };
      }
    }

    omDebug(`[OM Finalize] Token-limited observation complete. Reflections: ${reflectionCount}`);
    return { reflected, reflectionCount };
  }

  /**
   * Get current observations for a thread/resource
   */
  async getObservations(threadId: string, resourceId?: string): Promise<string | undefined> {
    const ids = this.getStorageIds(threadId, resourceId);
    const record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
    return record?.activeObservations;
  }

  /**
   * Get current record for a thread/resource
   */
  async getRecord(threadId: string, resourceId?: string): Promise<ObservationalMemoryRecord | null> {
    const ids = this.getStorageIds(threadId, resourceId);
    return this.storage.getObservationalMemory(ids.threadId, ids.resourceId);
  }

  /**
   * Get observation history (previous generations)
   */
  async getHistory(threadId: string, resourceId?: string, limit?: number): Promise<ObservationalMemoryRecord[]> {
    const ids = this.getStorageIds(threadId, resourceId);
    return this.storage.getObservationalMemoryHistory(ids.threadId, ids.resourceId, limit);
  }

  /**
   * Clear all memory for a specific thread/resource
   */
  async clear(threadId: string, resourceId?: string): Promise<void> {
    const ids = this.getStorageIds(threadId, resourceId);
    await this.storage.clearObservationalMemory(ids.threadId, ids.resourceId);
  }

  /**
   * Get the underlying storage adapter
   */
  getStorage(): MemoryStorage {
    return this.storage;
  }

  /**
   * Get the token counter
   */
  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }

  /**
   * Get current observer configuration
   */
  getObserverConfig(): ResolvedObserverConfig {
    return this.observerConfig;
  }

  /**
   * Get current reflector configuration
   */
  getReflectorConfig(): ResolvedReflectorConfig {
    return this.reflectorConfig;
  }

  /**
   * Create a tool that allows the agent to ask a "recall agent" questions about memory.
   *
   * The recall agent sees the same context as the main agent (observations, patterns,
   * unobserved messages from other threads, current thread messages) and can answer
   * questions like "how many trips did the user take?" or "list all the user's pets".
   *
   * The response is returned directly to the main agent - no parsing or storage side effects.
   *
   * @param config Optional configuration for the recall tool
   * @returns A Mastra tool that can be added to an agent's tools
   *
   * @example
   * ```ts
   * const om = new ObservationalMemory({ storage, ... });
   *
   * const agent = new Agent({
   *   tools: { recall: om.getRecallTool() },
   *   // ...
   * });
   * ```
   */
  getRecallTool(config?: {
    /** Override the model used for recall (defaults to observer model) */
    model?: MastraModelConfig;
    /** Override the tool description */
    description?: string;
  }) {
    const model = config?.model ?? this.observerConfig.model;

    // Cached recall agent instance
    let recallAgent: Agent | null = null;

    return createTool({
      id: 'recall',
      description:
        config?.description ??
        'Recall specific information from memory. ' +
          'Use this when you need to count items, list things, or answer questions that require ' +
          'searching through past conversations.',
      inputSchema: z.object({
        pattern: z
          .string()
          .describe('The pattern to extract from memory. ' + 'Examples: "events", "past_jobs", "interests"'),
      }),
      execute: async (inputData, context) => {
        const { pattern } = inputData;

        // Get thread/resource context from the tool execution context
        const threadId = context?.agent?.threadId;
        const resourceId = context?.agent?.resourceId;

        if (!threadId) {
          return {
            success: false,
            error: 'No thread context available for recall.',
          };
        }

        try {
          // Get OM record for observations and patterns
          const ids = this.getStorageIds(threadId, resourceId);
          const record = await this.storage.getObservationalMemory(ids.threadId, ids.resourceId);

          if (!record) {
            return {
              success: false,
              error: 'No memory record found for this conversation.',
            };
          }

          // For resource scope, build unobserved context blocks from other threads
          // (these aren't in context?.agent?.messages since that only has current thread)
          let unobservedContextBlocks: string | undefined;
          if (this.scope === 'resource') {
            const historicalMessages = await this.loadUnobservedMessages(threadId, resourceId, record.lastObservedAt);
            if (historicalMessages.length > 0) {
              const messagesByThread = this.groupMessagesByThread(historicalMessages);
              unobservedContextBlocks = await this.formatUnobservedContextBlocks(messagesByThread, threadId);
            }
          }

          // Get thread metadata for current task and suggested response
          const thread = await this.storage.getThreadById({ threadId });
          const threadOMMetadata = getThreadOMMetadata(thread?.metadata);
          const currentTask = threadOMMetadata?.currentTask;
          const suggestedResponse = threadOMMetadata?.suggestedResponse;
          const patterns = record.patterns;

          // Format the OM context (observations, patterns, current task, etc.)
          // Note: recall tool uses current date for relative time (no request context available)
          const formattedContext = this.formatObservationsForContext(
            record.activeObservations || '',
            currentTask,
            suggestedResponse,
            unobservedContextBlocks,
            patterns,
            new Date(),
          );

          // Convert current agent loop messages to MastraDBMessage format
          // These are the processed messages the main agent sees (minus system messages)
          const agentMessages = context?.agent?.messages || [];
          const mastraMessages = convertMessages(agentMessages).to('Mastra.V2') as MastraDBMessage[];

          // Format messages for the recall prompt
          const formattedMessages = mastraMessages
            .filter(m => m.role !== 'system')
            .map(m => {
              const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
              const content =
                m.content?.parts
                  ?.map((p: any) => p.text || (p.toolInvocation ? `[Tool: ${p.toolInvocation.toolName}]` : ''))
                  .filter(Boolean)
                  .join(' ') || '';
              return `**${role}:** ${content}`;
            })
            .filter(m => !m.endsWith(': '))
            .join('\n\n');

          // Build the recall prompt
          const systemPrompt = `
=== CONTEXT ===

${formattedContext}

=== RECENT MESSAGES ===

${formattedMessages}

=== INSTRUCTIONS ===

- If counting items, provide the count and list the items
- If there are multiple variants of the same item, count each separately (eg three different days for the same kind of event)
- If the information is not available, say so clearly
- Use the observations and patterns to inform your answer
- Be specific and cite relevant details from the context
`;

          // Create the recall agent if not already created
          if (!recallAgent) {
            recallAgent = new Agent({
              id: 'recall-agent',
              name: 'Recall Agent',
              instructions: `You are a memory recall assistant. You have access to the user's conversation history and observations.`,
              model,
            });
          }

          const patternSlug = slugify(pattern);
          // Call the recall agent with retry for rate limits
          const result = await this.withRetry(
            () =>
              recallAgent!.generate(
                `Another agent has called on you to extract a pattern from the memory system the two of you share. Extract the following pattern using the information you're aware of. Your complete response will be shown directly to the agent that called on you.
<${patternSlug}>
- A (original date)
- B (original date)
- etc ...
</${patternSlug}>`,
                { instructions: systemPrompt },
              ),
            3,
            'Recall',
          );

          return {
            success: true,
            response: result.text,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Recall failed',
          };
        }
      },
    });
  }
}
