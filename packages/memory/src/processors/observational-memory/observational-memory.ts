import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import type { AgentConfig, MastraDBMessage, MessageList } from '@mastra/core/agent';
import { resolveModelConfig } from '@mastra/core/llm';
import { getThreadOMMetadata, parseMemoryRequestContext, setThreadOMMetadata } from '@mastra/core/memory';
import type {
  Processor,
  ProcessInputArgs,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
  ProcessorStreamWriter,
} from '@mastra/core/processors';
import { MessageHistory } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage, ObservationalMemoryRecord, BufferedObservationChunk } from '@mastra/core/storage';
import xxhash from 'xxhash-wasm';

const OM_DEBUG_LOG = join(process.cwd(), 'om-debug.log');
function omDebug(msg: string) {
  try {
    appendFileSync(OM_DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // ignore write errors
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
import type {
  ObservationConfig,
  ReflectionConfig,
  ThresholdRange,
  ModelSettings,
  ProviderOptions,
  DataOmObservationStartPart,
  DataOmObservationEndPart,
  DataOmObservationFailedPart,
  DataOmProgressPart,
  ObservationMarkerConfig,
  DataOmBufferingStartPart,
  DataOmBufferingEndPart,
  DataOmBufferingFailedPart,
  DataOmActivationPart,
  OmOperationType,
} from './types';

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
 * Debug event emitted when observation-related events occur.
 * Useful for understanding what the Observer is doing.
 */
export interface ObservationDebugEvent {
  type:
    | 'observation_triggered'
    | 'observation_complete'
    | 'reflection_triggered'
    | 'reflection_complete'
    | 'tokens_accumulated'
    | 'step_progress';
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
  /** Step progress fields (for step_progress events) */
  stepNumber?: number;
  finishReason?: string;
  thresholdPercent?: number;
  willSave?: boolean;
  willObserve?: boolean;
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
   * Model for both Observer and Reflector agents.
   * Sets the model for both agents at once. Cannot be used together with
   * `observation.model` or `reflection.model` — an error will be thrown.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: AgentConfig['model'];

  /**
   * Observation step configuration.
   */
  observation?: ObservationConfig;

  /**
   * Reflection step configuration.
   */
  reflection?: ReflectionConfig;

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
   * Share the token budget between messages and observations.
   * When true, the total budget = observation.messageTokens + reflection.observationTokens.
   * - Messages can use more space when observations are small
   * - Observations can use more space when messages are small
   *
   * This helps maximize context usage by allowing flexible allocation.
   *
   * @default false
   */
  shareTokenBudget?: boolean;
}

/**
 * Internal resolved config with all defaults applied.
 * Thresholds are stored as ThresholdRange internally for dynamic calculation,
 * even when user provides a simple number (converted based on shareTokenBudget).
 */
interface ResolvedObservationConfig {
  model: AgentConfig['model'];
  /** Internal threshold - always stored as ThresholdRange for dynamic calculation */
  messageTokens: number | ThresholdRange;
  /** Whether shared token budget is enabled */
  shareTokenBudget: boolean;
  /** Model settings - merged with user config and defaults */
  modelSettings: ModelSettings;
  providerOptions: ProviderOptions;
  maxTokensPerBatch: number;
  /** Token interval for async background observation buffering (resolved from config) */
  bufferEvery?: number;
  /** Ratio of buffered observations to activate (0-1 float) */
  asyncActivation?: number;
  /** Token threshold above which synchronous observation is forced */
  blockAfter?: number;
}

interface ResolvedReflectionConfig {
  model: AgentConfig['model'];
  /** Internal threshold - always stored as ThresholdRange for dynamic calculation */
  observationTokens: number | ThresholdRange;
  /** Whether shared token budget is enabled */
  shareTokenBudget: boolean;
  /** Model settings - merged with user config and defaults */
  modelSettings: ModelSettings;
  providerOptions: ProviderOptions;
  /** Ratio (0-1) controlling when async reflection buffering starts */
  asyncActivation?: number;
}

/**
 * Default configuration values matching the spec
 */
export const OBSERVATIONAL_MEMORY_DEFAULTS = {
  observation: {
    model: 'google/gemini-2.5-flash',
    messageTokens: 30_000,
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
    maxTokensPerBatch: 10_000,
    // Async buffering defaults (undefined = disabled, preserves current sync behavior)
    bufferEvery: undefined as number | undefined,
    asyncActivation: undefined as number | undefined, // Ratio of buffered content to activate (0-1)
  },
  reflection: {
    model: 'google/gemini-2.5-flash',
    observationTokens: 40_000,
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
    // Async reflection buffering (undefined = disabled, preserves current sync behavior)
    asyncActivation: undefined as number | undefined, // Ratio: start buffering at threshold * asyncActivation
  },
} as const;

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
 * import { ObservationalMemory } from '@mastra/memory/processors';
 *
 * // Minimal configuration
 * const om = new ObservationalMemory({ storage });
 *
 * // Full configuration
 * const om = new ObservationalMemory({
 *   storage,
 *   model: 'google/gemini-2.5-flash', // shared model for both agents
 *   shareTokenBudget: true,
 *   observation: {
 *     messageTokens: 30_000,
 *     modelSettings: { temperature: 0.3 },
 *   },
 *   reflection: {
 *     observationTokens: 40_000,
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
  private observationConfig: ResolvedObservationConfig;
  private reflectionConfig: ResolvedReflectionConfig;
  private onDebugEvent?: (event: ObservationDebugEvent) => void;

  /** Internal Observer agent - created lazily */
  private observerAgent?: Agent;

  /** Internal Reflector agent - created lazily */
  private reflectorAgent?: Agent;

  private shouldObscureThreadIds = false;
  private hasher = xxhash();
  private threadIdCache = new Map<string, string>();

  /**
   * Track message IDs observed during this instance's lifetime.
   * Prevents re-observing messages when per-thread lastObservedAt cursors
   * haven't fully advanced past messages observed in a prior cycle.
   */
  private observedMessageIds = new Set<string>();

  /** Internal MessageHistory for message persistence */
  private messageHistory: MessageHistory;

  /**
   * In-memory mutex for serializing observation/reflection cycles per resource/thread.
   * Prevents race conditions where two concurrent cycles could both read isObserving=false
   * before either sets it to true, leading to lost work.
   *
   * Key format: "resource:{resourceId}" or "thread:{threadId}"
   * Value: Promise that resolves when the lock is released
   *
   * NOTE: This mutex only works within a single Node.js process. For distributed
   * deployments, external locking (Redis, database locks) would be needed, or
   * accept eventual consistency (acceptable for v1).
   */
  private locks = new Map<string, Promise<void>>();

  /**
   * Track in-flight async buffering operations per resource/thread.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   * Value: Promise that resolves when buffering completes
   */
  private asyncBufferingOps = new Map<string, Promise<void>>();

  /**
   * Track the last token boundary at which we started buffering.
   * Used to determine when we've crossed a new `bufferEvery` interval.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   */
  private lastBufferedBoundary = new Map<string, number>();

  /**
   * Tracks cycleId for in-flight buffered reflections.
   * Since reflection buffering doesn't use chunks (it's a single string),
   * we store the cycleId in-memory so we can match it at activation time.
   * Key format: "refl:{lockKey}"
   */
  private reflectionBufferCycleIds = new Map<string, string>();

  /**
   * Check if async buffering is enabled for observations.
   */
  private isAsyncObservationEnabled(): boolean {
    const enabled = this.observationConfig.bufferEvery !== undefined && this.observationConfig.bufferEvery > 0;
    return enabled;
  }

  /**
   * Check if async buffering is enabled for reflections.
   * Reflection buffering is enabled when asyncActivation is set (triggers at threshold * asyncActivation).
   */
  private isAsyncReflectionEnabled(): boolean {
    return this.reflectionConfig.asyncActivation !== undefined && this.reflectionConfig.asyncActivation > 0;
  }

  /**
   * Get the buffer interval boundary key for observations.
   */
  private getObservationBufferKey(lockKey: string): string {
    return `obs:${lockKey}`;
  }

  /**
   * Get the buffer interval boundary key for reflections.
   */
  private getReflectionBufferKey(lockKey: string): string {
    return `refl:${lockKey}`;
  }

  /**
   * Safely get bufferedObservationChunks as an array.
   * Handles cases where it might be a JSON string or undefined.
   */
  private getBufferedChunks(record: ObservationalMemoryRecord | null | undefined): BufferedObservationChunk[] {
    if (!record?.bufferedObservationChunks) return [];
    if (Array.isArray(record.bufferedObservationChunks)) return record.bufferedObservationChunks;
    if (typeof record.bufferedObservationChunks === 'string') {
      try {
        const parsed = JSON.parse(record.bufferedObservationChunks);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Check if we've crossed a new bufferEvery interval boundary.
   * Returns true if async buffering should be triggered.
   */
  private shouldTriggerAsyncObservation(
    currentTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
  ): boolean {
    if (!this.isAsyncObservationEnabled()) return false;

    // Don't start a new buffer if one is already in progress (persisted flag survives instance recreation)
    if (record.isBufferingObservation) return false;

    // Also check in-memory state for the current instance (protects within a single request)
    const bufferKey = this.getObservationBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;

    const bufferEvery = this.observationConfig.bufferEvery!;
    // Use the higher of persisted DB value or in-memory value.
    // DB value survives instance recreation; in-memory value is set immediately
    // when buffering starts (before the DB write completes).
    const dbBoundary = record.lastBufferedAtTokens ?? 0;
    const memBoundary = this.lastBufferedBoundary.get(bufferKey) ?? 0;
    const lastBoundary = Math.max(dbBoundary, memBoundary);

    // Calculate which interval we're in
    const currentInterval = Math.floor(currentTokens / bufferEvery);
    const lastInterval = Math.floor(lastBoundary / bufferEvery);

    const shouldTrigger = currentInterval > lastInterval;

    // Trigger if we've crossed into a new interval
    return shouldTrigger;
  }

  /**
   * Check if async reflection buffering should be triggered.
   * Triggers once when observation tokens reach `threshold * asyncActivation`.
   * Only allows one buffered reflection at a time.
   */
  private shouldTriggerAsyncReflection(
    currentObservationTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
  ): boolean {
    if (!this.isAsyncReflectionEnabled()) return false;

    // Don't re-trigger if buffering is already in progress (persisted flag survives instance recreation)
    if (record.isBufferingReflection) return false;

    // Also check in-memory state for the current instance
    const bufferKey = this.getReflectionBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;
    if (this.lastBufferedBoundary.has(bufferKey)) return false;

    // Don't re-trigger if the record already has a buffered reflection
    if (record.bufferedReflection) return false;

    // Check if we've crossed the activation threshold
    const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    const activationPoint = reflectThreshold * this.reflectionConfig.asyncActivation!;

    return currentObservationTokens >= activationPoint;
  }

  /**
   * Check if an async buffering operation is already in progress.
   */
  private isAsyncBufferingInProgress(bufferKey: string): boolean {
    return this.asyncBufferingOps.has(bufferKey);
  }

  /**
   * Acquire a lock for the given key, execute the callback, then release.
   * If a lock is already held, waits for it to be released before acquiring.
   */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock to be released
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }

    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      // Release the lock
      releaseLock!();
      // Clean up if this is still our lock
      if (this.locks.get(key) === lockPromise) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Get the lock key for the current scope
   */
  private getLockKey(threadId: string | null | undefined, resourceId: string | null | undefined): string {
    if (this.scope === 'resource' && resourceId) {
      return `resource:${resourceId}`;
    }
    return `thread:${threadId ?? 'unknown'}`;
  }

  constructor(config: ObservationalMemoryConfig) {
    // Validate that top-level model is not used together with sub-config models
    if (config.model && config.observation?.model) {
      throw new Error(
        'Cannot set both `model` and `observation.model`. Use `model` to set both agents, or set each individually.',
      );
    }
    if (config.model && config.reflection?.model) {
      throw new Error(
        'Cannot set both `model` and `reflection.model`. Use `model` to set both agents, or set each individually.',
      );
    }

    this.shouldObscureThreadIds = config.obscureThreadIds || false;
    this.storage = config.storage;
    this.scope = config.scope ?? 'thread';

    // Resolve model: top-level model takes precedence, then sub-config, then default
    const observationModel =
      config.model ?? config.observation?.model ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.model;
    const reflectionModel = config.model ?? config.reflection?.model ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.model;

    // Get base thresholds first (needed for shared budget calculation)
    const messageTokens = config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens;
    const observationTokens =
      config.reflection?.observationTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.observationTokens;
    const isSharedBudget = config.shareTokenBudget ?? false;

    // Total context budget when shared budget is enabled
    const totalBudget = messageTokens + observationTokens;

    // Resolve observation config with defaults
    this.observationConfig = {
      model: observationModel,
      // When shared budget, store as range: min = base threshold, max = total budget
      // This allows messages to expand into unused observation space
      messageTokens: isSharedBudget ? { min: messageTokens, max: totalBudget } : messageTokens,
      shareTokenBudget: isSharedBudget,
      modelSettings: {
        temperature:
          config.observation?.modelSettings?.temperature ??
          OBSERVATIONAL_MEMORY_DEFAULTS.observation.modelSettings.temperature,
        maxOutputTokens:
          config.observation?.modelSettings?.maxOutputTokens ??
          OBSERVATIONAL_MEMORY_DEFAULTS.observation.modelSettings.maxOutputTokens,
      },
      providerOptions: config.observation?.providerOptions ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.providerOptions,
      maxTokensPerBatch:
        config.observation?.maxTokensPerBatch ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.maxTokensPerBatch,
      bufferEvery: this.resolveBufferEvery(
        config.observation?.bufferEvery,
        config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
      ),
      asyncActivation: config.observation?.asyncActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.asyncActivation,
      blockAfter: this.resolveBlockAfter(
        config.observation?.blockAfter,
        config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
      ),
    };

    // Resolve reflection config with defaults
    this.reflectionConfig = {
      model: reflectionModel,
      observationTokens: observationTokens,
      shareTokenBudget: isSharedBudget,
      modelSettings: {
        temperature:
          config.reflection?.modelSettings?.temperature ??
          OBSERVATIONAL_MEMORY_DEFAULTS.reflection.modelSettings.temperature,
        maxOutputTokens:
          config.reflection?.modelSettings?.maxOutputTokens ??
          OBSERVATIONAL_MEMORY_DEFAULTS.reflection.modelSettings.maxOutputTokens,
      },
      providerOptions: config.reflection?.providerOptions ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.providerOptions,
      asyncActivation: config?.reflection?.asyncActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.asyncActivation,
    };

    this.tokenCounter = new TokenCounter();
    this.onDebugEvent = config.onDebugEvent;

    // Create internal MessageHistory for message persistence
    // OM handles message saving itself (in processOutputStep) instead of relying on
    // the Memory class's MessageHistory processor
    this.messageHistory = new MessageHistory({ storage: this.storage });

    // Validate buffer configuration
    this.validateBufferConfig();
  }

  /**
   * Get the current configuration for this OM instance.
   * Used by the server to expose config to the UI when OM is added via processors.
   */
  get config(): {
    scope: 'resource' | 'thread';
    observation: {
      messageTokens: number | ThresholdRange;
    };
    reflection: {
      observationTokens: number | ThresholdRange;
    };
  } {
    return {
      scope: this.scope,
      observation: {
        messageTokens: this.observationConfig.messageTokens,
      },
      reflection: {
        observationTokens: this.reflectionConfig.observationTokens,
      },
    };
  }

  /**
   * Get the full config including resolved model names.
   * This is async because it needs to resolve the model configs.
   */
  async getResolvedConfig(requestContext?: RequestContext): Promise<{
    scope: 'resource' | 'thread';
    observation: {
      messageTokens: number | ThresholdRange;
      model: string;
    };
    reflection: {
      observationTokens: number | ThresholdRange;
      model: string;
    };
  }> {
    // Helper to get the model config to resolve (handles ModelWithRetries[] by taking first)
    const getModelToResolve = (model: AgentConfig['model']) => {
      if (Array.isArray(model)) {
        return model[0]?.model ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.model;
      }
      return model;
    };

    // Format as provider/modelId (e.g., "google/gemini-2.5-flash")
    const formatModelName = (model: { provider?: string; modelId: string }) => {
      return model.provider ? `${model.provider}/${model.modelId}` : model.modelId;
    };

    // Helper to safely resolve a model config
    const safeResolveModel = async (modelConfig: AgentConfig['model']): Promise<string> => {
      const modelToResolve = getModelToResolve(modelConfig);

      try {
        // resolveModelConfig handles both static configs and functions
        const resolved = await resolveModelConfig(modelToResolve, requestContext);
        return formatModelName(resolved);
      } catch (error) {
        // If resolution fails, return a placeholder
        console.error('[OM] Failed to resolve model config:', error);
        return '(unknown)';
      }
    };

    const [observationModelName, reflectionModelName] = await Promise.all([
      safeResolveModel(this.observationConfig.model),
      safeResolveModel(this.reflectionConfig.model),
    ]);

    return {
      scope: this.scope,
      observation: {
        messageTokens: this.observationConfig.messageTokens,
        model: observationModelName,
      },
      reflection: {
        observationTokens: this.reflectionConfig.observationTokens,
        model: reflectionModelName,
      },
    };
  }

  /**
   * Emit a debug event if the callback is configured
   */
  private emitDebugEvent(event: ObservationDebugEvent): void {
    if (this.onDebugEvent) {
      this.onDebugEvent(event);
    }
  }

  /**
   * Validate buffer configuration on first use.
   * Ensures bufferEvery is less than the threshold and asyncActivation is valid.
   */
  private validateBufferConfig(): void {
    // Validate observation bufferEvery
    const observationThreshold = this.getMaxThreshold(this.observationConfig.messageTokens);
    if (this.observationConfig.bufferEvery !== undefined) {
      if (this.observationConfig.bufferEvery <= 0) {
        throw new Error(`observation.bufferEvery must be > 0, got ${this.observationConfig.bufferEvery}`);
      }
      if (this.observationConfig.bufferEvery >= observationThreshold) {
        throw new Error(
          `observation.bufferEvery (${this.observationConfig.bufferEvery}) must be less than messageTokens (${observationThreshold})`,
        );
      }
    }

    // Validate observation asyncActivation (0-1 float range)
    if (this.observationConfig.asyncActivation !== undefined) {
      if (this.observationConfig.asyncActivation <= 0 || this.observationConfig.asyncActivation > 1) {
        throw new Error(
          `observation.asyncActivation must be in range (0, 1], got ${this.observationConfig.asyncActivation}`,
        );
      }
    }

    // Validate observation blockAfter
    if (this.observationConfig.blockAfter !== undefined) {
      if (this.observationConfig.blockAfter <= observationThreshold) {
        throw new Error(
          `observation.blockAfter (${this.observationConfig.blockAfter}) must be greater than messageTokens (${observationThreshold})`,
        );
      }
      if (!this.observationConfig.bufferEvery) {
        throw new Error(
          `observation.blockAfter requires observation.bufferEvery to be set (blockAfter only applies when async buffering is enabled)`,
        );
      }
    }

    // Validate reflection asyncActivation (0-1 float range)
    if (this.reflectionConfig.asyncActivation !== undefined) {
      if (this.reflectionConfig.asyncActivation <= 0 || this.reflectionConfig.asyncActivation > 1) {
        throw new Error(
          `reflection.asyncActivation must be in range (0, 1], got ${this.reflectionConfig.asyncActivation}`,
        );
      }
    }

    // Enforce: if observation has async buffering, reflection must have asyncActivation too
    const obsHasAsync = this.observationConfig.bufferEvery !== undefined;
    const refHasAsync =
      this.reflectionConfig.asyncActivation !== undefined && this.reflectionConfig.asyncActivation > 0;
    if (obsHasAsync && !refHasAsync) {
      throw new Error(
        `When observation.bufferEvery is set, reflection.asyncActivation must also be set. ` +
          `Got observation.bufferEvery=${this.observationConfig.bufferEvery}, reflection.asyncActivation=${this.reflectionConfig.asyncActivation}.`,
      );
    }
  }

  /**
   * Resolve bufferEvery: if it's a fraction (0 < value < 1), multiply by messageTokens threshold.
   * Otherwise return the absolute token count.
   */
  private resolveBufferEvery(
    bufferEvery: number | undefined,
    messageTokens: number | ThresholdRange,
  ): number | undefined {
    if (bufferEvery === undefined) return undefined;
    if (bufferEvery > 0 && bufferEvery < 1) {
      const threshold = typeof messageTokens === 'number' ? messageTokens : messageTokens.max;
      return Math.round(threshold * bufferEvery);
    }
    return bufferEvery;
  }

  /**
   * Resolve blockAfter config value.
   * If 0 < blockAfter < 1, treat as a fraction of extra headroom above messageTokens.
   * e.g. blockAfter: 0.25 with messageTokens: 20_000 → 25_000
   */
  private resolveBlockAfter(
    blockAfter: number | undefined,
    messageTokens: number | ThresholdRange,
  ): number | undefined {
    if (blockAfter === undefined) return undefined;
    if (blockAfter > 0 && blockAfter < 1) {
      const threshold = typeof messageTokens === 'number' ? messageTokens : messageTokens.max;
      return Math.round(threshold * (1 + blockAfter));
    }
    return blockAfter;
  }

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
   * Calculate dynamic threshold based on observation space.
   * When shareTokenBudget is enabled, the message threshold can expand
   * into unused observation space, up to the total context budget.
   *
   * Total budget = messageTokens + observationTokens
   * Effective threshold = totalBudget - currentObservationTokens
   *
   * Example with 30k:40k thresholds (70k total):
   * - 0 observations → messages can use ~70k
   * - 10k observations → messages can use ~60k
   * - 40k observations → messages back to ~30k
   */
  private calculateDynamicThreshold(threshold: number | ThresholdRange, currentObservationTokens: number): number {
    // If not using adaptive threshold (simple number), return as-is
    if (typeof threshold === 'number') {
      return threshold;
    }

    // Adaptive threshold: use remaining space in total budget
    // Total budget is stored as threshold.max (base + reflection threshold)
    // Base threshold is stored as threshold.min
    const totalBudget = threshold.max;
    const baseThreshold = threshold.min;

    // Effective threshold = total budget minus current observations
    // But never go below the base threshold
    const effectiveThreshold = Math.max(totalBudget - currentObservationTokens, baseThreshold);

    return Math.round(effectiveThreshold);
  }

  /**
   * Get or create the Observer agent
   */
  private getObserverAgent(): Agent {
    if (!this.observerAgent) {
      const systemPrompt = buildObserverSystemPrompt();

      this.observerAgent = new Agent({
        id: 'observational-memory-observer',
        name: 'Observer',
        instructions: systemPrompt,
        model: this.observationConfig.model,
      });
    }
    return this.observerAgent;
  }

  /**
   * Get or create the Reflector agent
   */
  private getReflectorAgent(): Agent {
    if (!this.reflectorAgent) {
      const systemPrompt = buildReflectorSystemPrompt();

      this.reflectorAgent = new Agent({
        id: 'observational-memory-reflector',
        name: 'Reflector',
        instructions: systemPrompt,
        model: this.reflectionConfig.model,
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
      // Capture the timezone used for Observer date formatting
      const observedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      record = await this.storage.initializeObservationalMemory({
        threadId: ids.threadId,
        resourceId: ids.resourceId,
        scope: this.scope,
        config: {
          observation: this.observationConfig,
          reflection: this.reflectionConfig,
          scope: this.scope,
        },
        observedTimezone,
      });
    }

    return record;
  }

  /**
   * Check if we need to trigger reflection.
   */
  private shouldReflect(observationTokens: number): boolean {
    const threshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    return observationTokens > threshold;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DATA-OM-OBSERVATION PART HELPERS (Start/End/Failed markers)
  // These helpers manage the observation boundary markers within messages.
  //
  // Flow:
  // 1. Before observation: [...messageParts]
  // 2. Insert start: [...messageParts, start] → stream to UI (loading state)
  // 3. After success: [...messageParts, start, end] → stream to UI (complete)
  // 4. After failure: [...messageParts, start, failed]
  //
  // For filtering, we look for the last completed observation (start + end pair).
  // A start without end means observation is in progress.
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get current config snapshot for observation markers.
   */
  private getObservationMarkerConfig(): ObservationMarkerConfig {
    return {
      messageTokens: this.getMaxThreshold(this.observationConfig.messageTokens),
      observationTokens: this.getMaxThreshold(this.reflectionConfig.observationTokens),
      scope: this.scope,
    };
  }

  /**
   * Create a start marker for when observation begins.
   */
  private createObservationStartMarker(params: {
    cycleId: string;
    operationType: 'observation' | 'reflection';
    tokensToObserve: number;
    recordId: string;
    threadId: string;
    threadIds: string[];
  }): DataOmObservationStartPart {
    return {
      type: 'data-om-observation-start',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        startedAt: new Date().toISOString(),
        tokensToObserve: params.tokensToObserve,
        recordId: params.recordId,
        threadId: params.threadId,
        threadIds: params.threadIds,
        config: this.getObservationMarkerConfig(),
      },
    };
  }

  /**
   * Create an end marker for when observation completes successfully.
   */
  private createObservationEndMarker(params: {
    cycleId: string;
    operationType: 'observation' | 'reflection';
    startedAt: string;
    tokensObserved: number;
    observationTokens: number;
    observations?: string;
    currentTask?: string;
    suggestedResponse?: string;
    recordId: string;
    threadId: string;
  }): DataOmObservationEndPart {
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(params.startedAt).getTime();

    return {
      type: 'data-om-observation-end',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        completedAt,
        durationMs,
        tokensObserved: params.tokensObserved,
        observationTokens: params.observationTokens,
        observations: params.observations,
        currentTask: params.currentTask,
        suggestedResponse: params.suggestedResponse,
        recordId: params.recordId,
        threadId: params.threadId,
      },
    };
  }

  /**
   * Create a failed marker for when observation fails.
   */
  private createObservationFailedMarker(params: {
    cycleId: string;
    operationType: 'observation' | 'reflection';
    startedAt: string;
    tokensAttempted: number;
    error: string;
    recordId: string;
    threadId: string;
  }): DataOmObservationFailedPart {
    const failedAt = new Date().toISOString();
    const durationMs = new Date(failedAt).getTime() - new Date(params.startedAt).getTime();

    return {
      type: 'data-om-observation-failed',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        failedAt,
        durationMs,
        tokensAttempted: params.tokensAttempted,
        error: params.error,
        recordId: params.recordId,
        threadId: params.threadId,
      },
    };
  }

  /**
   * Create a start marker for when async buffering begins.
   */
  private createBufferingStartMarker(params: {
    cycleId: string;
    operationType: OmOperationType;
    tokensToBuffer: number;
    recordId: string;
    threadId: string;
    threadIds: string[];
  }): DataOmBufferingStartPart {
    return {
      type: 'data-om-buffering-start',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        startedAt: new Date().toISOString(),
        tokensToBuffer: params.tokensToBuffer,
        recordId: params.recordId,
        threadId: params.threadId,
        threadIds: params.threadIds,
        config: this.getObservationMarkerConfig(),
      },
    };
  }

  /**
   * Create an end marker for when async buffering completes successfully.
   */
  private createBufferingEndMarker(params: {
    cycleId: string;
    operationType: OmOperationType;
    startedAt: string;
    tokensBuffered: number;
    bufferedTokens: number;
    recordId: string;
    threadId: string;
    observations?: string;
  }): DataOmBufferingEndPart {
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(params.startedAt).getTime();

    return {
      type: 'data-om-buffering-end',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        completedAt,
        durationMs,
        tokensBuffered: params.tokensBuffered,
        bufferedTokens: params.bufferedTokens,
        recordId: params.recordId,
        threadId: params.threadId,
        observations: params.observations,
      },
    };
  }

  /**
   * Create a failed marker for when async buffering fails.
   */
  private createBufferingFailedMarker(params: {
    cycleId: string;
    operationType: OmOperationType;
    startedAt: string;
    tokensAttempted: number;
    error: string;
    recordId: string;
    threadId: string;
  }): DataOmBufferingFailedPart {
    const failedAt = new Date().toISOString();
    const durationMs = new Date(failedAt).getTime() - new Date(params.startedAt).getTime();

    return {
      type: 'data-om-buffering-failed',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        failedAt,
        durationMs,
        tokensAttempted: params.tokensAttempted,
        error: params.error,
        recordId: params.recordId,
        threadId: params.threadId,
      },
    };
  }

  /**
   * Create an activation marker for when buffered observations are activated.
   */
  private createActivationMarker(params: {
    cycleId: string;
    operationType: OmOperationType;
    chunksActivated: number;
    tokensActivated: number;
    observationTokens: number;
    messagesActivated: number;
    recordId: string;
    threadId: string;
    observations?: string;
  }): DataOmActivationPart {
    return {
      type: 'data-om-activation',
      data: {
        cycleId: params.cycleId,
        operationType: params.operationType,
        activatedAt: new Date().toISOString(),
        chunksActivated: params.chunksActivated,
        tokensActivated: params.tokensActivated,
        observationTokens: params.observationTokens,
        messagesActivated: params.messagesActivated,
        recordId: params.recordId,
        threadId: params.threadId,
        config: this.getObservationMarkerConfig(),
        observations: params.observations,
      },
    };
  }

  /**
   * Find the last completed observation boundary in a message's parts.
   * A completed observation is a start marker followed by an end marker.
   *
   * Returns the index of the END marker (which is the observation boundary),
   * or -1 if no completed observation is found.
   */
  private findLastCompletedObservationBoundary(message: MastraDBMessage): number {
    const parts = message.content?.parts;
    if (!parts || !Array.isArray(parts)) return -1;

    // Search from the end to find the most recent end marker
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i] as { type?: string };
      if (part?.type === 'data-om-observation-end') {
        // Found an end marker - this is the observation boundary
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if a message has an in-progress observation (start without end).
   */
  private hasInProgressObservation(message: MastraDBMessage): boolean {
    const parts = message.content?.parts;
    if (!parts || !Array.isArray(parts)) return false;

    let lastStartIndex = -1;
    let lastEndOrFailedIndex = -1;

    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i] as { type?: string };
      if (part?.type === 'data-om-observation-start' && lastStartIndex === -1) {
        lastStartIndex = i;
      }
      if (
        (part?.type === 'data-om-observation-end' || part?.type === 'data-om-observation-failed') &&
        lastEndOrFailedIndex === -1
      ) {
        lastEndOrFailedIndex = i;
      }
    }

    // In progress if we have a start that comes after any end/failed
    return lastStartIndex !== -1 && lastStartIndex > lastEndOrFailedIndex;
  }

  /**
   * Seal messages to prevent new parts from being merged into them.
   * This is used when starting buffering to capture the current content state.
   *
   * Sealing works by:
   * 1. Setting `message.content.metadata.mastra.sealed = true` (message-level flag)
   * 2. Adding `metadata.mastra.sealedAt` to the last part (boundary marker)
   *
   * When MessageList.add() receives a message with the same ID as a sealed message,
   * it creates a new message with only the parts beyond the seal boundary.
   *
   * The messages are mutated in place - since they're references to the same objects
   * in the MessageList, the seal will be recognized immediately.
   *
   * @param messages - Messages to seal (mutated in place)
   */
  private sealMessagesForBuffering(messages: MastraDBMessage[]): void {
    const sealedAt = Date.now();

    for (const msg of messages) {
      if (!msg.content?.parts?.length) continue;

      // Set message-level sealed flag
      if (!msg.content.metadata) {
        msg.content.metadata = {};
      }
      const metadata = msg.content.metadata as { mastra?: { sealed?: boolean } };
      if (!metadata.mastra) {
        metadata.mastra = {};
      }
      metadata.mastra.sealed = true;

      // Add sealedAt to the last part
      const lastPart = msg.content.parts[msg.content.parts.length - 1] as {
        metadata?: { mastra?: { sealedAt?: number } };
      };
      if (!lastPart.metadata) {
        lastPart.metadata = {};
      }
      if (!lastPart.metadata.mastra) {
        lastPart.metadata.mastra = {};
      }
      lastPart.metadata.mastra.sealedAt = sealedAt;
    }
  }

  /**
   * Insert an observation marker into a message.
   * The marker is appended directly to the message's parts array (mutating in place).
   * Also persists the change to storage so markers survive page refresh.
   *
   * For end/failed markers, the message is also "sealed" to prevent future content
   * from being merged into it. This ensures observation markers are preserved.
   */
  /**
   * Insert an observation marker into a message.
   * For start markers, this pushes the part directly.
   * For end/failed markers, this should be called AFTER writer.custom() has added the part,
   * so we just find the part and add sealing metadata.
   */

  /**
   * Get unobserved parts from a message.
   * If the message has a completed observation (start + end), only return parts after the end.
   * If observation is in progress (start without end), include parts before the start.
   * Otherwise, return all parts.
   */
  private getUnobservedParts(message: MastraDBMessage): MastraDBMessage['content']['parts'] {
    const parts = message.content?.parts;
    if (!parts || !Array.isArray(parts)) return [];

    const endMarkerIndex = this.findLastCompletedObservationBoundary(message);
    if (endMarkerIndex === -1) {
      // No completed observation - all parts are unobserved
      // (This includes the case where observation is in progress)
      return parts.filter(p => {
        const part = p as { type?: string };
        // Exclude start markers that are in progress
        return part?.type !== 'data-om-observation-start';
      });
    }

    // Return only parts after the end marker (excluding start/end/failed markers)
    return parts.slice(endMarkerIndex + 1).filter(p => {
      const part = p as { type?: string };
      return !part?.type?.startsWith('data-om-observation-');
    });
  }

  /**
   * Check if a message has any unobserved parts.
   */
  private hasUnobservedParts(message: MastraDBMessage): boolean {
    return this.getUnobservedParts(message).length > 0;
  }

  /**
   * Create a virtual message containing only the unobserved parts.
   * This is used for token counting and observation.
   */
  private createUnobservedMessage(message: MastraDBMessage): MastraDBMessage | null {
    const unobservedParts = this.getUnobservedParts(message);
    if (unobservedParts.length === 0) return null;

    return {
      ...message,
      content: {
        ...message.content,
        parts: unobservedParts,
      },
    };
  }

  /**
   * Get unobserved messages with part-level filtering.
   *
   * This method uses data-om-observation-end markers to filter at the part level:
   * 1. For messages WITH a completed observation: only return parts AFTER the end marker
   * 2. For messages WITHOUT completed observation: check timestamp against lastObservedAt
   *
   * This handles the case where a single message accumulates many parts
   * (like tool calls) during an agentic loop - we only observe the new parts.
   */
  private getUnobservedMessages(allMessages: MastraDBMessage[], record: ObservationalMemoryRecord): MastraDBMessage[] {
    const lastObservedAt = record.lastObservedAt;
    // Safeguard: track message IDs that were already observed to prevent re-observation
    // This handles edge cases like process restarts where lastObservedAt might not capture all messages
    const observedMessageIds = new Set<string>(
      Array.isArray(record.observedMessageIds) ? record.observedMessageIds : [],
    );

    // CRITICAL: Also include message IDs from buffered chunks to prevent re-buffering
    // Messages that have been buffered but not yet activated are still "observed" from
    // the perspective of determining what needs to be processed next
    const bufferedChunks = this.getBufferedChunks(record);
    for (const chunk of bufferedChunks) {
      if (Array.isArray(chunk.messageIds)) {
        for (const id of chunk.messageIds) {
          observedMessageIds.add(id);
        }
      }
    }

    if (!lastObservedAt && observedMessageIds.size === 0) {
      // No observations yet - all messages are unobserved
      return allMessages;
    }

    const result: MastraDBMessage[] = [];

    for (const msg of allMessages) {
      // First check: skip if this message ID was already observed (safeguard against re-observation)
      if (observedMessageIds?.has(msg.id)) {
        continue;
      }

      // Check if this message has a completed observation
      const endMarkerIndex = this.findLastCompletedObservationBoundary(msg);
      const inProgress = this.hasInProgressObservation(msg);

      if (inProgress) {
        // Include the full message for in-progress observations
        // The Observer is currently working on this
        result.push(msg);
      } else if (endMarkerIndex !== -1) {
        // Message has a completed observation - only include parts after it
        const virtualMsg = this.createUnobservedMessage(msg);
        if (virtualMsg) {
          result.push(virtualMsg);
        } else {
        }
      } else {
        // No observation markers - fall back to timestamp-based filtering
        if (!msg.createdAt || !lastObservedAt) {
          // Messages without timestamps are always included
          // Also include messages when there's no lastObservedAt timestamp
          result.push(msg);
        } else {
          const msgDate = new Date(msg.createdAt);
          if (msgDate > lastObservedAt) {
            result.push(msg);
          } else {
          }
        }
      }
    }

    return result;
  }

  /**
   * Wrapper for observer/reflector agent.generate() calls that checks for abort.
   * agent.generate() returns an empty result on abort instead of throwing,
   * so we must check the signal before and after the call.
   * Retries are handled by Mastra's built-in p-retry at the model execution layer.
   */
  private async withAbortCheck<T>(fn: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }

    const result = await fn();

    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }

    return result;
  }

  /**
   * Call the Observer agent to extract observations.
   */
  private async callObserver(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    abortSignal?: AbortSignal,
    options?: { skipContinuationHints?: boolean },
  ): Promise<{
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.getObserverAgent();

    const prompt = buildObserverPrompt(existingObservations, messagesToObserve, options);

    const result = await this.withAbortCheck(
      () =>
        agent.generate(prompt, {
          modelSettings: {
            ...this.observationConfig.modelSettings,
          },
          providerOptions: this.observationConfig.providerOptions as any,
          abortSignal,
        }),
      abortSignal,
    );

    const parsed = parseObserverOutput(result.text);

    // Extract usage from result (totalUsage or usage)
    const usage = result.totalUsage ?? result.usage;

    return {
      observations: parsed.observations,
      currentTask: parsed.currentTask,
      suggestedContinuation: parsed.suggestedContinuation,
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
    abortSignal?: AbortSignal,
  ): Promise<{
    results: Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
      }
    >;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    // Create a multi-thread observer agent with the special system prompt
    const agent = new Agent({
      id: 'multi-thread-observer',
      name: 'multi-thread-observer',
      model: this.observationConfig.model,
      instructions: buildObserverSystemPrompt(true),
    });

    const prompt = buildMultiThreadObserverPrompt(existingObservations, messagesByThread, threadOrder);

    // Flatten all messages for context dump
    const allMessages: MastraDBMessage[] = [];
    for (const msgs of messagesByThread.values()) {
      allMessages.push(...msgs);
    }

    // Mark all messages as observed (skip any already-observed)
    for (const msg of allMessages) {
      this.observedMessageIds.add(msg.id);
    }

    const result = await this.withAbortCheck(
      () =>
        agent.generate(prompt, {
          modelSettings: {
            ...this.observationConfig.modelSettings,
          },
          providerOptions: this.observationConfig.providerOptions as any,
          abortSignal,
        }),
      abortSignal,
    );

    const parsed = parseMultiThreadObserverOutput(result.text);

    // Convert to the expected return format
    const results = new Map<
      string,
      {
        observations: string;
        currentTask?: string;
        suggestedContinuation?: string;
      }
    >();

    for (const [threadId, threadResult] of parsed.threads) {
      results.set(threadId, {
        observations: threadResult.observations,
        currentTask: threadResult.currentTask,
        suggestedContinuation: threadResult.suggestedContinuation,
      });
    }

    // If some threads didn't get results, log a warning
    for (const threadId of threadOrder) {
      if (!results.has(threadId)) {
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
    streamContext?: {
      writer?: ProcessorStreamWriter;
      cycleId: string;
      startedAt: string;
      recordId: string;
      threadId: string;
    },
    observationTokensThreshold?: number,
    abortSignal?: AbortSignal,
    skipContinuationHints?: boolean,
  ): Promise<{
    observations: string;
    suggestedContinuation?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.getReflectorAgent();

    const originalTokens = this.tokenCounter.countObservations(observations);

    // Get the target threshold - use provided value or fall back to config
    const targetThreshold = observationTokensThreshold ?? this.getMaxThreshold(this.reflectionConfig.observationTokens);

    // Track total usage across attempts
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    // First attempt
    let prompt = buildReflectorPrompt(observations, manualPrompt, false, skipContinuationHints);
    let result = await this.withAbortCheck(
      () =>
        agent.generate(prompt, {
          modelSettings: {
            ...this.reflectionConfig.modelSettings,
          },
          providerOptions: this.reflectionConfig.providerOptions as any,
          abortSignal,
        }),
      abortSignal,
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

    // Check if compression was successful (reflected tokens should be below target threshold)
    if (!validateCompression(reflectedTokens, targetThreshold)) {
      // Emit failed marker for first attempt, then start marker for retry
      if (streamContext?.writer) {
        const failedMarker = this.createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: originalTokens,
          error: `Did not compress below threshold (${originalTokens} → ${reflectedTokens}, target: ${targetThreshold}), retrying with compression guidance`,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
        });
        await streamContext.writer.custom(failedMarker).catch(() => {});

        // Generate new cycleId for retry
        const retryCycleId = crypto.randomUUID();
        streamContext.cycleId = retryCycleId;

        const startMarker = this.createObservationStartMarker({
          cycleId: retryCycleId,
          operationType: 'reflection',
          tokensToObserve: originalTokens,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
          threadIds: [streamContext.threadId],
        });
        // Update startedAt from the marker that was just created
        streamContext.startedAt = startMarker.data.startedAt;
        await streamContext.writer.custom(startMarker).catch(() => {});
      }

      // Retry with compression prompt
      prompt = buildReflectorPrompt(observations, manualPrompt, true, skipContinuationHints);
      result = await this.withAbortCheck(
        () =>
          agent.generate(prompt, {
            modelSettings: {
              ...this.reflectionConfig.modelSettings,
            },
            providerOptions: this.reflectionConfig.providerOptions as any,
            abortSignal,
          }),
        abortSignal,
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
    }

    return {
      observations: parsed.observations,
      suggestedContinuation: parsed.suggestedContinuation,
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

    // Add unobserved context from other threads (resource scope only)
    if (unobservedContextBlocks) {
      content += `\n\nThe following content is from OTHER conversations different from the current conversation, they're here for reference,  but they're not necessarily your focus:\nSTART_OTHER_CONVERSATIONS_BLOCK\n${unobservedContextBlocks}\nEND_OTHER_CONVERSATIONS_BLOCK`;
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

  // ══════════════════════════════════════════════════════════════════════════
  // PROCESS INPUT STEP HELPERS
  // These helpers extract logical units from processInputStep for clarity.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Load historical unobserved messages into the message list (step 0 only).
   * In resource scope, loads only current thread's messages.
   * In thread scope, loads all unobserved messages for the thread.
   */
  private async loadHistoricalMessagesIfNeeded(
    messageList: MessageList,
    state: Record<string, unknown>,
    threadId: string,
    resourceId: string | undefined,
    lastObservedAt: Date | undefined,
  ): Promise<void> {
    if (state.initialSetupDone) {
      return;
    }
    state.initialSetupDone = true;

    if (this.scope === 'resource' && resourceId) {
      // RESOURCE SCOPE: Load only the current thread's historical messages.
      // Other threads' unobserved context is loaded fresh each step
      // to reflect the latest lastObservedAt cursors after observations.
      const currentThreadMessages = await this.loadUnobservedMessages(threadId, undefined, lastObservedAt);

      for (const msg of currentThreadMessages) {
        if (msg.role !== 'system') {
          if (!this.hasUnobservedParts(msg) && this.findLastCompletedObservationBoundary(msg) !== -1) {
            continue;
          }
          messageList.add(msg, 'memory');
        }
      }
    } else {
      // THREAD SCOPE: Load unobserved messages using resource-level lastObservedAt
      const historicalMessages = await this.loadUnobservedMessages(threadId, resourceId, lastObservedAt);

      if (historicalMessages.length > 0) {
        for (const msg of historicalMessages) {
          if (msg.role !== 'system') {
            if (!this.hasUnobservedParts(msg) && this.findLastCompletedObservationBoundary(msg) !== -1) {
              continue;
            }
            messageList.add(msg, 'memory');
          }
        }
      }
    }
  }

  /**
   * Calculate all threshold-related values for observation decision making.
   */
  private calculateObservationThresholds(
    _allMessages: MastraDBMessage[],
    unobservedMessages: MastraDBMessage[],
    pendingTokens: number,
    otherThreadTokens: number,
    currentObservationTokens: number,
    _record?: ObservationalMemoryRecord,
  ): {
    totalPendingTokens: number;
    threshold: number;
    effectiveObservationTokensThreshold: number;
    observationTokensPercent: number;
    isSharedBudget: boolean;
  } {
    // For threshold checking, we use UNOBSERVED messages only.
    // After activation, messages marked as observed (via lastObservedAt or observedMessageIds)
    // are excluded, so the threshold correctly reflects what still needs observation.
    const currentSessionTokens = this.tokenCounter.countMessages(unobservedMessages);

    // Total pending = unobserved in-context tokens + persisted pending + other threads
    const totalPendingTokens = Math.max(0, pendingTokens + currentSessionTokens + otherThreadTokens);

    const threshold = this.calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);

    // Calculate effective reflection threshold for UI display
    // When adaptive threshold is enabled, both thresholds share a budget
    const baseReflectionThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    const isSharedBudget = typeof this.observationConfig.messageTokens !== 'number';
    const totalBudget = isSharedBudget ? (this.observationConfig.messageTokens as { min: number; max: number }).max : 0;
    const effectiveObservationTokensThreshold = isSharedBudget
      ? Math.max(totalBudget - threshold, 1000)
      : baseReflectionThreshold;
    const observationTokensPercent = Math.round((currentObservationTokens / effectiveObservationTokensThreshold) * 100);

    return {
      totalPendingTokens,
      threshold,
      effectiveObservationTokensThreshold,
      observationTokensPercent,
      isSharedBudget,
    };
  }

  /**
   * Emit debug event and stream progress part for UI feedback.
   */
  private async emitStepProgress(
    writer: ProcessInputStepArgs['writer'],
    threadId: string,
    resourceId: string | undefined,
    stepNumber: number,
    record: ObservationalMemoryRecord,
    thresholds: {
      totalPendingTokens: number;
      threshold: number;
      effectiveObservationTokensThreshold: number;
      observationTokensPercent: number;
    },
    currentObservationTokens: number,
  ): Promise<void> {
    const { totalPendingTokens, threshold, effectiveObservationTokensThreshold, observationTokensPercent } = thresholds;

    this.emitDebugEvent({
      type: 'step_progress',
      timestamp: new Date(),
      threadId,
      resourceId: resourceId ?? '',
      stepNumber,
      finishReason: 'unknown',
      pendingTokens: totalPendingTokens,
      threshold,
      thresholdPercent: Math.round((totalPendingTokens / threshold) * 100),
      willSave: totalPendingTokens >= threshold,
      willObserve: totalPendingTokens >= threshold,
    });

    if (writer) {
      // Calculate buffered chunk totals for UI
      const bufferedChunks = this.getBufferedChunks(record);
      const bufferedMessageTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
      const bufferedObservationTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);

      const progressPart: DataOmProgressPart = {
        type: 'data-om-progress',
        data: {
          pendingTokens: totalPendingTokens,
          messageTokens: threshold,
          messageTokensPercent: Math.round((totalPendingTokens / threshold) * 100),
          observationTokens: currentObservationTokens,
          observationTokensThreshold: effectiveObservationTokensThreshold,
          observationTokensPercent: observationTokensPercent,
          willObserve: totalPendingTokens >= threshold,
          recordId: record.id,
          threadId,
          stepNumber,
          bufferedChunksCount: bufferedChunks.length,
          bufferedMessageTokens,
          bufferedObservationTokens,
          hasBufferedChunks: bufferedChunks.length > 0,
        },
      };
      await writer.custom(progressPart).catch(() => {
        // Ignore errors if stream is closed
      });
    }
  }

  /**
   * Handle observation when threshold is reached.
   * Tries async activation first if enabled, then falls back to sync observation.
   * Returns whether observation succeeded.
   */
  private async handleThresholdReached(
    messageList: MessageList,
    record: ObservationalMemoryRecord,
    threadId: string,
    resourceId: string | undefined,
    threshold: number,
    lockKey: string,
    writer: ProcessInputStepArgs['writer'],
    abortSignal: ProcessInputStepArgs['abortSignal'],
    abort: ProcessInputStepArgs['abort'],
  ): Promise<{ observationSucceeded: boolean; updatedRecord: ObservationalMemoryRecord }> {
    let observationSucceeded = false;
    let updatedRecord = record;

    await this.withLock(lockKey, async () => {
      let freshRecord = await this.getOrCreateRecord(threadId, resourceId);
      const freshAllMessages = messageList.get.all.db();
      let freshUnobservedMessages = this.getUnobservedMessages(freshAllMessages, freshRecord);

      // Re-check threshold inside the lock. Another thread sharing this resource
      // may have already observed, advancing lastObservedAt and reducing the
      // other-threads token count.
      const freshCurrentTokens = this.tokenCounter.countMessages(freshUnobservedMessages);
      const freshPending = freshRecord.pendingMessageTokens ?? 0;
      let freshOtherThreadTokens = 0;
      if (this.scope === 'resource' && resourceId) {
        const freshOtherContext = await this.loadOtherThreadsContext(resourceId, threadId);
        freshOtherThreadTokens = freshOtherContext ? this.tokenCounter.countString(freshOtherContext) : 0;
      }
      const freshTotal = freshPending + freshCurrentTokens + freshOtherThreadTokens;
      if (freshTotal < threshold) {
        return;
      }

      // Snapshot lastObservedAt BEFORE observation runs.
      const preObservationTime = freshRecord.lastObservedAt?.getTime() ?? 0;

      // Try to activate buffered observations first (instant activation)
      let activationResult: { success: boolean; updatedRecord?: ObservationalMemoryRecord } = { success: false };
      if (this.isAsyncObservationEnabled()) {
        // Wait for any in-flight async buffering to complete first
        const bufferKey = this.getObservationBufferKey(lockKey);
        const asyncOp = this.asyncBufferingOps.get(bufferKey);
        if (asyncOp) {
          try {
            // Wait for buffering to complete (with reasonable timeout)
            await Promise.race([
              asyncOp,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
            ]);
          } catch {
            // Timeout or error - proceed with what we have
          }
        }

        // Re-fetch record after waiting for async op
        const recordAfterWait = await this.getOrCreateRecord(threadId, resourceId);

        activationResult = await this.tryActivateBufferedObservations(recordAfterWait, lockKey, writer);
        if (activationResult.success) {
          // Activation succeeded - the buffered observations are now active.
          // Trust the activation and return success immediately.
          // The activated chunks have already been moved to activeObservations.
          observationSucceeded = true;
          updatedRecord = activationResult.updatedRecord ?? recordAfterWait;

          // Check if async reflection should be triggered or activated.
          // This only does async work (background buffering or instant activation) —
          // never blocking sync reflection that could overwrite freshly activated observations.
          await this.maybeAsyncReflect(updatedRecord, updatedRecord.observationTokenCount ?? 0, writer);
          return;
        }

        // When async observation is enabled, don't fall through to synchronous observation
        // unless blockAfter is set and we've exceeded it.
        if (this.observationConfig.blockAfter && freshTotal >= this.observationConfig.blockAfter) {
          // blockAfter exceeded — fall through to synchronous observation as a last resort.
          // Re-fetch unobserved messages since activation may have changed things.
          freshRecord = await this.getOrCreateRecord(threadId, resourceId);
          const refreshedAll = messageList.get.all.db();
          freshUnobservedMessages = this.getUnobservedMessages(refreshedAll, freshRecord);
        } else {
          // Below blockAfter (or no blockAfter set) — let async buffering catch up.
          return;
        }
      }

      if (freshUnobservedMessages.length > 0) {
        try {
          if (this.scope === 'resource' && resourceId) {
            await this.doResourceScopedObservation(
              freshRecord,
              threadId,
              resourceId,
              freshUnobservedMessages,
              writer,
              abortSignal,
            );
          } else {
            await this.doSynchronousObservation(freshRecord, threadId, freshUnobservedMessages, writer, abortSignal);
          }
          // Check if observation actually updated lastObservedAt
          updatedRecord = await this.getOrCreateRecord(threadId, resourceId);
          const updatedTime = updatedRecord.lastObservedAt?.getTime() ?? 0;
          observationSucceeded = updatedTime > preObservationTime;
        } catch (error) {
          if (abortSignal?.aborted) {
            abort('Agent execution was aborted');
          } else {
            abort(
              `Encountered error during memory observation ${error instanceof Error ? error.message : JSON.stringify(error, null, 2)}`,
            );
          }
          // abort() throws, so this line is only reached if abort doesn't throw
        }
      }
    });

    return { observationSucceeded, updatedRecord };
  }

  /**
   * Remove observed messages from message list after successful observation.
   * Accepts optional observedMessageIds for activation-based cleanup (when no markers are present).
   */
  private async cleanupAfterObservation(
    messageList: MessageList,
    sealedIds: Set<string>,
    threadId: string,
    resourceId: string | undefined,
    state: Record<string, unknown>,
    observedMessageIds?: string[],
  ): Promise<void> {
    const allMsgs = messageList.get.all.db();
    let markerIdx = -1;
    let markerMsg: MastraDBMessage | null = null;

    // Find the last observation end marker
    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (!msg) continue;
      if (this.findLastCompletedObservationBoundary(msg) !== -1) {
        markerIdx = i;
        markerMsg = msg;
        break;
      }
    }

    if (markerMsg && markerIdx !== -1) {
      // Collect all messages before the marker (these are fully observed)
      const idsToRemove: string[] = [];
      const messagesToSave: MastraDBMessage[] = [];

      for (let i = 0; i < markerIdx; i++) {
        const msg = allMsgs[i];
        if (msg?.id && msg.id !== 'om-continuation') {
          idsToRemove.push(msg.id);
          messagesToSave.push(msg);
        }
      }

      // Also include the marker message itself in the save
      messagesToSave.push(markerMsg);

      // Filter marker message to only unobserved parts
      const unobservedParts = this.getUnobservedParts(markerMsg);
      if (unobservedParts.length === 0) {
        // Marker message is fully observed — remove it too
        if (markerMsg.id) {
          idsToRemove.push(markerMsg.id);
        }
      } else if (unobservedParts.length < (markerMsg.content?.parts?.length ?? 0)) {
        // Trim marker message to only unobserved parts (in-place)
        markerMsg.content.parts = unobservedParts;
      }

      // Save all observed messages (with their markers) to DB
      if (messagesToSave.length > 0) {
        await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
      }

      // Remove observed messages from context
      if (idsToRemove.length > 0) {
        messageList.removeByIds(idsToRemove);
      }
    } else if (observedMessageIds && observedMessageIds.length > 0) {
      // Activation-based cleanup: DON'T remove messages mid-stream
      // When buffered observations are activated mid-turn, the assistant response
      // is still being streamed. We can't remove it from context because:
      // 1. The AI SDK still has a reference to it
      // 2. New tokens are being written to it
      //
      // Instead, we only save messages to DB (marking them as persisted).
      // The actual removal from context happens at step 0 of the NEXT turn
      // via filterAlreadyObservedMessages, which checks observedMessageIds.

      const observedSet = new Set(observedMessageIds);
      const messagesToSave: MastraDBMessage[] = [];

      for (const msg of allMsgs) {
        if (msg?.id && msg.id !== 'om-continuation' && observedSet.has(msg.id)) {
          messagesToSave.push(msg);
        }
      }

      // Save observed messages to DB (without markers, since this is activation-based)
      if (messagesToSave.length > 0) {
        await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
      }

      // Note: Messages are NOT removed from context here, and we do NOT clear
      // input/response tracking. The assistant is still streaming — new content
      // needs to remain tracked so processOutputResult can save it.
      return;
    } else {
      // No marker found — fall back to source-based clearing
      const newInput = messageList.clear.input.db();
      const newOutput = messageList.clear.response.db();
      const messagesToSave = [...newInput, ...newOutput];
      if (messagesToSave.length > 0) {
        await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
      }
    }

    // Clear any remaining input/response tracking
    // (only reached for marker-based and fallback paths, NOT activation path)
    messageList.clear.input.db();
    messageList.clear.response.db();
  }

  /**
   * Handle per-step save when threshold is not reached.
   * Persists messages incrementally to prevent data loss on interruption.
   */
  private async handlePerStepSave(
    messageList: MessageList,
    sealedIds: Set<string>,
    threadId: string,
    resourceId: string | undefined,
    state: Record<string, unknown>,
  ): Promise<void> {
    const newInput = messageList.clear.input.db();
    const newOutput = messageList.clear.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    if (messagesToSave.length > 0) {
      await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);

      // Re-add messages to context so the agent can still see them
      for (const msg of messagesToSave) {
        messageList.add(msg, 'memory');
      }
    }
  }

  /**
   * Inject observations as system message and add continuation reminder.
   */
  private async injectObservationsIntoContext(
    messageList: MessageList,
    record: ObservationalMemoryRecord,
    threadId: string,
    resourceId: string | undefined,
    unobservedContextBlocks: string | undefined,
    requestContext: ProcessInputStepArgs['requestContext'],
  ): Promise<void> {
    const thread = await this.storage.getThreadById({ threadId });
    const threadOMMetadata = getThreadOMMetadata(thread?.metadata);
    const currentTask = threadOMMetadata?.currentTask;
    const suggestedResponse = threadOMMetadata?.suggestedResponse;
    const rawCurrentDate = requestContext?.get('currentDate');
    const currentDate =
      rawCurrentDate instanceof Date
        ? rawCurrentDate
        : typeof rawCurrentDate === 'string'
          ? new Date(rawCurrentDate)
          : new Date();

    if (!record.activeObservations) {
      return;
    }

    const observationSystemMessage = this.formatObservationsForContext(
      record.activeObservations,
      currentTask,
      suggestedResponse,
      unobservedContextBlocks,
      currentDate,
    );

    // Clear any existing observation system message and add fresh one
    messageList.clearSystemMessages('observational-memory');
    messageList.addSystem(observationSystemMessage, 'observational-memory');

    // Add continuation reminder
    const continuationMessage: MastraDBMessage = {
      id: `om-continuation`,
      role: 'user',
      createdAt: new Date(0),
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: `<system-reminder>This message is not from the user, the conversation history grew too long and wouldn't fit in context! Thankfully the entire conversation is stored in your memory observations. Please continue from where the observations left off. Do not refer to your "memory observations" directly, the user doesn't know about them, they are your memories! Just respond naturally as if you're remembering the conversation (you are!). Do not say "Hi there!" or "based on our previous conversation" as if the conversation is just starting, this is not a new conversation. This is an ongoing conversation, keep continuity by responding based on your memory. For example do not say "I understand. I've reviewed my memory observations", or "I remember [...]". Answer naturally following the suggestion from your memory. Note that your memory may contain a suggested first response, which you should follow.

IMPORTANT: this system reminder is NOT from the user. The system placed it here as part of your memory system. This message is part of you remembering your conversation with the user.

NOTE: Any messages following this system reminder are newer than your memories.
</system-reminder>`,
          },
        ],
      },
      threadId,
      resourceId,
    };
    messageList.add(continuationMessage, 'memory');
  }

  /**
   * Filter out already-observed messages from message list (step 0 only).
   * Historical messages loaded from DB may contain observation markers from previous sessions.
   */
  private filterAlreadyObservedMessages(messageList: MessageList, record?: ObservationalMemoryRecord): void {
    const allMessages = messageList.get.all.db();

    // Find the message with the last observation end marker
    let markerMessageIndex = -1;
    let markerMessage: MastraDBMessage | null = null;

    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      if (!msg) continue;
      if (this.findLastCompletedObservationBoundary(msg) !== -1) {
        markerMessageIndex = i;
        markerMessage = msg;
        break;
      }
    }

    if (markerMessage && markerMessageIndex !== -1) {
      const messagesToRemove: string[] = [];
      for (let i = 0; i < markerMessageIndex; i++) {
        const msg = allMessages[i];
        if (msg?.id && msg.id !== 'om-continuation') {
          messagesToRemove.push(msg.id);
        }
      }

      if (messagesToRemove.length > 0) {
        messageList.removeByIds(messagesToRemove);
      }

      // Filter marker message to only unobserved parts
      const unobservedParts = this.getUnobservedParts(markerMessage);
      if (unobservedParts.length === 0) {
        if (markerMessage.id) {
          messageList.removeByIds([markerMessage.id]);
        }
      } else if (unobservedParts.length < (markerMessage.content?.parts?.length ?? 0)) {
        markerMessage.content.parts = unobservedParts;
      }
    } else if (record) {
      // No observation markers found (e.g., after buffered activation).
      // Fall back to record-based filtering: remove messages that are already
      // captured in observations (via lastObservedAt timestamp or observedMessageIds).
      // This prevents context overflow on session resume after buffered activation.
      const observedIds = new Set<string>(Array.isArray(record.observedMessageIds) ? record.observedMessageIds : []);
      // Also include message IDs from any remaining buffered chunks
      const bufferedChunks = this.getBufferedChunks(record);
      for (const chunk of bufferedChunks) {
        if (Array.isArray(chunk.messageIds)) {
          for (const id of chunk.messageIds) {
            observedIds.add(id);
          }
        }
      }

      const lastObservedAt = record.lastObservedAt;
      const messagesToRemove: string[] = [];

      for (const msg of allMessages) {
        if (!msg?.id || msg.id === 'om-continuation') continue;

        // Remove if explicitly tracked in observedMessageIds or buffered chunks
        if (observedIds.has(msg.id)) {
          messagesToRemove.push(msg.id);
          continue;
        }

        // Remove if created before lastObservedAt (these messages' content is
        // already captured in activeObservations via buffered activation)
        if (lastObservedAt && msg.createdAt) {
          const msgDate = new Date(msg.createdAt);
          if (msgDate <= lastObservedAt) {
            messagesToRemove.push(msg.id);
          }
        }
      }

      if (messagesToRemove.length > 0) {
        messageList.removeByIds(messagesToRemove);
      }
    }
  }

  /**
   * Process input at each step - check threshold, observe if needed, save, inject observations.
   * This is the ONLY processor method - all OM logic happens here.
   *
   * Flow:
   * 1. Load historical messages (step 0 only)
   * 2. Check if observation threshold is reached
   * 3. If threshold reached: observe, save messages with markers
   * 4. Inject observations into context
   * 5. Filter out already-observed messages
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, stepNumber, state: _state, writer, abortSignal, abort } = args;
    const state = _state ?? ({} as Record<string, unknown>);

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;
    const memoryContext = parseMemoryRequestContext(requestContext);
    const readOnly = memoryContext?.memoryConfig?.readOnly;

    // Fetch fresh record
    let record = await this.getOrCreateRecord(threadId, resourceId);
    omDebug(
      `[OM:step] processInputStep step=${stepNumber}: recordId=${record.id}, genCount=${record.generationCount}, obsTokens=${record.observationTokenCount}, bufferedReflection=${record.bufferedReflection ? 'present (' + record.bufferedReflection.length + ' chars)' : 'empty'}, activeObsLen=${record.activeObservations?.length}`,
    );

    // ════════════════════════════════════════════════════════════════════════
    // STEP 1: LOAD HISTORICAL MESSAGES (step 0 only)
    // ════════════════════════════════════════════════════════════════════════
    await this.loadHistoricalMessagesIfNeeded(messageList, state, threadId, resourceId, record.lastObservedAt);

    // ════════════════════════════════════════════════════════════════════════
    // STEP 1b: LOAD OTHER THREADS' UNOBSERVED CONTEXT (resource scope, every step)
    // ════════════════════════════════════════════════════════════════════════
    let unobservedContextBlocks: string | undefined;
    if (this.scope === 'resource' && resourceId) {
      unobservedContextBlocks = await this.loadOtherThreadsContext(resourceId, threadId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // STEP 1c: ACTIVATE BUFFERED OBSERVATIONS (step 0 only)
    // At the start of a new turn, check if there are buffered observations to activate.
    // This is cleaner than mid-stream activation because messages are complete.
    // ════════════════════════════════════════════════════════════════════════
    if (stepNumber === 0 && !readOnly && this.isAsyncObservationEnabled()) {
      const lockKey = this.getLockKey(threadId, resourceId);
      const bufferedChunks = this.getBufferedChunks(record);

      if (bufferedChunks.length > 0) {
        const activationResult = await this.tryActivateBufferedObservations(record, lockKey, writer);

        if (activationResult.success && activationResult.updatedRecord) {
          record = activationResult.updatedRecord;

          // Remove activated messages from context
          const observedSet = new Set(Array.isArray(record?.observedMessageIds) ? record.observedMessageIds : []);
          const allMsgs = messageList.get.all.db();
          const idsToRemove = allMsgs
            .filter(msg => msg?.id && msg.id !== 'om-continuation' && observedSet.has(msg.id))
            .map(msg => msg.id);

          if (idsToRemove.length > 0) {
            messageList.removeByIds(idsToRemove);
          }

          // Check if async reflection should be triggered or activated
          await this.maybeAsyncReflect(record, record.observationTokenCount ?? 0, writer);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // STEP 2: CHECK THRESHOLD AND OBSERVE IF NEEDED
    // ════════════════════════════════════════════════════════════════════════
    if (!readOnly) {
      const allMessages = messageList.get.all.db();
      const unobservedMessages = this.getUnobservedMessages(allMessages, record);
      const otherThreadTokens = unobservedContextBlocks ? this.tokenCounter.countString(unobservedContextBlocks) : 0;
      const currentObservationTokens = record.observationTokenCount ?? 0;
      const pendingTokens = record.pendingMessageTokens ?? 0;

      const thresholds = this.calculateObservationThresholds(
        allMessages,
        unobservedMessages,
        pendingTokens,
        otherThreadTokens,
        currentObservationTokens,
        record,
      );
      const { totalPendingTokens, threshold } = thresholds;

      // Emit progress for UI feedback
      await this.emitStepProgress(
        writer,
        threadId,
        resourceId,
        stepNumber,
        record,
        thresholds,
        currentObservationTokens,
      );

      const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();
      const lockKey = this.getLockKey(threadId, resourceId);

      // ════════════════════════════════════════════════════════════════════════
      // ASYNC BUFFERING: Trigger background observation at bufferEvery intervals
      // ════════════════════════════════════════════════════════════════════════

      if (this.isAsyncObservationEnabled() && totalPendingTokens < threshold) {
        const shouldTrigger = this.shouldTriggerAsyncObservation(totalPendingTokens, lockKey, record);
        if (shouldTrigger) {
          this.startAsyncBufferedObservation(record, threadId, unobservedMessages, lockKey, writer);
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // THRESHOLD REACHED: Observe and clean up
      // ════════════════════════════════════════════════════════════════════════
      if (stepNumber > 0 && totalPendingTokens >= threshold) {
        const { observationSucceeded, updatedRecord } = await this.handleThresholdReached(
          messageList,
          record,
          threadId,
          resourceId,
          threshold,
          lockKey,
          writer,
          abortSignal,
          abort,
        );

        if (observationSucceeded) {
          // Pass observedMessageIds from the updated record for activation-based cleanup
          const observedIds = Array.isArray(updatedRecord.observedMessageIds)
            ? updatedRecord.observedMessageIds
            : undefined;
          await this.cleanupAfterObservation(messageList, sealedIds, threadId, resourceId, state, observedIds);
        }

        record = updatedRecord;
      } else if (stepNumber > 0) {
        // ════════════════════════════════════════════════════════════════════════
        // PER-STEP SAVE: Persist messages incrementally when threshold not reached
        // ════════════════════════════════════════════════════════════════════════
        await this.handlePerStepSave(messageList, sealedIds, threadId, resourceId, state);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // STEP 3: INJECT OBSERVATIONS INTO CONTEXT
    // ════════════════════════════════════════════════════════════════════════
    await this.injectObservationsIntoContext(
      messageList,
      record,
      threadId,
      resourceId,
      unobservedContextBlocks,
      requestContext,
    );

    // ════════════════════════════════════════════════════════════════════════
    // STEP 4: FILTER OUT ALREADY-OBSERVED MESSAGES (step 0 only)
    // ════════════════════════════════════════════════════════════════════════
    if (stepNumber === 0) {
      this.filterAlreadyObservedMessages(messageList, record);
    }

    return messageList;
  }

  /**
   * Save any unsaved messages at the end of the agent turn.
   *
   * This is the "final save" that catches messages that processInputStep didn't save
   * (e.g., when the observation threshold was never reached, or on single-step execution).
   * Without this, messages would be lost because MessageHistory is disabled when OM is active.
   */
  async processOutputResult(args: ProcessOutputResultArgs): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, state: _state } = args;
    // Default state to {} for backward compat with older @mastra/core that doesn't pass state
    const state = _state ?? ({} as Record<string, unknown>);

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      return messageList;
    }

    const { threadId, resourceId } = context;

    // Check if readOnly
    const memoryContext = parseMemoryRequestContext(requestContext);
    const readOnly = memoryContext?.memoryConfig?.readOnly;
    if (readOnly) {
      return messageList;
    }

    // Final save: persist any messages that weren't saved during per-step saves
    // (e.g., the final assistant response after the last processInputStep)
    const newInput = messageList.get.input.db();
    const newOutput = messageList.get.response.db();
    const messagesToSave = [...newInput, ...newOutput];

    if (messagesToSave.length === 0) {
      return messageList;
    }

    const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();

    await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);

    return messageList;
  }

  /**
   * Save messages to storage, regenerating IDs for any messages that were
   * previously saved with observation markers (sealed).
   *
   * After saving, tracks which messages now have observation markers
   * so their IDs won't be reused in future save cycles.
   */
  private async saveMessagesWithSealedIdTracking(
    messagesToSave: MastraDBMessage[],
    sealedIds: Set<string>,
    threadId: string,
    resourceId: string | undefined,
    state: Record<string, unknown>,
  ): Promise<void> {
    // Regenerate IDs for messages that were already saved with observation markers
    // This prevents overwriting sealed messages in the DB
    for (const msg of messagesToSave) {
      if (sealedIds.has(msg.id)) {
        msg.id = crypto.randomUUID();
      }
    }

    await this.messageHistory.persistMessages({
      messages: messagesToSave,
      threadId,
      resourceId,
    });

    // After successful save, track IDs of messages that now have observation markers (sealed)
    // These IDs cannot be reused in future cycles
    for (const msg of messagesToSave) {
      if (this.findLastCompletedObservationBoundary(msg) !== -1) {
        sealedIds.add(msg.id);
      }
    }
    state.sealedIds = sealedIds;
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

    let result: { messages: MastraDBMessage[] };

    if (this.scope === 'resource' && resourceId) {
      // Resource scope: use the new listMessagesByResourceId method
      result = await this.storage.listMessagesByResourceId({
        resourceId,
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
    } else {
      // Thread scope: use listMessages with threadId
      result = await this.storage.listMessages({
        threadId,
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
    }

    return result.messages;
  }

  /**
   * Load unobserved messages from other threads (not the current thread) for a resource.
   * Called fresh each step so it reflects the latest lastObservedAt cursors
   * after observations complete.
   */
  private async loadOtherThreadsContext(resourceId: string, currentThreadId: string): Promise<string | undefined> {
    const { threads: allThreads } = await this.storage.listThreads({ filter: { resourceId } });

    const messagesByThread = new Map<string, MastraDBMessage[]>();

    for (const thread of allThreads) {
      // Skip current thread — its messages are already in messageList
      if (thread.id === currentThreadId) continue;

      const omMetadata = getThreadOMMetadata(thread.metadata);
      const threadLastObservedAt = omMetadata?.lastObservedAt;
      const startDate = threadLastObservedAt ? new Date(new Date(threadLastObservedAt).getTime() + 1) : undefined;

      const result = await this.storage.listMessages({
        threadId: thread.id,
        perPage: false,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        filter: startDate ? { dateRange: { start: startDate } } : undefined,
      });

      // Filter out messages already observed in this instance's lifetime
      const filtered = result.messages.filter(m => !this.observedMessageIds.has(m.id));

      if (filtered.length > 0) {
        messagesByThread.set(thread.id, filtered);
      }
    }

    if (messagesByThread.size === 0) return undefined;

    const blocks = await this.formatUnobservedContextBlocks(messagesByThread, currentThreadId);
    return blocks || undefined;
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

      // Format messages with timestamps, truncating large parts (e.g. tool results)
      // since this is injected as context for the actor, not sent to the observer
      const formattedMessages = formatMessagesForObserver(messages, { maxPartLength: 500 });

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
   * Do synchronous observation (fallback when no buffering)
   */
  private async doSynchronousObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
    writer?: ProcessorStreamWriter,
    abortSignal?: AbortSignal,
  ): Promise<void> {
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

    // Generate unique cycle ID for this observation cycle
    // This ties together the start/end/failed markers
    const cycleId = crypto.randomUUID();

    // Insert START marker before observation
    const tokensToObserve = this.tokenCounter.countMessages(unobservedMessages);
    const lastMessage = unobservedMessages[unobservedMessages.length - 1];
    const startedAt = new Date().toISOString();

    if (lastMessage?.id) {
      const startMarker = this.createObservationStartMarker({
        cycleId,
        operationType: 'observation',
        tokensToObserve,
        recordId: record.id,
        threadId,
        threadIds: [threadId],
      });
      // Stream the start marker to the UI first - this adds the part via stream handler
      if (writer) {
        await writer.custom(startMarker).catch(() => {
          // Ignore errors from streaming - observation should continue
        });
      }

      // Then add to message (skipPush since writer.custom already added the part)
    }

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          return;
        }
      }

      const result = await this.callObserver(
        freshRecord?.activeObservations ?? record.activeObservations,
        unobservedMessages,
        abortSignal,
      );

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

      let totalTokenCount = this.tokenCounter.countObservations(newObservations);

      // Calculate tokens generated in THIS cycle only (for UI marker)
      const cycleObservationTokens = this.tokenCounter.countObservations(result.observations);

      // Use the max message timestamp as cursor instead of current time
      // This ensures historical data (like LongMemEval fixtures) works correctly
      const lastObservedAt = this.getMaxMessageTimestamp(unobservedMessages);

      // Collect message IDs being observed for the safeguard
      // Merge with existing IDs, filter to only keep IDs newer than lastObservedAt
      const newMessageIds = unobservedMessages.map(m => m.id);
      const existingIds = freshRecord?.observedMessageIds ?? record.observedMessageIds ?? [];
      const allObservedIds = [...new Set([...(Array.isArray(existingIds) ? existingIds : []), ...newMessageIds])];

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        observedMessageIds: allObservedIds,
      });

      // Save thread-specific metadata (currentTask, suggestedResponse only)
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

      // ════════════════════════════════════════════════════════════════════════
      // INSERT END MARKER after successful observation
      // This marks the boundary between observed and unobserved parts
      // ════════════════════════════════════════════════════════════════════════
      if (lastMessage?.id) {
        const endMarker = this.createObservationEndMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensObserved: tokensToObserve,
          observationTokens: cycleObservationTokens,
          observations: result.observations,
          currentTask: result.currentTask,
          suggestedResponse: result.suggestedContinuation,
          recordId: record.id,
          threadId,
        });

        // Stream the end marker to the UI first - this adds the part via stream handler
        if (writer) {
          await writer.custom(endMarker).catch(() => {
            // Ignore errors from streaming - observation should continue
          });
        }

        // Then seal the message (skipPush since writer.custom already added the part)
      }

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

      // Check for reflection
      await this.maybeReflect(
        { ...record, activeObservations: newObservations },
        totalTokenCount,
        threadId,
        writer,
        abortSignal,
      );
    } catch (error) {
      // Insert FAILED marker on error
      if (lastMessage?.id) {
        const failedMarker = this.createObservationFailedMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensAttempted: tokensToObserve,
          error: error instanceof Error ? error.message : String(error),
          recordId: record.id,
          threadId,
        });

        // Stream the failed marker to the UI first - this adds the part via stream handler
        if (writer) {
          await writer.custom(failedMarker).catch(() => {
            // Ignore errors from streaming - observation should continue
          });
        }

        // Then seal the message (skipPush since writer.custom already added the part)
      }
      // If aborted, re-throw so the main agent loop can handle cancellation
      if (abortSignal?.aborted) {
        throw error;
      }
      // Log the error but don't re-throw - observation failure should not crash the agent
      console.error(`[OM] Observation failed:`, error instanceof Error ? error.message : String(error));
    } finally {
      await this.storage.setObservingFlag(record.id, false);
    }
  }

  /**
   * Start an async background observation that stores results to bufferedObservations.
   * This is a fire-and-forget operation that runs in the background.
   * The results will be swapped to active when the main threshold is reached.
   *
   * If another buffering operation is already in progress for this scope, this will
   * wait for it to complete before starting a new one (mutex behavior).
   *
   * @param record - Current OM record
   * @param threadId - Thread ID
   * @param unobservedMessages - All unobserved messages (will be filtered for already-buffered)
   * @param lockKey - Lock key for this scope
   * @param writer - Optional stream writer for emitting buffering markers
   */
  private startAsyncBufferedObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
    lockKey: string,
    writer?: ProcessorStreamWriter,
  ): void {
    const bufferKey = this.getObservationBufferKey(lockKey);

    // Update the last buffered boundary (in-memory for current instance)
    const currentTokens = this.tokenCounter.countMessages(unobservedMessages) + (record.pendingMessageTokens ?? 0);
    this.lastBufferedBoundary.set(bufferKey, currentTokens);

    // Set persistent flag so new instances (created per request) know buffering is in progress
    this.storage.setBufferingObservationFlag(record.id, true, currentTokens).catch(err => {
      console.error(`[OM] Failed to set buffering observation flag:`, err instanceof Error ? err.message : String(err));
    });

    // Start the async operation - waits for any existing op to complete first
    const asyncOp = this.runAsyncBufferedObservation(record, threadId, unobservedMessages, bufferKey, writer).finally(
      () => {
        // Clean up the operation tracking
        this.asyncBufferingOps.delete(bufferKey);
        // Clear persistent flag
        this.storage.setBufferingObservationFlag(record.id, false).catch(err => {
          console.error(
            `[OM] Failed to clear buffering observation flag:`,
            err instanceof Error ? err.message : String(err),
          );
        });
      },
    );

    this.asyncBufferingOps.set(bufferKey, asyncOp);
  }

  /**
   * Internal method that waits for existing buffering operation and then runs new buffering.
   * This implements the mutex-wait behavior.
   */
  private async runAsyncBufferedObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    unobservedMessages: MastraDBMessage[],
    bufferKey: string,
    writer?: ProcessorStreamWriter,
  ): Promise<void> {
    // Wait for any existing buffering operation to complete first (mutex behavior)
    const existingOp = this.asyncBufferingOps.get(bufferKey);
    if (existingOp) {
      try {
        await existingOp;
      } catch {
        // Previous op failed, continue with new one
      }
    }

    // Re-fetch record to get latest state after waiting
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    if (!freshRecord) {
      return;
    }

    // Re-calculate unobserved messages using fresh record state
    // This is critical because getUnobservedMessages now considers buffered chunk messageIds,
    // so after waiting for a previous buffering op, some messages may already be buffered
    const freshUnobservedMessages = this.getUnobservedMessages(unobservedMessages, freshRecord);

    // Check if there's enough content to buffer
    const bufferEvery = this.observationConfig.bufferEvery ?? 5000;
    const minNewTokens = bufferEvery / 2;
    const newTokens = this.tokenCounter.countMessages(freshUnobservedMessages);

    if (newTokens < minNewTokens) {
      return; // Not enough new content to buffer
    }

    // Use the fresh unobserved messages (excludes already-buffered ones)
    const messagesToBuffer = freshUnobservedMessages;

    // Seal the messages being buffered to prevent new parts from being added.
    // This ensures that any streaming content after this point goes to new messages,
    // preserving the boundary of what we're buffering.
    this.sealMessagesForBuffering(messagesToBuffer);

    // CRITICAL: Persist the sealed messages to storage immediately.
    // This ensures that:
    // 1. The seal metadata (sealedAt on last part) is saved to the database
    // 2. When MessageList creates new messages for streaming content after the seal,
    //    those new messages have their own IDs and don't overwrite the sealed messages
    // 3. The sealed messages remain intact with their content at the time of buffering
    await this.messageHistory.persistMessages({
      messages: messagesToBuffer,
      threadId,
      resourceId: freshRecord.resourceId ?? undefined,
    });

    // Generate cycle ID and capture start time
    const cycleId = `buffer-obs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const startedAt = new Date().toISOString();
    const tokensToBuffer = this.tokenCounter.countMessages(messagesToBuffer);

    // Emit buffering start marker
    if (writer) {
      const startMarker = this.createBufferingStartMarker({
        cycleId,
        operationType: 'observation',
        tokensToBuffer,
        recordId: freshRecord.id,
        threadId,
        threadIds: [threadId],
      });
      void writer.custom(startMarker).catch(() => {});
    }

    try {
      await this.doAsyncBufferedObservation(freshRecord, threadId, messagesToBuffer, cycleId, startedAt, writer);
    } catch (error) {
      // Emit buffering failed marker
      if (writer) {
        const failedMarker = this.createBufferingFailedMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensAttempted: tokensToBuffer,
          error: error instanceof Error ? error.message : String(error),
          recordId: freshRecord.id,
          threadId,
        });
        void writer.custom(failedMarker).catch(() => {});
      }
      console.error(`[OM] Async buffered observation failed:`, error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Perform async buffered observation - observes messages and stores to bufferedObservations.
   * Does NOT update activeObservations or trigger reflection.
   *
   * The observer sees: active observations + existing buffered observations + message history
   * (excluding already-buffered messages).
   */
  private async doAsyncBufferedObservation(
    record: ObservationalMemoryRecord,
    threadId: string,
    messagesToBuffer: MastraDBMessage[],
    cycleId: string,
    startedAt: string,
    writer?: ProcessorStreamWriter,
  ): Promise<void> {
    // Build combined context for the observer: active + buffered chunk observations
    const bufferedChunks = this.getBufferedChunks(record);
    const bufferedChunksText = bufferedChunks.map(c => c.observations).join('\n\n');
    const combinedObservations = this.combineObservationsForBuffering(record.activeObservations, bufferedChunksText);

    // Call observer with combined context (skip continuation hints for async buffering)
    const result = await this.callObserver(
      combinedObservations,
      messagesToBuffer,
      undefined, // No abort signal for background ops
      { skipContinuationHints: true },
    );

    // Get the new observations to buffer (just the new content, not merged)
    // The storage adapter will handle appending to existing buffered content
    let newObservations: string;
    if (this.scope === 'resource') {
      newObservations = await this.wrapWithThreadTag(threadId, result.observations);
    } else {
      newObservations = result.observations;
    }

    const newTokenCount = this.tokenCounter.countObservations(newObservations);

    // Just pass the new message IDs - storage adapter will merge with existing
    const newMessageIds = messagesToBuffer.map(m => m.id);
    const messageTokens = this.tokenCounter.countMessages(messagesToBuffer);

    // lastObservedAt should be the timestamp of the latest message being buffered (+1ms for exclusive)
    // This ensures new messages created after buffering are still considered unobserved
    const maxMessageTimestamp = this.getMaxMessageTimestamp(messagesToBuffer);
    const lastObservedAt = new Date(maxMessageTimestamp.getTime() + 1);

    // Store as a new buffered chunk (storage adapter appends to existing chunks)
    await this.storage.updateBufferedObservations({
      id: record.id,
      chunk: {
        cycleId,
        observations: newObservations,
        tokenCount: newTokenCount,
        messageIds: newMessageIds,
        messageTokens,
        lastObservedAt,
      },
    });

    // Emit buffering end marker
    if (writer) {
      const tokensBuffered = this.tokenCounter.countMessages(messagesToBuffer);
      // Re-fetch record to get total buffered tokens after storage update
      const updatedRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
      const updatedChunks = this.getBufferedChunks(updatedRecord);
      const totalBufferedTokens = updatedChunks.reduce((sum, c) => sum + (c.tokenCount ?? 0), 0) || newTokenCount;
      const endMarker = this.createBufferingEndMarker({
        cycleId,
        operationType: 'observation',
        startedAt,
        tokensBuffered,
        bufferedTokens: totalBufferedTokens,
        recordId: record.id,
        threadId,
        observations: newObservations,
      });
      void writer.custom(endMarker).catch(() => {});
    }
  }

  /**
   * Combine active and buffered observations for the buffering observer context.
   * The buffering observer needs to see both so it doesn't duplicate content.
   */
  private combineObservationsForBuffering(
    activeObservations: string | undefined,
    bufferedObservations: string | undefined,
  ): string | undefined {
    if (!activeObservations && !bufferedObservations) {
      return undefined;
    }
    if (!activeObservations) {
      return bufferedObservations;
    }
    if (!bufferedObservations) {
      return activeObservations;
    }
    // Both exist - combine them with a clear separator
    return `${activeObservations}\n\n--- BUFFERED (pending activation) ---\n\n${bufferedObservations}`;
  }

  /**
   * Try to activate buffered observations when threshold is reached.
   * Returns true if activation succeeded, false if no buffered content or activation failed.
   *
   * @param record - Current OM record
   * @param lockKey - Lock key for this scope
   * @param writer - Optional writer for emitting UI markers
   */
  private async tryActivateBufferedObservations(
    record: ObservationalMemoryRecord,
    lockKey: string,
    writer?: ProcessInputStepArgs['writer'],
  ): Promise<{ success: boolean; updatedRecord?: ObservationalMemoryRecord }> {
    // Check if there's buffered content to activate
    const chunks = this.getBufferedChunks(record);
    if (!chunks.length) {
      return { success: false };
    }

    const bufferKey = this.getObservationBufferKey(lockKey);

    // Wait for any in-progress async buffering to complete (with timeout)
    // Use 60s timeout - buffering can take a while for large message batches
    const asyncOp = this.asyncBufferingOps.get(bufferKey);
    if (asyncOp) {
      try {
        await Promise.race([
          asyncOp,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60_000)),
        ]);
      } catch {
        // Timeout or error - proceed with what we have
      }
    }

    // Re-fetch record to get latest buffered content
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    if (!freshRecord) {
      return { success: false };
    }
    const freshChunks = this.getBufferedChunks(freshRecord);
    if (!freshChunks.length) {
      return { success: false };
    }

    // Perform partial swap with asyncActivation percentage
    const activationRatio = this.observationConfig.asyncActivation ?? 0.7;
    const activationResult = await this.storage.swapBufferedToActive({
      id: freshRecord.id,
      activationRatio,
    });

    // Reset lastBufferedBoundary so new buffering can start fresh after activation
    this.lastBufferedBoundary.delete(bufferKey);
    // Reset persistent lastBufferedAtTokens to 0 so interval tracking restarts
    await this.storage.setBufferingObservationFlag(freshRecord.id, false, 0);

    // Fetch updated record
    const updatedRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    // Emit activation markers for UI feedback - one per activated cycleId
    // This allows the UI to link each activation back to its original buffering badge
    if (writer && updatedRecord && activationResult.activatedCycleIds.length > 0) {
      for (const cycleId of activationResult.activatedCycleIds) {
        const activationMarker = this.createActivationMarker({
          cycleId, // Use the original buffering cycleId so UI can link them
          operationType: 'observation',
          chunksActivated: activationResult.chunksActivated,
          tokensActivated: activationResult.messageTokensActivated,
          observationTokens: activationResult.observationTokensActivated,
          messagesActivated: activationResult.messagesActivated,
          recordId: updatedRecord.id,
          threadId: updatedRecord.threadId ?? record.threadId ?? '',
          observations: activationResult.observations,
        });
        void writer.custom(activationMarker).catch(() => {});
      }
    }

    return { success: true, updatedRecord: updatedRecord ?? undefined };
  }

  /**
   * Start an async background reflection that stores results to bufferedReflection.
   * This is a fire-and-forget operation that runs in the background.
   * The results will be swapped to active when the main reflection threshold is reached.
   *
   * @param record - Current OM record
   * @param observationTokens - Current observation token count
   * @param lockKey - Lock key for this scope
   */
  private startAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    lockKey: string,
    writer?: ProcessorStreamWriter,
  ): void {
    const bufferKey = this.getReflectionBufferKey(lockKey);

    // Don't start if already in progress
    if (this.isAsyncBufferingInProgress(bufferKey)) {
      return;
    }

    // Update the last buffered boundary (in-memory for current instance)
    this.lastBufferedBoundary.set(bufferKey, observationTokens);

    // Set persistent flag so new instances know buffering is in progress
    this.storage.setBufferingReflectionFlag(record.id, true).catch(err => {
      console.error(`[OM] Failed to set buffering reflection flag:`, err instanceof Error ? err.message : String(err));
    });

    // Start the async operation
    const asyncOp = this.doAsyncBufferedReflection(record, bufferKey, writer)
      .catch(error => {
        // Emit buffering failed marker
        if (writer) {
          const failedMarker = this.createBufferingFailedMarker({
            cycleId: `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            operationType: 'reflection',
            startedAt: new Date().toISOString(),
            tokensAttempted: observationTokens,
            error: error instanceof Error ? error.message : String(error),
            recordId: record.id,
            threadId: record.threadId ?? '',
          });
          void writer.custom(failedMarker).catch(() => {});
        }
        // Log but don't crash - async buffering failure is recoverable
        console.error(`[OM] Async buffered reflection failed:`, error instanceof Error ? error.stack : String(error));
      })
      .finally(() => {
        // Clean up the operation tracking
        this.asyncBufferingOps.delete(bufferKey);
        // Clear persistent flag
        this.storage.setBufferingReflectionFlag(record.id, false).catch(err => {
          console.error(
            `[OM] Failed to clear buffering reflection flag:`,
            err instanceof Error ? err.message : String(err),
          );
        });
      });

    this.asyncBufferingOps.set(bufferKey, asyncOp);
  }

  /**
   * Perform async buffered reflection - reflects observations and stores to bufferedReflection.
   * Does NOT create a new generation or update activeObservations.
   */
  private async doAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    _bufferKey: string,
    writer?: ProcessorStreamWriter,
  ): Promise<void> {
    const fullReflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    // Use asyncActivation * threshold as the compression target.
    // At ~50% of threshold, observations are already below the full threshold,
    // so we need a tighter target to ensure actual compression happens.
    const asyncActivation = this.reflectionConfig.asyncActivation ?? 1;
    const compressionTarget = Math.ceil(fullReflectThreshold * asyncActivation);
    const startedAt = new Date().toISOString();
    const cycleId = `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const observationTokens = record.observationTokenCount ?? 0;

    // Store cycleId so tryActivateBufferedReflection can use it for UI markers
    this.reflectionBufferCycleIds.set(_bufferKey, cycleId);

    // Emit buffering start marker
    if (writer) {
      const startMarker = this.createBufferingStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToBuffer: observationTokens,
        recordId: record.id,
        threadId: record.threadId ?? '',
        threadIds: record.threadId ? [record.threadId] : [],
      });
      void writer.custom(startMarker).catch(() => {});
    }

    // Record the line count of activeObservations at the time of reflection.
    // At activation time, lines 0..lineCount are replaced by the reflection,
    // and any lines added after are appended as unreflected observations.
    const activeObservations = record.activeObservations ?? '';
    const reflectedObservationLineCount = activeObservations.split('\n').length;

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: starting reflector call, recordId=${record.id}, observationTokens=${observationTokens}, compressionTarget=${compressionTarget} (${asyncActivation} * ${fullReflectThreshold}), activeObsLength=${activeObservations.length}, reflectedLineCount=${reflectedObservationLineCount}`,
    );

    // Call reflector with the tighter compression target (asyncActivation * threshold)
    const reflectResult = await this.callReflector(
      activeObservations,
      undefined, // No manual prompt
      undefined, // No stream context for background ops
      compressionTarget,
      undefined, // No abort signal for background ops
      true, // Skip continuation hints for async buffering
    );

    const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: reflector returned ${reflectionTokenCount} tokens (${reflectResult.observations?.length} chars), saving to recordId=${record.id}`,
    );

    // Store to bufferedReflection along with the line boundary
    await this.storage.updateBufferedReflection({
      id: record.id,
      reflection: reflectResult.observations,
      tokenCount: reflectionTokenCount,
      reflectedObservationLineCount,
    });
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: bufferedReflection saved with lineCount=${reflectedObservationLineCount}`,
    );

    // Emit buffering end marker
    if (writer) {
      const endMarker = this.createBufferingEndMarker({
        cycleId,
        operationType: 'reflection',
        startedAt,
        tokensBuffered: observationTokens,
        bufferedTokens: reflectionTokenCount,
        recordId: record.id,
        threadId: record.threadId ?? '',
        observations: reflectResult.observations,
      });
      void writer.custom(endMarker).catch(() => {});
    }
  }

  /**
   * Try to activate buffered reflection when threshold is reached.
   * Returns true if activation succeeded, false if no buffered content or activation failed.
   *
   * @param record - Current OM record
   * @param lockKey - Lock key for this scope
   */
  private async tryActivateBufferedReflection(
    record: ObservationalMemoryRecord,
    lockKey: string,
    writer?: ProcessorStreamWriter,
  ): Promise<boolean> {
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: recordId=${record.id}, hasBufferedReflection=${!!record.bufferedReflection}, bufferedReflectionLen=${record.bufferedReflection?.length ?? 0}`,
    );

    // Check if there's buffered content to activate
    if (!record.bufferedReflection) {
      omDebug(`[OM:reflect] tryActivateBufferedReflection: no buffered reflection, returning false`);
      return false;
    }

    const bufferKey = this.getReflectionBufferKey(lockKey);

    // Wait for any in-progress async reflection buffering to complete (with timeout)
    // Use 60s timeout - reflection can take a while for large observation batches
    const asyncOp = this.asyncBufferingOps.get(bufferKey);
    if (asyncOp) {
      omDebug(`[OM:reflect] tryActivateBufferedReflection: waiting for in-progress op...`);
      try {
        await Promise.race([
          asyncOp,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60_000)),
        ]);
      } catch {
        // Timeout or error - proceed with what we have
      }
    }

    // Re-fetch record to get latest buffered content
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: freshRecord.id=${freshRecord?.id}, freshBufferedReflection=${freshRecord?.bufferedReflection ? 'present (' + freshRecord.bufferedReflection.length + ' chars)' : 'empty'}, freshObsTokens=${freshRecord?.observationTokenCount}`,
    );

    if (!freshRecord?.bufferedReflection) {
      omDebug(`[OM:reflect] tryActivateBufferedReflection: no buffered reflection after re-fetch, returning false`);
      return false;
    }

    const beforeTokens = freshRecord.observationTokenCount ?? 0;

    // Compute the combined token count for the new activeObservations.
    // Replicate the merge logic: bufferedReflection + unreflected lines after the boundary.
    const reflectedLineCount = freshRecord.reflectedObservationLineCount ?? 0;
    const currentObservations = freshRecord.activeObservations ?? '';
    const allLines = currentObservations.split('\n');
    const unreflectedLines = allLines.slice(reflectedLineCount);
    const unreflectedContent = unreflectedLines.join('\n').trim();
    const combinedObservations = unreflectedContent
      ? `${freshRecord.bufferedReflection}\n\n${unreflectedContent}`
      : freshRecord.bufferedReflection!;
    const combinedTokenCount = this.tokenCounter.countObservations(combinedObservations);

    // Swap buffered reflection to active. The storage adapter uses the stored
    // reflectedObservationLineCount to split: reflected lines → replaced by bufferedReflection,
    // unreflected lines (added after reflection) → appended as-is.
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activating, beforeTokens=${beforeTokens}, combinedTokenCount=${combinedTokenCount}, reflectedLineCount=${reflectedLineCount}, unreflectedLines=${unreflectedLines.length}`,
    );
    await this.storage.swapBufferedReflectionToActive({
      currentRecord: freshRecord,
      tokenCount: combinedTokenCount,
    });

    // Reset lastBufferedBoundary so new reflection buffering can start fresh
    this.lastBufferedBoundary.delete(bufferKey);

    // Emit activation marker using the original buffering cycleId so the UI can match it
    const afterRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const afterTokens = afterRecord?.observationTokenCount ?? 0;
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activation complete! beforeTokens=${beforeTokens}, afterTokens=${afterTokens}, newRecordId=${afterRecord?.id}, newGenCount=${afterRecord?.generationCount}`,
    );

    if (writer) {
      const originalCycleId = this.reflectionBufferCycleIds.get(bufferKey);
      const activationMarker = this.createActivationMarker({
        cycleId: originalCycleId ?? `reflect-act-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: beforeTokens,
        observationTokens: afterTokens,
        messagesActivated: 0,
        recordId: freshRecord.id,
        threadId: freshRecord.threadId ?? '',
        observations: afterRecord?.activeObservations,
      });
      void writer.custom(activationMarker).catch(() => {});
    }

    // Clean up the stored cycleId
    this.reflectionBufferCycleIds.delete(bufferKey);

    return true;
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
    writer?: ProcessorStreamWriter,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    // Clear debug entries at start of observation cycle

    // ════════════════════════════════════════════════════════════
    // PER-THREAD CURSORS: Load unobserved messages for each thread using its own lastObservedAt
    // This prevents message loss when threads have different observation progress
    // ════════════════════════════════════════════════════════════

    // First, get all threads for this resource to access their per-thread lastObservedAt
    const { threads: allThreads } = await this.storage.listThreads({ filter: { resourceId } });
    const threadMetadataMap = new Map<string, { lastObservedAt?: string }>();

    for (const thread of allThreads) {
      const omMetadata = getThreadOMMetadata(thread.metadata);
      threadMetadataMap.set(thread.id, { lastObservedAt: omMetadata?.lastObservedAt });
    }

    // Load messages per-thread using each thread's own cursor
    const messagesByThread = new Map<string, MastraDBMessage[]>();

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

    // Filter out messages already observed in this instance's lifetime.
    // This can happen when doResourceScopedObservation re-queries the DB using per-thread
    // lastObservedAt cursors that haven't fully advanced past messages observed in a prior cycle.
    for (const [tid, msgs] of messagesByThread) {
      const filtered = msgs.filter(m => !this.observedMessageIds.has(m.id));
      if (filtered.length > 0) {
        messagesByThread.set(tid, filtered);
      } else {
        messagesByThread.delete(tid);
      }
    }
    // Count total messages
    let totalMessages = 0;
    for (const msgs of messagesByThread.values()) {
      totalMessages += msgs.length;
    }

    if (totalMessages === 0) {
      return;
    }

    // ════════════════════════════════════════════════════════════
    // THREAD SELECTION: Pick which threads to observe based on token threshold
    // - Sort by largest threads first (most messages = most value per Observer call)
    // - Accumulate until we hit the threshold
    // - This prevents making many small Observer calls for 1-message threads
    // ════════════════════════════════════════════════════════════
    const threshold = this.getMaxThreshold(this.observationConfig.messageTokens);

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
        break;
      }

      threadsToObserve.push(threadId);
      accumulatedTokens += threadTokens;
    }

    if (threadsToObserve.length === 0) {
      return;
    }

    // Now sort the selected threads by oldest message for consistent observation order
    const threadOrder = this.sortThreadsByOldestMessage(
      new Map(threadsToObserve.map(tid => [tid, messagesByThread.get(tid) ?? []])),
    );

    // Debug: Log message counts per thread and date ranges

    // ════════════════════════════════════════════════════════════
    // LOCKING: Acquire lock and re-check
    // Another request may have already observed while we were loading messages
    // ════════════════════════════════════════════════════════════
    await this.storage.setObservingFlag(record.id, true);

    // Generate unique cycle ID for this observation cycle
    // This ties together the start/end/failed markers across all threads
    const cycleId = crypto.randomUUID();

    // Declare variables outside try block so they're accessible in catch
    const threadsWithMessages = new Map<string, MastraDBMessage[]>();
    const threadTokensToObserve = new Map<string, number>();
    let observationStartedAt = '';

    try {
      // Re-check: reload record to see if another request already observed
      const freshRecord = await this.storage.getObservationalMemory(null, resourceId);
      if (freshRecord && freshRecord.lastObservedAt && record.lastObservedAt) {
        if (freshRecord.lastObservedAt > record.lastObservedAt) {
          return;
        }
      }

      const existingObservations = freshRecord?.activeObservations ?? record.activeObservations ?? '';

      // ═════════════════════════════════════════���══════════════════
      // BATCHED MULTI-THREAD OBSERVATION: Single Observer call for all threads
      // This is much more efficient than calling the Observer for each thread individually
      // ════════════════════════════════════════════════════════════

      // Filter to only threads with messages
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

      // ════════════════════════════════════════════════════════════════════════
      // INSERT START MARKERS before observation
      // Each thread gets its own start marker in its last message
      // ════════════════════════════════════════════════════════════════════════
      observationStartedAt = new Date().toISOString();
      const allThreadIds = Array.from(threadsWithMessages.keys());

      for (const [threadId, msgs] of threadsWithMessages) {
        const lastMessage = msgs[msgs.length - 1];
        const tokensToObserve = this.tokenCounter.countMessages(msgs);
        threadTokensToObserve.set(threadId, tokensToObserve);

        if (lastMessage?.id) {
          const startMarker = this.createObservationStartMarker({
            cycleId,
            operationType: 'observation',
            tokensToObserve,
            recordId: record.id,
            threadId,
            threadIds: allThreadIds,
          });
          // Stream the start marker to the UI first - this adds the part via stream handler
          if (writer) {
            await writer.custom(startMarker).catch(() => {
              // Ignore errors from streaming - observation should continue
            });
          }

          // Then add to message (skipPush since writer.custom already added the part)
        }
      }

      // ════════════════════════════════════════════════════════════
      // PARALLEL BATCHING: Chunk threads into batches and process in parallel
      // This combines batching efficiency with parallel execution
      // ════��═══════════════════════════════════════════════════════
      const maxTokensPerBatch =
        this.observationConfig.maxTokensPerBatch ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.maxTokensPerBatch;
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

      // Process batches in parallel
      const batchPromises = batches.map(async batch => {
        const batchResult = await this.callMultiThreadObserver(
          existingObservations,
          batch.threadMap,
          batch.threadIds,
          abortSignal,
        );
        return batchResult;
      });

      const batchResults = await Promise.all(batchPromises);

      // Merge all batch results into a single map and accumulate usage
      const multiThreadResults = new Map<
        string,
        {
          observations: string;
          currentTask?: string;
          suggestedContinuation?: string;
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

      // Convert to the expected format for downstream processing
      const observationResults: Array<{
        threadId: string;
        threadMessages: MastraDBMessage[];
        result: {
          observations: string;
          currentTask?: string;
          suggestedContinuation?: string;
        };
      } | null> = [];

      for (const threadId of threadOrder) {
        const threadMessages = messagesByThread.get(threadId) ?? [];
        if (threadMessages.length === 0) continue;

        const result = multiThreadResults.get(threadId);
        if (!result) {
          continue;
        }

        // Debug: Log Observer output for this thread

        observationResults.push({
          threadId,
          threadMessages,
          result,
        });
      }

      // Combine results: wrap each thread's observations and append to existing
      let currentObservations = existingObservations;
      let cycleObservationTokens = 0; // Track total new observation tokens generated in this cycle

      for (const obsResult of observationResults) {
        if (!obsResult) continue;

        const { threadId, threadMessages, result } = obsResult;

        // Track tokens generated for this thread
        cycleObservationTokens += this.tokenCounter.countObservations(result.observations);

        // Wrap with thread tag and append (in thread order for consistency)
        const threadSection = await this.wrapWithThreadTag(threadId, result.observations);
        currentObservations = this.replaceOrAppendThreadSection(currentObservations, threadId, threadSection);

        // Update thread-specific metadata:
        // - lastObservedAt: ALWAYS update to track per-thread observation progress
        // - currentTask, suggestedResponse: only if present in result
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

      // After ALL threads observed, update the record with final observations
      let totalTokenCount = this.tokenCounter.countObservations(currentObservations);

      // Compute global lastObservedAt as a "high water mark" across all threads
      // Note: Per-thread cursors (stored in ThreadOMMetadata.lastObservedAt) are the authoritative source
      // for determining which messages each thread has observed. This global value is used for:
      // - Quick concurrency checks (has any observation happened since we started?)
      // - Thread-scoped observation (non-resource scope)
      const observedMessages = observationResults
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .flatMap(r => r.threadMessages);
      const lastObservedAt = this.getMaxMessageTimestamp(observedMessages);

      // Collect message IDs being observed for the safeguard
      const newMessageIds = observedMessages.map(m => m.id);
      const existingIds = record.observedMessageIds ?? [];
      const allObservedIds = [...new Set([...existingIds, ...newMessageIds])];

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: currentObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        observedMessageIds: allObservedIds,
      });

      // ════════════════════════════════════════════════════════════════════════
      // INSERT END MARKERS into each thread's last message
      // This completes the observation boundary (start markers were inserted above)
      // ════════════════════════════════════════════════════════════════════════
      for (const obsResult of observationResults) {
        if (!obsResult) continue;
        const { threadId, threadMessages, result } = obsResult;
        const lastMessage = threadMessages[threadMessages.length - 1];
        if (lastMessage?.id) {
          const tokensObserved = threadTokensToObserve.get(threadId) ?? this.tokenCounter.countMessages(threadMessages);
          const endMarker = this.createObservationEndMarker({
            cycleId,
            operationType: 'observation',
            startedAt: observationStartedAt,
            tokensObserved,
            observationTokens: cycleObservationTokens,
            observations: result.observations,
            currentTask: result.currentTask,
            suggestedResponse: result.suggestedContinuation,
            recordId: record.id,
            threadId,
          });

          // Stream the end marker to the UI first - this adds the part via stream handler
          if (writer) {
            await writer.custom(endMarker).catch(() => {
              // Ignore errors from streaming - observation should continue
            });
          }

          // Then seal the message (skipPush since writer.custom already added the part)
        }
      }

      // Check for reflection AFTER all threads are observed
      await this.maybeReflect(
        { ...record, activeObservations: currentObservations },
        totalTokenCount,
        currentThreadId,
        writer,
        abortSignal,
      );
    } catch (error) {
      // Insert FAILED markers into each thread's last message on error
      for (const [threadId, msgs] of threadsWithMessages) {
        const lastMessage = msgs[msgs.length - 1];
        if (lastMessage?.id) {
          const tokensAttempted = threadTokensToObserve.get(threadId) ?? 0;
          const failedMarker = this.createObservationFailedMarker({
            cycleId,
            operationType: 'observation',
            startedAt: observationStartedAt,
            tokensAttempted,
            error: error instanceof Error ? error.message : String(error),
            recordId: record.id,
            threadId,
          });

          // Stream the failed marker to the UI first - this adds the part via stream handler
          if (writer) {
            await writer.custom(failedMarker).catch(() => {
              // Ignore errors from streaming - observation should continue
            });
          }

          // Then seal the message (skipPush since writer.custom already added the part)
        }
      }
      // If aborted, re-throw so the main agent loop can handle cancellation
      if (abortSignal?.aborted) {
        throw error;
      }
      // Log the error but don't re-throw - observation failure should not crash the agent
      console.error(`[OM] Resource-scoped observation failed:`, error instanceof Error ? error.message : String(error));
    } finally {
      await this.storage.setObservingFlag(record.id, false);
    }
  }

  /**
   * Check if async reflection should be triggered or activated.
   * Only handles the async path — will never do synchronous (blocking) reflection.
   * Safe to call after buffered observation activation.
   */
  private async maybeAsyncReflect(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    writer?: ProcessorStreamWriter,
  ): Promise<void> {
    if (!this.isAsyncReflectionEnabled()) return;

    const lockKey = this.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);

    omDebug(
      `[OM:reflect] maybeAsyncReflect: observationTokens=${observationTokens}, reflectThreshold=${reflectThreshold}, isReflecting=${record.isReflecting}, bufferedReflection=${record.bufferedReflection ? 'present (' + record.bufferedReflection.length + ' chars)' : 'empty'}, recordId=${record.id}, genCount=${record.generationCount}`,
    );

    // Below threshold: trigger background buffering if at the right interval
    if (observationTokens < reflectThreshold) {
      const shouldTrigger = this.shouldTriggerAsyncReflection(observationTokens, lockKey, record);
      omDebug(`[OM:reflect] below threshold: shouldTrigger=${shouldTrigger}`);
      if (shouldTrigger) {
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer);
      }
      return;
    }

    // At/above threshold: try to activate buffered reflection
    if (record.isReflecting) {
      omDebug(`[OM:reflect] skipping - already reflecting`);
      return;
    }

    omDebug(`[OM:reflect] at/above threshold, trying activation...`);
    const activationSuccess = await this.tryActivateBufferedReflection(record, lockKey, writer);
    omDebug(`[OM:reflect] activationSuccess=${activationSuccess}`);
    if (activationSuccess) return;

    // No buffered reflection available — start one now in the background.
    // This can happen when observations jump past the threshold via activation
    // without any background reflection having been triggered beforehand.
    omDebug(`[OM:reflect] no buffered reflection, starting background reflection...`);
    this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer);
  }

  /**
   * Check if reflection needed and trigger if so.
   * Supports both synchronous reflection and async buffered reflection.
   * When async buffering is enabled via `bufferEvery`, reflection is triggered
   * in the background at intervals, and activated when the threshold is reached.
   */
  private async maybeReflect(
    record: ObservationalMemoryRecord,
    observationTokens: number,
    _threadId?: string,
    writer?: ProcessorStreamWriter,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const lockKey = this.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC BUFFERING: Trigger background reflection at asyncActivation ratio
    // This runs in the background and stores results to bufferedReflection.
    // ════════════════════════════════════════════════════════════════════════
    if (this.isAsyncReflectionEnabled() && observationTokens < reflectThreshold) {
      // Check if we've crossed the asyncActivation threshold
      if (this.shouldTriggerAsyncReflection(observationTokens, lockKey, record)) {
        // Start background reflection (fire-and-forget)
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer);
      }
    }

    // Check if we've reached the reflection threshold
    if (!this.shouldReflect(observationTokens)) {
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // LOCKING: Check if reflection is already in progress
    // ════════════════════════════════════════════════════════════
    if (record.isReflecting) {
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC ACTIVATION: Try to activate buffered reflection first
    // If async buffering was enabled and we have buffered content, activate it.
    // This provides instant activation without blocking on new reflection.
    // ════════════════════════════════════════════════════════════════════════
    if (this.isAsyncReflectionEnabled()) {
      const activationSuccess = await this.tryActivateBufferedReflection(record, lockKey, writer);
      if (activationSuccess) {
        // Buffered reflection was activated - we're done
        return;
      }
      // No buffered content or activation failed - fall back to sync
    }

    // ════════════════════════════════════════════════════════════
    // SYNC PATH: Do synchronous reflection (blocking)
    // ════════════════════════════════════════════════════════════
    await this.storage.setReflectingFlag(record.id, true);

    // Generate unique cycle ID for this reflection
    const cycleId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const threadId = _threadId ?? 'unknown';

    // Stream START marker for reflection
    if (writer) {
      const startMarker = this.createObservationStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToObserve: observationTokens,
        recordId: record.id,
        threadId,
        threadIds: [threadId],
      });
      await writer.custom(startMarker).catch(() => {});
    }

    // Emit reflection_triggered debug event
    this.emitDebugEvent({
      type: 'reflection_triggered',
      timestamp: new Date(),
      threadId,
      resourceId: record.resourceId ?? '',
      inputTokens: observationTokens,
      activeObservationsLength: record.activeObservations?.length ?? 0,
    });

    // Create mutable stream context for retry tracking
    const streamContext = writer
      ? {
          writer,
          cycleId,
          startedAt,
          recordId: record.id,
          threadId,
        }
      : undefined;

    try {
      const reflectResult = await this.callReflector(
        record.activeObservations,
        undefined,
        streamContext,
        reflectThreshold,
        abortSignal,
      );
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Stream END marker for reflection (use streamContext values which may have been updated during retry)
      if (writer && streamContext) {
        const endMarker = this.createObservationEndMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensObserved: observationTokens,
          observationTokens: reflectionTokenCount,
          observations: reflectResult.observations,
          recordId: record.id,
          threadId,
        });
        await writer.custom(endMarker).catch(() => {});
      }

      // Emit reflection_complete debug event with usage
      this.emitDebugEvent({
        type: 'reflection_complete',
        timestamp: new Date(),
        threadId,
        resourceId: record.resourceId ?? '',
        inputTokens: observationTokens,
        outputTokens: reflectionTokenCount,
        observations: reflectResult.observations,
        usage: reflectResult.usage,
      });
    } catch (error) {
      // Stream FAILED marker for reflection (use streamContext values which may have been updated during retry)
      if (writer && streamContext) {
        const failedMarker = this.createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: observationTokens,
          error: error instanceof Error ? error.message : String(error),
          recordId: record.id,
          threadId,
        });
        await writer.custom(failedMarker).catch(() => {});
      }
      // If aborted, re-throw so the main agent loop can handle cancellation
      if (abortSignal?.aborted) {
        throw error;
      }
      // Log the error but don't re-throw - reflection failure should not crash the agent
      console.error(`[OM] Reflection failed:`, error instanceof Error ? error.message : String(error));
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
    }
  }

  /**
   * Manually trigger observation.
   */
  async observe(threadId: string, resourceId?: string, _prompt?: string): Promise<void> {
    const lockKey = this.getLockKey(threadId, resourceId);

    await this.withLock(lockKey, async () => {
      // Re-fetch record inside lock to get latest state
      const freshRecord = await this.getOrCreateRecord(threadId, resourceId);

      if (this.scope === 'resource' && resourceId) {
        // Resource scope: observe all threads with unobserved messages
        await this.doResourceScopedObservation(
          freshRecord,
          threadId,
          resourceId,
          [], // no in-flight messages — everything is already in the DB
        );
      } else {
        // Thread scope: observe unobserved messages for this thread
        const unobservedMessages = await this.loadUnobservedMessages(
          threadId,
          resourceId,
          freshRecord.lastObservedAt ? new Date(freshRecord.lastObservedAt) : undefined,
        );

        if (unobservedMessages.length === 0) {
          return;
        }

        await this.doSynchronousObservation(freshRecord, threadId, unobservedMessages);
      }
    });
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
      return;
    }

    await this.storage.setReflectingFlag(record.id, true);

    try {
      const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
      const reflectResult = await this.callReflector(record.activeObservations, prompt, undefined, reflectThreshold);
      const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);

      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: reflectResult.observations,
        tokenCount: reflectionTokenCount,
      });

      // Note: Thread metadata (currentTask, suggestedResponse) is preserved on each thread
      // and doesn't need to be updated during reflection - it was set during observation
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
    }
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
   * Get current observation configuration
   */
  getObservationConfig(): ResolvedObservationConfig {
    return this.observationConfig;
  }

  /**
   * Get current reflection configuration
   */
  getReflectionConfig(): ResolvedReflectionConfig {
    return this.reflectionConfig;
  }
}
