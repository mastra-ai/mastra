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

const OM_DEBUG_LOG = process.env.OM_DEBUG ? join(process.cwd(), 'om-debug.log') : null;
function omDebug(msg: string) {
  if (!OM_DEBUG_LOG) return;
  try {
    appendFileSync(OM_DEBUG_LOG, `[${new Date().toLocaleString()}] ${msg}\n`);
  } catch {
    // ignore write errors
  }
}
function omError(msg: string, err?: unknown) {
  const errStr = err instanceof Error ? (err.stack ?? err.message) : err !== undefined ? String(err) : '';
  const full = errStr ? `${msg}: ${errStr}` : msg;
  omDebug(`[OM:ERROR] ${full}`);
}

omDebug(`[OM:process-start] OM module loaded, pid=${process.pid}`);

// ════════════════════════════════════════════════════════════════════════════════
// PROCESS-LEVEL OPERATION REGISTRY
// Tracks which operations (reflecting, observing, buffering) are actively running
// in THIS process. Used to detect stale DB flags left by crashed processes.
// Key format: `${recordId}:${operationType}`
// ════════════════════════════════════════════════════════════════════════════════
const activeOps = new Set<string>();

function opKey(
  recordId: string,
  op: 'reflecting' | 'observing' | 'bufferingObservation' | 'bufferingReflection',
): string {
  return `${recordId}:${op}`;
}

function registerOp(
  recordId: string,
  op: 'reflecting' | 'observing' | 'bufferingObservation' | 'bufferingReflection',
): void {
  activeOps.add(opKey(recordId, op));
}

function unregisterOp(
  recordId: string,
  op: 'reflecting' | 'observing' | 'bufferingObservation' | 'bufferingReflection',
): void {
  activeOps.delete(opKey(recordId, op));
}

function isOpActiveInProcess(
  recordId: string,
  op: 'reflecting' | 'observing' | 'bufferingObservation' | 'bufferingReflection',
): boolean {
  return activeOps.has(opKey(recordId, op));
}

// Wrap console.error so any unexpected errors also land in the debug log
if (OM_DEBUG_LOG) {
  const _origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    omDebug(
      `[console.error] ${args.map(a => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ')}`,
    );
    _origConsoleError.apply(console, args);
  };
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
  DataOmStatusPart,
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
  bufferTokens?: number;
  /** Ratio of buffered observations to activate (0-1 float) */
  bufferActivation?: number;
  /** Token threshold above which synchronous observation is forced */
  blockAfter?: number;
  /** Custom instructions to append to the Observer's system prompt */
  instruction?: string;
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
  bufferActivation?: number;
  /** Token threshold above which synchronous reflection is forced */
  blockAfter?: number;
  /** Custom instructions to append to the Reflector's system prompt */
  instruction?: string;
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
    // Async buffering defaults (enabled by default)
    bufferTokens: 0.2 as number | undefined, // Buffer every 20% of messageTokens
    bufferActivation: 0.8 as number | undefined, // Activate to retain 20% of threshold
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
    // Async reflection buffering (enabled by default)
    bufferActivation: 0.5 as number | undefined, // Start buffering at 50% of observationTokens
  },
} as const;

/**
 * Continuation hint injected after observations to guide the model's behavior.
 * Prevents the model from awkwardly acknowledging the memory system or treating
 * the conversation as new after observed messages are removed.
 */
export const OBSERVATION_CONTINUATION_HINT = `This message is not from the user, the conversation history grew too long and wouldn't fit in context! Thankfully the entire conversation is stored in your memory observations. Please continue from where the observations left off. Do not refer to your "memory observations" directly, the user doesn't know about them, they are your memories! Just respond naturally as if you're remembering the conversation (you are!). Do not say "Hi there!" or "based on our previous conversation" as if the conversation is just starting, this is not a new conversation. This is an ongoing conversation, keep continuity by responding based on your memory. For example do not say "I understand. I've reviewed my memory observations", or "I remember [...]". Answer naturally following the suggestion from your memory. Note that your memory may contain a suggested first response, which you should follow.

IMPORTANT: this system reminder is NOT from the user. The system placed it here as part of your memory system. This message is part of you remembering your conversation with the user.

NOTE: Any messages following this system reminder are newer than your memories.`;

/**
 * Preamble that introduces the observations block.
 * Use before `<observations>`, with instructions after.
 * Full pattern: `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${obs}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}`
 */
export const OBSERVATION_CONTEXT_PROMPT = `The following observations block contains your memory of past conversations with this user.`;

/**
 * Instructions that tell the model how to interpret and use observations.
 * Place AFTER the `<observations>` block so the model sees the data before the rules.
 */
export const OBSERVATION_CONTEXT_INSTRUCTIONS = `IMPORTANT: When responding, reference specific details from these observations. Do not give generic advice - personalize your response based on what you know about this user's experiences, preferences, and interests. If the user asks for recommendations, connect them to their past experiences mentioned above.

KNOWLEDGE UPDATES: When asked about current state (e.g., "where do I currently...", "what is my current..."), always prefer the MOST RECENT information. Observations include dates - if you see conflicting information, the newer observation supersedes the older one. Look for phrases like "will start", "is switching", "changed to", "moved to" as indicators that previous information has been updated.

PLANNED ACTIONS: If the user stated they planned to do something (e.g., "I'm going to...", "I'm looking forward to...", "I will...") and the date they planned to do it is now in the past (check the relative time like "3 weeks ago"), assume they completed the action unless there's evidence they didn't. For example, if someone said "I'll start my new diet on Monday" and that was 2 weeks ago, assume they started the diet.

MOST RECENT USER INPUT: Treat the most recent user message as the highest-priority signal for what to do next. Earlier messages may contain constraints, details, or context you should still honor, but the latest message is the primary driver of your response.`;

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
export interface ObserveHooks {
  onObservationStart?: () => void;
  onObservationEnd?: () => void;
  onReflectionStart?: () => void;
  onReflectionEnd?: () => void;
}

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
   * STATIC: Shared across all ObservationalMemory instances in this process.
   * This is critical because multiple OM instances are created per agent loop step,
   * and we need them to share knowledge of in-flight operations.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   * Value: Promise that resolves when buffering completes
   */
  private static asyncBufferingOps = new Map<string, Promise<void>>();

  /**
   * Track the last token boundary at which we started buffering.
   * STATIC: Shared across all instances so boundary tracking persists across OM recreations.
   * Key format: "obs:{lockKey}" or "refl:{lockKey}"
   */
  private static lastBufferedBoundary = new Map<string, number>();

  /**
   * Track the timestamp cursor for buffered messages.
   * STATIC: Shared across all instances so each buffer only observes messages
   * newer than the previous buffer's boundary.
   * Key format: "obs:{lockKey}"
   */
  private static lastBufferedAtTime = new Map<string, Date>();

  /**
   * Tracks cycleId for in-flight buffered reflections.
   * STATIC: Shared across instances so we can match cycleId at activation time.
   * Key format: "refl:{lockKey}"
   */
  private static reflectionBufferCycleIds = new Map<string, string>();

  /**
   * Track message IDs that have been sealed during async buffering.
   * STATIC: Shared across all instances so saveMessagesWithSealedIdTracking
   * generates new IDs when re-saving messages that were sealed in a previous step.
   * Key format: threadId
   * Value: Set of sealed message IDs
   */
  private static sealedMessageIds = new Map<string, Set<string>>();

  /**
   * Check if async buffering is enabled for observations.
   */
  private isAsyncObservationEnabled(): boolean {
    const enabled = this.observationConfig.bufferTokens !== undefined && this.observationConfig.bufferTokens > 0;
    return enabled;
  }

  /**
   * Check if async buffering is enabled for reflections.
   * Reflection buffering is enabled when bufferActivation is set (triggers at threshold * bufferActivation).
   */
  private isAsyncReflectionEnabled(): boolean {
    return this.reflectionConfig.bufferActivation !== undefined && this.reflectionConfig.bufferActivation > 0;
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
   * Clean up static maps for a thread/resource to prevent memory leaks.
   * Called after activation (to remove activated message IDs from sealedMessageIds)
   * and from clear() (to fully remove all static state for a thread).
   */
  private cleanupStaticMaps(threadId: string, resourceId?: string | null, activatedMessageIds?: string[]): void {
    const lockKey = this.getLockKey(threadId, resourceId);
    const obsBufKey = this.getObservationBufferKey(lockKey);
    const reflBufKey = this.getReflectionBufferKey(lockKey);

    if (activatedMessageIds) {
      // Partial cleanup: remove only activated IDs from sealedMessageIds
      const sealedSet = ObservationalMemory.sealedMessageIds.get(threadId);
      if (sealedSet) {
        for (const id of activatedMessageIds) {
          sealedSet.delete(id);
        }
        if (sealedSet.size === 0) {
          ObservationalMemory.sealedMessageIds.delete(threadId);
        }
      }
    } else {
      // Full cleanup: remove all static state for this thread
      ObservationalMemory.sealedMessageIds.delete(threadId);
      ObservationalMemory.lastBufferedAtTime.delete(obsBufKey);
      ObservationalMemory.lastBufferedBoundary.delete(obsBufKey);
      ObservationalMemory.lastBufferedBoundary.delete(reflBufKey);
      ObservationalMemory.asyncBufferingOps.delete(obsBufKey);
      ObservationalMemory.asyncBufferingOps.delete(reflBufKey);
      ObservationalMemory.reflectionBufferCycleIds.delete(reflBufKey);
    }
  }

  /**
   * Await any in-flight async buffering operations for a given thread/resource.
   * Returns once all buffering promises have settled (or after timeout).
   */
  static async awaitBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    scope: 'thread' | 'resource',
    timeoutMs = 30000,
  ): Promise<void> {
    const lockKey = scope === 'resource' && resourceId ? `resource:${resourceId}` : `thread:${threadId ?? 'unknown'}`;
    const obsKey = `obs:${lockKey}`;
    const reflKey = `refl:${lockKey}`;

    const promises: Promise<void>[] = [];
    const obsOp = ObservationalMemory.asyncBufferingOps.get(obsKey);
    if (obsOp) promises.push(obsOp);
    const reflOp = ObservationalMemory.asyncBufferingOps.get(reflKey);
    if (reflOp) promises.push(reflOp);

    if (promises.length === 0) {
      return;
    }

    try {
      await Promise.race([
        Promise.all(promises),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
      ]);
    } catch {
      // Timeout or error - continue silently
    }
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
   * Resolve bufferActivation config into an absolute retention floor (tokens to keep).
   * - Value in (0, 1]: ratio → retentionFloor = threshold * (1 - value)
   * - Value >= 1000: absolute token count → retentionFloor = value
   */
  private resolveRetentionFloor(bufferActivation: number, messageTokensThreshold: number): number {
    if (bufferActivation >= 1000) return bufferActivation;
    return messageTokensThreshold * (1 - bufferActivation);
  }

  /**
   * Convert bufferActivation to the equivalent ratio (0-1) for the storage layer.
   * When bufferActivation >= 1000, it's an absolute retention target, so we compute
   * the equivalent ratio: 1 - (bufferActivation / threshold).
   */
  private resolveActivationRatio(bufferActivation: number, messageTokensThreshold: number): number {
    if (bufferActivation >= 1000) {
      return Math.max(0, Math.min(1, 1 - bufferActivation / messageTokensThreshold));
    }
    return bufferActivation;
  }

  /**
   * Calculate the projected message tokens that would be removed if activation happened now.
   * This replicates the chunk boundary logic in swapBufferedToActive without actually activating.
   */
  private calculateProjectedMessageRemoval(
    chunks: BufferedObservationChunk[],
    bufferActivation: number,
    messageTokensThreshold: number,
    currentPendingTokens: number,
  ): number {
    if (chunks.length === 0) return 0;

    const retentionFloor = this.resolveRetentionFloor(bufferActivation, messageTokensThreshold);
    const targetMessageTokens = Math.max(0, currentPendingTokens - retentionFloor);

    // Find the closest chunk boundary to the target, biased over (prefer removing
    // slightly more than the target so remaining context lands at or below retentionFloor).
    // Track both best-over and best-under boundaries so we can fall back to under
    // if the over boundary would overshoot by too much.
    let cumulativeMessageTokens = 0;
    let bestOverBoundary = 0;
    let bestOverTokens = 0;
    let bestUnderBoundary = 0;
    let bestUnderTokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
      const boundary = i + 1;

      if (cumulativeMessageTokens >= targetMessageTokens) {
        // Over or equal — track the closest (lowest) over boundary
        if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
          bestOverBoundary = boundary;
          bestOverTokens = cumulativeMessageTokens;
        }
      } else {
        // Under — track the closest (highest) under boundary
        if (cumulativeMessageTokens > bestUnderTokens) {
          bestUnderBoundary = boundary;
          bestUnderTokens = cumulativeMessageTokens;
        }
      }
    }

    // Safeguard: if the over boundary would eat into more than 95% of the
    // retention floor, fall back to the best under boundary instead.
    // This prevents edge cases where a large chunk overshoots dramatically.
    // Additionally, never bias over if it would leave fewer than the smaller of
    // 1000 tokens or the retention floor — at that level the agent may lose
    // all meaningful context.
    const maxOvershoot = retentionFloor * 0.95;
    const overshoot = bestOverTokens - targetMessageTokens;
    const remainingAfterOver = currentPendingTokens - bestOverTokens;
    const remainingAfterUnder = currentPendingTokens - bestUnderTokens;
    // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
    const minRemaining = Math.min(1000, retentionFloor);

    let bestBoundaryMessageTokens: number;

    if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
      bestBoundaryMessageTokens = bestOverTokens;
    } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
      bestBoundaryMessageTokens = bestUnderTokens;
    } else if (bestOverBoundary > 0) {
      // All boundaries are over and exceed the safeguard — still activate
      // the closest over boundary (better than nothing)
      bestBoundaryMessageTokens = bestOverTokens;
    } else {
      return chunks[0]?.messageTokens ?? 0;
    }

    return bestBoundaryMessageTokens;
  }

  /**
   * Check if we've crossed a new bufferTokens interval boundary.
   * Returns true if async buffering should be triggered.
   *
   * When pending tokens are within ~1 bufferTokens of the observation threshold,
   * the buffer interval is halved to produce finer-grained chunks right before
   * activation. This improves chunk boundary selection, reducing overshoot.
   */
  private shouldTriggerAsyncObservation(
    currentTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
    messageTokensThreshold?: number,
  ): boolean {
    if (!this.isAsyncObservationEnabled()) return false;

    // Don't start a new buffer if one is already in progress
    if (record.isBufferingObservation) {
      if (isOpActiveInProcess(record.id, 'bufferingObservation')) return false;
      // Flag is stale (from a crashed process) — clear it and allow new buffering
      omDebug(`[OM:shouldTriggerAsyncObs] isBufferingObservation=true but stale, clearing`);
      this.storage.setBufferingObservationFlag(record.id, false).catch(() => {});
    }

    // Also check in-memory state for the current instance (protects within a single request)
    const bufferKey = this.getObservationBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;

    const bufferTokens = this.observationConfig.bufferTokens!;
    // Use the higher of persisted DB value or in-memory value.
    // DB value survives instance recreation; in-memory value is set immediately
    // when buffering starts (before the DB write completes).
    const dbBoundary = record.lastBufferedAtTokens ?? 0;
    const memBoundary = ObservationalMemory.lastBufferedBoundary.get(bufferKey) ?? 0;
    const lastBoundary = Math.max(dbBoundary, memBoundary);

    // Halve the buffer interval when within ~1 bufferTokens of the activation threshold.
    // This produces finer-grained chunks right before activation, improving boundary selection.
    const rampPoint = messageTokensThreshold ? messageTokensThreshold - bufferTokens * 1.1 : Infinity;
    const effectiveBufferTokens = currentTokens >= rampPoint ? bufferTokens / 2 : bufferTokens;

    // Calculate which interval we're in
    const currentInterval = Math.floor(currentTokens / effectiveBufferTokens);
    const lastInterval = Math.floor(lastBoundary / effectiveBufferTokens);

    const shouldTrigger = currentInterval > lastInterval;

    omDebug(
      `[OM:shouldTriggerAsyncObs] tokens=${currentTokens}, bufferTokens=${bufferTokens}, effectiveBufferTokens=${effectiveBufferTokens}, rampPoint=${rampPoint}, currentInterval=${currentInterval}, lastInterval=${lastInterval}, lastBoundary=${lastBoundary} (db=${dbBoundary}, mem=${memBoundary}), shouldTrigger=${shouldTrigger}`,
    );

    // Trigger if we've crossed into a new interval
    return shouldTrigger;
  }

  /**
   * Check if async reflection buffering should be triggered.
   * Triggers once when observation tokens reach `threshold * bufferActivation`.
   * Only allows one buffered reflection at a time.
   */
  private shouldTriggerAsyncReflection(
    currentObservationTokens: number,
    lockKey: string,
    record: ObservationalMemoryRecord,
  ): boolean {
    if (!this.isAsyncReflectionEnabled()) return false;

    // Don't re-trigger if buffering is already in progress
    if (record.isBufferingReflection) {
      if (isOpActiveInProcess(record.id, 'bufferingReflection')) return false;
      // Flag is stale (from a crashed process) — clear it and allow new buffering
      omDebug(`[OM:shouldTriggerAsyncRefl] isBufferingReflection=true but stale, clearing`);
      this.storage.setBufferingReflectionFlag(record.id, false).catch(() => {});
    }

    // Also check in-memory state for the current instance
    const bufferKey = this.getReflectionBufferKey(lockKey);
    if (this.isAsyncBufferingInProgress(bufferKey)) return false;
    if (ObservationalMemory.lastBufferedBoundary.has(bufferKey)) return false;

    // Don't re-trigger if the record already has a buffered reflection
    if (record.bufferedReflection) return false;

    // Check if we've crossed the activation threshold
    const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    const activationPoint = reflectThreshold * this.reflectionConfig.bufferActivation!;

    const shouldTrigger = currentObservationTokens >= activationPoint;
    omDebug(
      `[OM:shouldTriggerAsyncRefl] obsTokens=${currentObservationTokens}, reflThreshold=${reflectThreshold}, activationPoint=${activationPoint}, bufferActivation=${this.reflectionConfig.bufferActivation}, shouldTrigger=${shouldTrigger}, isBufferingRefl=${record.isBufferingReflection}, hasBufferedReflection=${!!record.bufferedReflection}`,
    );

    return shouldTrigger;
  }

  /**
   * Check if an async buffering operation is already in progress.
   */
  private isAsyncBufferingInProgress(bufferKey: string): boolean {
    return ObservationalMemory.asyncBufferingOps.has(bufferKey);
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

    // Resolve "default" to the default model
    const resolveModel = (m: typeof config.model) =>
      m === 'default' ? OBSERVATIONAL_MEMORY_DEFAULTS.observation.model : m;

    // Require an explicit model — no silent default.
    // Resolution order: top-level model → sub-config model → the other sub-config model → error
    const observationModel =
      resolveModel(config.model) ?? resolveModel(config.observation?.model) ?? resolveModel(config.reflection?.model);
    const reflectionModel =
      resolveModel(config.model) ?? resolveModel(config.reflection?.model) ?? resolveModel(config.observation?.model);

    if (!observationModel || !reflectionModel) {
      throw new Error(
        `Observational Memory requires a model to be set. Use \`observationalMemory: true\` for the default (google/gemini-2.5-flash), or set a model explicitly:\n\n` +
          `  observationalMemory: {\n` +
          `    model: "$provider/$model",\n` +
          `  }\n\n` +
          `See https://mastra.ai/docs/memory/observational-memory#models for model recommendations and alternatives.`,
      );
    }

    // Get base thresholds first (needed for shared budget calculation)
    const messageTokens = config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens;
    const observationTokens =
      config.reflection?.observationTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.observationTokens;
    const isSharedBudget = config.shareTokenBudget ?? false;

    // Total context budget when shared budget is enabled
    const totalBudget = messageTokens + observationTokens;

    // Async buffering is disabled when:
    // - bufferTokens: false is explicitly set
    // - scope is 'resource' and the user did NOT explicitly configure async buffering
    //   (if they did, validateBufferConfig will throw a helpful error)
    const userExplicitlyConfiguredAsync =
      config.observation?.bufferTokens !== undefined ||
      config.observation?.bufferActivation !== undefined ||
      config.reflection?.bufferActivation !== undefined;
    const asyncBufferingDisabled =
      config.observation?.bufferTokens === false || (config.scope === 'resource' && !userExplicitlyConfiguredAsync);

    // shareTokenBudget is not yet compatible with async buffering (temporary limitation).
    // To use shareTokenBudget, users must explicitly disable buffering.
    if (isSharedBudget && !asyncBufferingDisabled) {
      const common =
        `shareTokenBudget requires async buffering to be disabled (this is a temporary limitation). ` +
        `Add observation: { bufferTokens: false } to your config:\n\n` +
        `  observationalMemory: {\n` +
        `    shareTokenBudget: true,\n` +
        `    observation: { bufferTokens: false },\n` +
        `  }\n`;
      if (userExplicitlyConfiguredAsync) {
        throw new Error(
          common + `\nRemove any other async buffering settings (bufferTokens, bufferActivation, blockAfter).`,
        );
      } else {
        throw new Error(
          common + `\nAsync buffering is enabled by default — this opt-out is only needed when using shareTokenBudget.`,
        );
      }
    }

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
      bufferTokens: asyncBufferingDisabled
        ? undefined
        : this.resolveBufferTokens(
            config.observation?.bufferTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferTokens,
            config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
          ),
      bufferActivation: asyncBufferingDisabled
        ? undefined
        : (config.observation?.bufferActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferActivation),
      blockAfter: asyncBufferingDisabled
        ? undefined
        : this.resolveBlockAfter(
            config.observation?.blockAfter ??
              ((config.observation?.bufferTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.bufferTokens)
                ? 1.2
                : undefined),
            config.observation?.messageTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.observation.messageTokens,
          ),
      instruction: config.observation?.instruction,
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
      bufferActivation: asyncBufferingDisabled
        ? undefined
        : (config?.reflection?.bufferActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.bufferActivation),
      blockAfter: asyncBufferingDisabled
        ? undefined
        : this.resolveBlockAfter(
            config.reflection?.blockAfter ??
              ((config.reflection?.bufferActivation ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.bufferActivation)
                ? 1.2
                : undefined),
            config.reflection?.observationTokens ?? OBSERVATIONAL_MEMORY_DEFAULTS.reflection.observationTokens,
          ),
      instruction: config.reflection?.instruction,
    };

    this.tokenCounter = new TokenCounter();
    this.onDebugEvent = config.onDebugEvent;

    // Create internal MessageHistory for message persistence
    // OM handles message saving itself (in processOutputStep) instead of relying on
    // the Memory class's MessageHistory processor
    this.messageHistory = new MessageHistory({ storage: this.storage });

    // Validate buffer configuration
    this.validateBufferConfig();

    omDebug(
      `[OM:init] new ObservationalMemory instance created — scope=${this.scope}, messageTokens=${JSON.stringify(this.observationConfig.messageTokens)}, obsAsyncEnabled=${this.isAsyncObservationEnabled()}, bufferTokens=${this.observationConfig.bufferTokens}, bufferActivation=${this.observationConfig.bufferActivation}, blockAfter=${this.observationConfig.blockAfter}, reflectionTokens=${this.reflectionConfig.observationTokens}, refAsyncEnabled=${this.isAsyncReflectionEnabled()}, refAsyncActivation=${this.reflectionConfig.bufferActivation}, refBlockAfter=${this.reflectionConfig.blockAfter}`,
    );
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
   * Wait for any in-flight async buffering operations for the given thread/resource.
   * Used by server endpoints to block until buffering completes so the UI can get final state.
   */
  async waitForBuffering(
    threadId: string | null | undefined,
    resourceId: string | null | undefined,
    timeoutMs = 30000,
  ): Promise<void> {
    return ObservationalMemory.awaitBuffering(threadId, resourceId, this.scope, timeoutMs);
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
        return model[0]?.model ?? 'unknown';
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
        omError('[OM] Failed to resolve model config', error);
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
   * Ensures bufferTokens is less than the threshold and bufferActivation is valid.
   */
  private validateBufferConfig(): void {
    // Async buffering is not yet supported with resource scope
    const hasAsyncBuffering =
      this.observationConfig.bufferTokens !== undefined ||
      this.observationConfig.bufferActivation !== undefined ||
      this.reflectionConfig.bufferActivation !== undefined;
    if (hasAsyncBuffering && this.scope === 'resource') {
      throw new Error(
        `Async buffering is not yet supported with scope: 'resource'. ` +
          `Use scope: 'thread', or set observation: { bufferTokens: false } to disable async buffering.`,
      );
    }

    // Validate observation bufferTokens
    const observationThreshold = this.getMaxThreshold(this.observationConfig.messageTokens);
    if (this.observationConfig.bufferTokens !== undefined) {
      if (this.observationConfig.bufferTokens <= 0) {
        throw new Error(`observation.bufferTokens must be > 0, got ${this.observationConfig.bufferTokens}`);
      }
      if (this.observationConfig.bufferTokens >= observationThreshold) {
        throw new Error(
          `observation.bufferTokens (${this.observationConfig.bufferTokens}) must be less than messageTokens (${observationThreshold})`,
        );
      }
    }

    // Validate observation bufferActivation: (0, 1] for ratio, or >= 1000 for absolute retention tokens
    if (this.observationConfig.bufferActivation !== undefined) {
      if (this.observationConfig.bufferActivation <= 0) {
        throw new Error(`observation.bufferActivation must be > 0, got ${this.observationConfig.bufferActivation}`);
      }
      if (this.observationConfig.bufferActivation > 1 && this.observationConfig.bufferActivation < 1000) {
        throw new Error(
          `observation.bufferActivation must be <= 1 (ratio) or >= 1000 (absolute token retention), got ${this.observationConfig.bufferActivation}`,
        );
      }
      if (
        this.observationConfig.bufferActivation >= 1000 &&
        this.observationConfig.bufferActivation >= observationThreshold
      ) {
        throw new Error(
          `observation.bufferActivation as absolute retention (${this.observationConfig.bufferActivation}) must be less than messageTokens (${observationThreshold})`,
        );
      }
    }

    // Validate observation blockAfter
    if (this.observationConfig.blockAfter !== undefined) {
      if (this.observationConfig.blockAfter < observationThreshold) {
        throw new Error(
          `observation.blockAfter (${this.observationConfig.blockAfter}) must be >= messageTokens (${observationThreshold})`,
        );
      }
      if (!this.observationConfig.bufferTokens) {
        throw new Error(
          `observation.blockAfter requires observation.bufferTokens to be set (blockAfter only applies when async buffering is enabled)`,
        );
      }
    }

    // Validate reflection bufferActivation (0-1 float range)
    if (this.reflectionConfig.bufferActivation !== undefined) {
      if (this.reflectionConfig.bufferActivation <= 0 || this.reflectionConfig.bufferActivation > 1) {
        throw new Error(
          `reflection.bufferActivation must be in range (0, 1], got ${this.reflectionConfig.bufferActivation}`,
        );
      }
    }

    // Validate reflection blockAfter
    if (this.reflectionConfig.blockAfter !== undefined) {
      const reflectionThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
      if (this.reflectionConfig.blockAfter < reflectionThreshold) {
        throw new Error(
          `reflection.blockAfter (${this.reflectionConfig.blockAfter}) must be >= reflection.observationTokens (${reflectionThreshold})`,
        );
      }
      if (!this.reflectionConfig.bufferActivation) {
        throw new Error(
          `reflection.blockAfter requires reflection.bufferActivation to be set (blockAfter only applies when async reflection is enabled)`,
        );
      }
    }
  }

  /**
   * Resolve bufferTokens: if it's a fraction (0 < value < 1), multiply by messageTokens threshold.
   * Otherwise return the absolute token count.
   */
  private resolveBufferTokens(
    bufferTokens: number | false | undefined,
    messageTokens: number | ThresholdRange,
  ): number | undefined {
    if (bufferTokens === false) return undefined;
    if (bufferTokens === undefined) return undefined;
    if (bufferTokens > 0 && bufferTokens < 1) {
      const threshold = typeof messageTokens === 'number' ? messageTokens : messageTokens.max;
      return Math.round(threshold * bufferTokens);
    }
    return bufferTokens;
  }

  /**
   * Resolve blockAfter config value.
   * Values in [1, 100) are treated as multipliers of the threshold.
   * e.g. blockAfter: 1.5 with messageTokens: 20_000 → 30_000
   * Values >= 100 are treated as absolute token counts.
   * Defaults to 1.2 (120% of threshold) when async buffering is enabled but blockAfter is omitted.
   */
  private resolveBlockAfter(
    blockAfter: number | undefined,
    messageTokens: number | ThresholdRange,
  ): number | undefined {
    if (blockAfter === undefined) return undefined;
    // Values between 1 (inclusive) and 2 (exclusive) are treated as multipliers of the threshold.
    // e.g. blockAfter: 1.5 means 1.5x the threshold. blockAfter: 1 means exactly at threshold.
    // Values >= 100 are treated as absolute token counts.
    if (blockAfter >= 1 && blockAfter < 100) {
      const threshold = typeof messageTokens === 'number' ? messageTokens : messageTokens.max;
      return Math.round(threshold * blockAfter);
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
   * Check whether the unobserved message tokens meet the observation threshold.
   */
  private meetsObservationThreshold(opts: {
    record: ObservationalMemoryRecord;
    unobservedTokens: number;
    extraTokens?: number;
  }): boolean {
    const { record, unobservedTokens, extraTokens = 0 } = opts;
    const pendingTokens = (record.pendingMessageTokens ?? 0) + unobservedTokens + extraTokens;
    const currentObservationTokens = record.observationTokenCount ?? 0;
    const threshold = this.calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);
    return pendingTokens >= threshold;
  }

  /**
   * Get or create the Observer agent
   */
  private getObserverAgent(): Agent {
    if (!this.observerAgent) {
      const systemPrompt = buildObserverSystemPrompt(false, this.observationConfig.instruction);

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
      const systemPrompt = buildReflectorSystemPrompt(this.reflectionConfig.instruction);

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
    if (!threadId) {
      throw new Error(
        `ObservationalMemory (scope: 'thread') requires a threadId, but received an empty value. ` +
          `This is a bug — getThreadContext should have caught this earlier.`,
      );
    }
    return {
      threadId,
      resourceId: resourceId ?? threadId,
    };
  }

  /**
   * Get or create the observational memory record.
   * Returns the existing record if one exists, otherwise initializes a new one.
   */
  async getOrCreateRecord(threadId: string, resourceId?: string): Promise<ObservationalMemoryRecord> {
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
    generationCount: number;
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
        generationCount: params.generationCount,
        config: this.getObservationMarkerConfig(),
        observations: params.observations,
      },
    };
  }

  /**
   * Persist a data-om-* marker part on the last assistant message in messageList
   * AND save the updated message to the DB so it survives page reload.
   * (data-* parts are filtered out before sending to the LLM, so they don't affect model calls.)
   */
  private async persistMarkerToMessage(
    marker: { type: string; data: unknown },
    messageList: MessageList | undefined,
    threadId: string,
    resourceId?: string,
  ): Promise<void> {
    if (!messageList) return;
    const allMsgs = messageList.get.all.db();
    // Find the last assistant message to attach the marker to
    for (let i = allMsgs.length - 1; i >= 0; i--) {
      const msg = allMsgs[i];
      if (msg?.role === 'assistant' && msg.content?.parts && Array.isArray(msg.content.parts)) {
        // Only push if the marker isn't already in the parts array.
        // writer.custom() adds the marker to the stream, and the AI SDK may have
        // already appended it to the message's parts before this runs.
        const markerData = marker.data as { cycleId?: string } | undefined;
        const alreadyPresent =
          markerData?.cycleId &&
          msg.content.parts.some((p: any) => p?.type === marker.type && p?.data?.cycleId === markerData.cycleId);
        if (!alreadyPresent) {
          msg.content.parts.push(marker as any);
        }
        // Upsert the modified message to DB so the marker part is persisted.
        // Non-critical — if this fails, the marker is still in the stream,
        // it just won't survive page reload.
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

  /**
   * Persist a marker to the last assistant message in storage.
   * Unlike persistMarkerToMessage, this fetches messages directly from the DB
   * so it works even when no MessageList is available (e.g. async buffering ops).
   */
  private async persistMarkerToStorage(
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
      // Find the last assistant message
      for (const msg of messages) {
        if (msg?.role === 'assistant' && msg.content?.parts && Array.isArray(msg.content.parts)) {
          // Only push if the marker isn't already in the parts array.
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
  private getUnobservedMessages(
    allMessages: MastraDBMessage[],
    record: ObservationalMemoryRecord,
    opts?: { excludeBuffered?: boolean },
  ): MastraDBMessage[] {
    const lastObservedAt = record.lastObservedAt;
    // Safeguard: track message IDs that were already observed to prevent re-observation
    // This handles edge cases like process restarts where lastObservedAt might not capture all messages
    const observedMessageIds = new Set<string>(
      Array.isArray(record.observedMessageIds) ? record.observedMessageIds : [],
    );

    // Only exclude buffered chunk message IDs when called from the buffering path.
    // The main agent context should still see buffered messages until activation.
    if (opts?.excludeBuffered) {
      const bufferedChunks = this.getBufferedChunks(record);
      for (const chunk of bufferedChunks) {
        if (Array.isArray(chunk.messageIds)) {
          for (const id of chunk.messageIds) {
            observedMessageIds.add(id);
          }
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
    options?: { skipContinuationHints?: boolean; requestContext?: RequestContext },
  ): Promise<{
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.getObserverAgent();

    const prompt = buildObserverPrompt(existingObservations, messagesToObserve, options);

    const doGenerate = async () => {
      const result = await this.withAbortCheck(
        () =>
          agent.generate(prompt, {
            modelSettings: {
              ...this.observationConfig.modelSettings,
            },
            providerOptions: this.observationConfig.providerOptions as any,
            ...(abortSignal ? { abortSignal } : {}),
            ...(options?.requestContext ? { requestContext: options.requestContext } : {}),
          }),
        abortSignal,
      );
      return result;
    };

    let result = await doGenerate();
    let parsed = parseObserverOutput(result.text);

    // Retry once if degenerate repetition was detected
    if (parsed.degenerate) {
      omDebug(`[OM:callObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseObserverOutput(result.text);
      if (parsed.degenerate) {
        omDebug(`[OM:callObserver] degenerate repetition on retry, failing`);
        throw new Error('Observer produced degenerate output after retry');
      }
    }

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
    requestContext?: RequestContext,
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
      instructions: buildObserverSystemPrompt(true, this.observationConfig.instruction),
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

    const doGenerate = async () => {
      return this.withAbortCheck(
        () =>
          agent.generate(prompt, {
            modelSettings: {
              ...this.observationConfig.modelSettings,
            },
            providerOptions: this.observationConfig.providerOptions as any,
            ...(abortSignal ? { abortSignal } : {}),
            ...(requestContext ? { requestContext } : {}),
          }),
        abortSignal,
      );
    };

    let result = await doGenerate();
    let parsed = parseMultiThreadObserverOutput(result.text);

    // Retry once if degenerate repetition was detected
    if (parsed.degenerate) {
      omDebug(`[OM:callMultiThreadObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseMultiThreadObserverOutput(result.text);
      if (parsed.degenerate) {
        omDebug(`[OM:callMultiThreadObserver] degenerate repetition on retry, failing`);
        throw new Error('Multi-thread observer produced degenerate output after retry');
      }
    }

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
    compressionStartLevel?: 0 | 1 | 2 | 3,
    requestContext?: RequestContext,
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

    // Attempt reflection with escalating compression levels.
    // Start at the provided level and retry up to level 3 if compression fails.
    let currentLevel: 0 | 1 | 2 | 3 = compressionStartLevel ?? 0;
    const maxLevel: 0 | 1 | 2 | 3 = 3;
    let parsed: ReturnType<typeof parseReflectorOutput> = { observations: '', suggestedContinuation: undefined };
    let reflectedTokens = 0;
    let attemptNumber = 0;

    while (currentLevel <= maxLevel) {
      attemptNumber++;
      const isRetry = attemptNumber > 1;

      const prompt = buildReflectorPrompt(observations, manualPrompt, currentLevel, skipContinuationHints);
      omDebug(
        `[OM:callReflector] ${isRetry ? `retry #${attemptNumber - 1}` : 'first attempt'}: level=${currentLevel}, originalTokens=${originalTokens}, targetThreshold=${targetThreshold}, promptLen=${prompt.length}, skipContinuationHints=${skipContinuationHints}`,
      );

      let chunkCount = 0;
      const result = await this.withAbortCheck(
        () =>
          agent.generate(prompt, {
            modelSettings: {
              ...this.reflectionConfig.modelSettings,
            },
            providerOptions: this.reflectionConfig.providerOptions as any,
            ...(abortSignal ? { abortSignal } : {}),
            ...(requestContext ? { requestContext } : {}),
            ...(attemptNumber === 1
              ? {
                  onChunk(chunk: any) {
                    chunkCount++;
                    if (chunkCount === 1 || chunkCount % 50 === 0) {
                      const preview =
                        chunk.type === 'text-delta'
                          ? ` text="${chunk.textDelta?.slice(0, 80)}..."`
                          : chunk.type === 'tool-call'
                            ? ` tool=${chunk.toolName}`
                            : '';
                      omDebug(`[OM:callReflector] chunk#${chunkCount}: type=${chunk.type}${preview}`);
                    }
                  },
                  onFinish(event: any) {
                    omDebug(
                      `[OM:callReflector] onFinish: chunks=${chunkCount}, finishReason=${event.finishReason}, inputTokens=${event.usage?.inputTokens}, outputTokens=${event.usage?.outputTokens}, textLen=${event.text?.length}`,
                    );
                  },
                  onAbort(event: any) {
                    omDebug(`[OM:callReflector] onAbort: chunks=${chunkCount}, reason=${event?.reason ?? 'unknown'}`);
                  },
                  onError({ error }: { error: unknown }) {
                    omError(`[OM:callReflector] onError after ${chunkCount} chunks`, error);
                  },
                }
              : {}),
          }),
        abortSignal,
      );

      omDebug(
        `[OM:callReflector] attempt #${attemptNumber} returned: textLen=${result.text?.length}, textPreview="${result.text?.slice(0, 120)}...", inputTokens=${result.usage?.inputTokens ?? result.totalUsage?.inputTokens}, outputTokens=${result.usage?.outputTokens ?? result.totalUsage?.outputTokens}`,
      );

      // Accumulate usage
      const usage = result.totalUsage ?? result.usage;
      if (usage) {
        totalUsage.inputTokens += usage.inputTokens ?? 0;
        totalUsage.outputTokens += usage.outputTokens ?? 0;
        totalUsage.totalTokens += usage.totalTokens ?? 0;
      }

      parsed = parseReflectorOutput(result.text);

      // If degenerate repetition detected, treat as compression failure
      if (parsed.degenerate) {
        omDebug(
          `[OM:callReflector] attempt #${attemptNumber}: degenerate repetition detected, treating as compression failure`,
        );
        reflectedTokens = originalTokens; // Force retry
      } else {
        reflectedTokens = this.tokenCounter.countObservations(parsed.observations);
      }
      omDebug(
        `[OM:callReflector] attempt #${attemptNumber} parsed: reflectedTokens=${reflectedTokens}, targetThreshold=${targetThreshold}, compressionValid=${validateCompression(reflectedTokens, targetThreshold)}, parsedObsLen=${parsed.observations?.length}, degenerate=${parsed.degenerate ?? false}`,
      );

      // If compression succeeded or we've exhausted all levels, stop
      if (!parsed.degenerate && (validateCompression(reflectedTokens, targetThreshold) || currentLevel >= maxLevel)) {
        break;
      }

      // Guard against infinite loop: if degenerate persists at maxLevel, stop
      if (parsed.degenerate && currentLevel >= maxLevel) {
        omDebug(`[OM:callReflector] degenerate output persists at maxLevel=${maxLevel}, breaking`);
        break;
      }

      // Emit failed marker and start marker for next retry
      if (streamContext?.writer) {
        const failedMarker = this.createObservationFailedMarker({
          cycleId: streamContext.cycleId,
          operationType: 'reflection',
          startedAt: streamContext.startedAt,
          tokensAttempted: originalTokens,
          error: `Did not compress below threshold (${originalTokens} → ${reflectedTokens}, target: ${targetThreshold}), retrying at level ${currentLevel + 1}`,
          recordId: streamContext.recordId,
          threadId: streamContext.threadId,
        });
        await streamContext.writer.custom(failedMarker).catch(() => {});

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
        streamContext.startedAt = startMarker.data.startedAt;
        await streamContext.writer.custom(startMarker).catch(() => {});
      }

      // Escalate to next compression level
      currentLevel = Math.min(currentLevel + 1, maxLevel) as 0 | 1 | 2 | 3;
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
${OBSERVATION_CONTEXT_PROMPT}

<observations>
${optimized}
</observations>

${OBSERVATION_CONTEXT_INSTRUCTIONS}`;

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

    // In thread scope, threadId is required — without it OM would silently
    // fall back to a resource-keyed record which causes deadlocks when
    // multiple threads share the same resourceId.
    if (this.scope === 'thread') {
      throw new Error(
        `ObservationalMemory (scope: 'thread') requires a threadId, but none was found in RequestContext or MessageList. ` +
          `Ensure the agent is configured with Memory and a valid threadId is provided.`,
      );
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
    _pendingTokens: number,
    otherThreadTokens: number,
    currentObservationTokens: number,
    _record?: ObservationalMemoryRecord,
  ): {
    totalPendingTokens: number;
    threshold: number;
    effectiveObservationTokensThreshold: number;
    isSharedBudget: boolean;
  } {
    // Count only unobserved messages for threshold checking.
    // Already-observed messages may still be in the messageList (the AI SDK
    // repopulates it each step), but they shouldn't count toward the threshold
    // since they've already been captured in observations.
    const contextWindowTokens = this.tokenCounter.countMessages(unobservedMessages);

    // Total pending = unobserved in-context tokens + other threads
    const totalPendingTokens = Math.max(0, contextWindowTokens + otherThreadTokens);

    const threshold = this.calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);

    // Calculate effective reflection threshold for UI display
    // When adaptive threshold is enabled, both thresholds share a budget
    const baseReflectionThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    const isSharedBudget = typeof this.observationConfig.messageTokens !== 'number';
    const totalBudget = isSharedBudget ? (this.observationConfig.messageTokens as { min: number; max: number }).max : 0;
    const effectiveObservationTokensThreshold = isSharedBudget
      ? Math.max(totalBudget - threshold, 1000)
      : baseReflectionThreshold;
    return {
      totalPendingTokens,
      threshold,
      effectiveObservationTokensThreshold,
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
    },
    currentObservationTokens: number,
  ): Promise<void> {
    const { totalPendingTokens, threshold, effectiveObservationTokensThreshold } = thresholds;

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
      const bufferedObservationTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);

      // chunk.messageTokens represents the token count of raw messages that will be
      // removed from the context window when the chunk activates (lastObservedAt advances).
      // Cap at totalPendingTokens so the UI never shows a reduction larger than the window.
      const rawBufferedMessageTokens = bufferedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0);
      const bufferedMessageTokens = Math.min(rawBufferedMessageTokens, totalPendingTokens);

      // Calculate projected message removal based on activation ratio and chunk boundaries
      // This replicates the logic in swapBufferedToActive without actually activating
      const projectedMessageRemoval = this.calculateProjectedMessageRemoval(
        bufferedChunks,
        this.observationConfig.bufferActivation ?? 1,
        this.getMaxThreshold(this.observationConfig.messageTokens),
        totalPendingTokens,
      );

      // Determine observation buffering status
      let obsBufferStatus: 'idle' | 'running' | 'complete' = 'idle';
      if (record.isBufferingObservation) {
        obsBufferStatus = 'running';
      } else if (bufferedChunks.length > 0) {
        obsBufferStatus = 'complete';
      }

      // Determine reflection buffering status
      let refBufferStatus: 'idle' | 'running' | 'complete' = 'idle';
      if (record.isBufferingReflection) {
        refBufferStatus = 'running';
      } else if (record.bufferedReflection && record.bufferedReflection.length > 0) {
        refBufferStatus = 'complete';
      }

      const statusPart: DataOmStatusPart = {
        type: 'data-om-status',
        data: {
          windows: {
            active: {
              messages: {
                tokens: totalPendingTokens,
                threshold,
              },
              observations: {
                tokens: currentObservationTokens,
                threshold: effectiveObservationTokensThreshold,
              },
            },
            buffered: {
              observations: {
                chunks: bufferedChunks.length,
                messageTokens: bufferedMessageTokens,
                projectedMessageRemoval,
                observationTokens: bufferedObservationTokens,
                status: obsBufferStatus,
              },
              reflection: {
                inputObservationTokens: record.bufferedReflectionInputTokens ?? 0,
                observationTokens: record.bufferedReflectionTokens ?? 0,
                status: refBufferStatus,
              },
            },
          },
          recordId: record.id,
          threadId,
          stepNumber,
          generationCount: record.generationCount,
        },
      };
      omDebug(
        `[OM:status] step=${stepNumber} msgs=${totalPendingTokens}/${threshold} obs=${currentObservationTokens}/${effectiveObservationTokensThreshold} bufObs={chunks=${bufferedChunks.length},msgTok=${bufferedMessageTokens},obsTok=${bufferedObservationTokens},status=${obsBufferStatus}} bufRef={inTok=${record.bufferedReflectionInputTokens ?? 0},outTok=${record.bufferedReflectionTokens ?? 0},status=${refBufferStatus}} gen=${record.generationCount}`,
      );
      await writer.custom(statusPart).catch(() => {
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
    requestContext?: RequestContext,
  ): Promise<{
    observationSucceeded: boolean;
    updatedRecord: ObservationalMemoryRecord;
    activatedMessageIds?: string[];
  }> {
    let observationSucceeded = false;
    let updatedRecord = record;
    let activatedMessageIds: string[] | undefined;

    await this.withLock(lockKey, async () => {
      let freshRecord = await this.getOrCreateRecord(threadId, resourceId);
      const freshAllMessages = messageList.get.all.db();
      let freshUnobservedMessages = this.getUnobservedMessages(freshAllMessages, freshRecord);

      // Re-check threshold inside the lock using only unobserved messages.
      // Already-observed messages may still be in the messageList but shouldn't
      // count toward the threshold since they've been captured in observations.
      const freshContextTokens = this.tokenCounter.countMessages(freshUnobservedMessages);
      let freshOtherThreadTokens = 0;
      if (this.scope === 'resource' && resourceId) {
        const freshOtherContext = await this.loadOtherThreadsContext(resourceId, threadId);
        freshOtherThreadTokens = freshOtherContext ? this.tokenCounter.countString(freshOtherContext) : 0;
      }
      const freshTotal = freshContextTokens + freshOtherThreadTokens;
      omDebug(
        `[OM:threshold] handleThresholdReached (inside lock): freshTotal=${freshTotal}, threshold=${threshold}, freshUnobserved=${freshUnobservedMessages.length}, freshOtherThreadTokens=${freshOtherThreadTokens}, freshCurrentTokens=${freshContextTokens}`,
      );
      if (freshTotal < threshold) {
        omDebug(`[OM:threshold] freshTotal < threshold, bailing out`);
        return;
      }

      // Snapshot lastObservedAt BEFORE observation runs.
      const preObservationTime = freshRecord.lastObservedAt?.getTime() ?? 0;

      // Try to activate buffered observations first (instant activation)
      let activationResult: {
        success: boolean;
        updatedRecord?: ObservationalMemoryRecord;
        messageTokensActivated?: number;
        activatedMessageIds?: string[];
        suggestedContinuation?: string;
        currentTask?: string;
      } = { success: false };
      if (this.isAsyncObservationEnabled()) {
        // Wait for any in-flight async buffering to complete first
        const bufferKey = this.getObservationBufferKey(lockKey);
        const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
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
        const chunksAfterWait = this.getBufferedChunks(recordAfterWait);
        omDebug(
          `[OM:threshold] tryActivation: chunksAvailable=${chunksAfterWait.length}, isBufferingObs=${recordAfterWait.isBufferingObservation}`,
        );

        activationResult = await this.tryActivateBufferedObservations(
          recordAfterWait,
          lockKey,
          freshTotal,
          writer,
          messageList,
        );
        omDebug(`[OM:threshold] activationResult: success=${activationResult.success}`);
        if (activationResult.success) {
          // Activation succeeded - the buffered observations are now active.
          // Trust the activation and return success immediately.
          // The activated chunks have already been moved to activeObservations.
          observationSucceeded = true;
          updatedRecord = activationResult.updatedRecord ?? recordAfterWait;
          activatedMessageIds = activationResult.activatedMessageIds;

          omDebug(
            `[OM:threshold] activation succeeded, obsTokens=${updatedRecord.observationTokenCount}, activeObsLen=${updatedRecord.activeObservations?.length}`,
          );

          // Propagate continuation hints from activation to thread metadata
          if (activationResult.suggestedContinuation || activationResult.currentTask) {
            const thread = await this.storage.getThreadById({ threadId });
            if (thread) {
              const newMetadata = setThreadOMMetadata(thread.metadata, {
                suggestedResponse: activationResult.suggestedContinuation,
                currentTask: activationResult.currentTask,
              });
              await this.storage.updateThread({
                id: threadId,
                title: thread.title ?? '',
                metadata: newMetadata,
              });
            }
          }

          // Note: lastBufferedBoundary is updated by the caller AFTER cleanupAfterObservation
          // removes the activated messages from messageList and recounts the actual context size.

          // Check if async reflection should be triggered or activated.
          // This only does async work (background buffering or instant activation) —
          // never blocking sync reflection that could overwrite freshly activated observations.
          await this.maybeAsyncReflect(
            updatedRecord,
            updatedRecord.observationTokenCount ?? 0,
            writer,
            messageList,
            requestContext,
          );
          return;
        }

        // When async observation is enabled, don't fall through to synchronous observation
        // unless blockAfter is set and we've exceeded it.
        if (this.observationConfig.blockAfter && freshTotal >= this.observationConfig.blockAfter) {
          omDebug(
            `[OM:threshold] blockAfter exceeded (${freshTotal} >= ${this.observationConfig.blockAfter}), falling through to sync observation`,
          );
          // blockAfter exceeded — fall through to synchronous observation as a last resort.
          // Re-fetch unobserved messages since activation may have changed things.
          freshRecord = await this.getOrCreateRecord(threadId, resourceId);
          const refreshedAll = messageList.get.all.db();
          freshUnobservedMessages = this.getUnobservedMessages(refreshedAll, freshRecord);
        } else {
          omDebug(`[OM:threshold] activation failed, no blockAfter or below it — letting async buffering catch up`);
          // Below blockAfter (or no blockAfter set) — let async buffering catch up.
          return;
        }
      }

      if (freshUnobservedMessages.length > 0) {
        try {
          if (this.scope === 'resource' && resourceId) {
            await this.doResourceScopedObservation({
              record: freshRecord,
              currentThreadId: threadId,
              resourceId,
              currentThreadMessages: freshUnobservedMessages,
              writer,
              abortSignal,
              requestContext,
            });
          } else {
            await this.doSynchronousObservation({
              record: freshRecord,
              threadId,
              unobservedMessages: freshUnobservedMessages,
              writer,
              abortSignal,
              requestContext,
            });
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

    return { observationSucceeded, updatedRecord, activatedMessageIds };
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
    minRemaining?: number,
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

    omDebug(
      `[OM:cleanupBranch] allMsgs=${allMsgs.length}, markerFound=${markerIdx !== -1}, markerIdx=${markerIdx}, observedMessageIds=${observedMessageIds?.length ?? 'undefined'}, allIds=${allMsgs.map(m => m.id?.slice(0, 8)).join(',')}`,
    );

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

      // Remove observed messages from context FIRST, before saveMessagesWithSealedIdTracking
      // which may mutate msg.id for sealed messages (causing removeByIds to miss them).
      if (idsToRemove.length > 0) {
        messageList.removeByIds(idsToRemove);
      }

      // Save all observed messages (with their markers) to DB
      if (messagesToSave.length > 0) {
        await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
      }
    } else if (observedMessageIds && observedMessageIds.length > 0) {
      // Activation-based cleanup: remove observed messages from context.
      // Each LLM step is a fresh request — processInputStep prepares the context
      // window before each call. Removing observed messages here ensures the next
      // step sees a trimmed context with observations instead of raw messages.
      const observedSet = new Set(observedMessageIds);
      const messagesToSave: MastraDBMessage[] = [];
      const idsToRemove: string[] = [];
      const totalTokens = typeof minRemaining === 'number' ? this.tokenCounter.countMessages(allMsgs) : undefined;
      let removedTokens = 0;
      let skipped = 0;

      for (const msg of allMsgs) {
        if (msg?.id && msg.id !== 'om-continuation' && observedSet.has(msg.id)) {
          if (typeof minRemaining === 'number') {
            const msgTokens = this.tokenCounter.countMessage(msg);
            const remainingIfRemoved = (totalTokens ?? 0) - removedTokens - msgTokens;
            if (remainingIfRemoved < minRemaining) {
              skipped += 1;
              continue;
            }
            removedTokens += msgTokens;
          }
          messagesToSave.push(msg);
          idsToRemove.push(msg.id);
        }
      }

      omDebug(
        `[OM:cleanupActivation] observedSet=${[...observedSet].map(id => id.slice(0, 8)).join(',')}, matched=${idsToRemove.length}, skipped=${skipped}, idsToRemove=${idsToRemove.map(id => id.slice(0, 8)).join(',')}`,
      );

      // Remove activated messages from context. No need to re-save — these were
      // already persisted by handlePerStepSave or runAsyncBufferedObservation.
      if (idsToRemove.length > 0) {
        messageList.removeByIds(idsToRemove);
        omDebug(
          `[OM:cleanupActivation] removed ${idsToRemove.length} messages, remaining=${messageList.get.all.db().length}`,
        );
      }
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

    omDebug(
      `[OM:handlePerStepSave] cleared input=${newInput.length}, response=${newOutput.length}, toSave=${messagesToSave.length}, ids=${messagesToSave.map(m => m.id?.slice(0, 8)).join(',')}`,
    );

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
            text: `<system-reminder>${OBSERVATION_CONTINUATION_HINT}</system-reminder>`,
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
      // NOTE: Do NOT add buffered chunk messageIds here. Buffered messages are NOT yet
      // observed — they're staged for future activation. They must remain in context
      // for the LLM to see. Only observedMessageIds and lastObservedAt determine what's
      // been truly observed.

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

    omDebug(
      `[OM:processInputStep:ENTER] step=${stepNumber}, hasMastraMemory=${!!requestContext?.get('MastraMemory')}, hasMemoryInfo=${!!messageList?.serialize()?.memoryInfo?.threadId}`,
    );

    const context = this.getThreadContext(requestContext, messageList);
    if (!context) {
      omDebug(`[OM:processInputStep:NO-CONTEXT] getThreadContext returned null — returning early`);
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
    // At the start of a new turn, check if buffered observations should be activated.
    // Only activates if message tokens have reached the observation threshold,
    // preventing premature activation of partially-buffered content.
    // ════════════════════════════════════════════════════════════════════════
    if (stepNumber === 0 && !readOnly && this.isAsyncObservationEnabled()) {
      const lockKey = this.getLockKey(threadId, resourceId);
      const bufferedChunks = this.getBufferedChunks(record);
      omDebug(
        `[OM:step0-activation] asyncObsEnabled=true, bufferedChunks=${bufferedChunks.length}, isBufferingObs=${record.isBufferingObservation}`,
      );

      // Reset stale lastBufferedBoundary at the start of a new turn.
      // After activation+reflection on a previous turn, the context may have shrunk
      // significantly (e.g., 51k → 3k) but the DB boundary stays at 51k. This makes
      // shouldTriggerAsyncObservation think we're still in interval 5, preventing any
      // new buffering triggers until tokens grow past 51k again.
      {
        const bufKey = this.getObservationBufferKey(lockKey);
        const dbBoundary = record.lastBufferedAtTokens ?? 0;
        const currentContextTokens = this.tokenCounter.countMessages(messageList.get.all.db());
        if (dbBoundary > currentContextTokens) {
          omDebug(
            `[OM:step0-boundary-reset] dbBoundary=${dbBoundary} > currentContext=${currentContextTokens}, resetting to current`,
          );
          ObservationalMemory.lastBufferedBoundary.set(bufKey, currentContextTokens);
          this.storage.setBufferingObservationFlag(record.id, false, currentContextTokens).catch(() => {});
        }
      }

      if (bufferedChunks.length > 0) {
        // Compute threshold to check if activation is warranted
        const allMsgsForCheck = messageList.get.all.db();
        const unobservedMsgsForCheck = this.getUnobservedMessages(allMsgsForCheck, record);
        const otherThreadTokensForCheck = unobservedContextBlocks
          ? this.tokenCounter.countString(unobservedContextBlocks)
          : 0;
        const currentObsTokensForCheck = record.observationTokenCount ?? 0;
        const { totalPendingTokens: step0PendingTokens, threshold: step0Threshold } =
          this.calculateObservationThresholds(
            allMsgsForCheck,
            unobservedMsgsForCheck,
            0, // pendingTokens not needed — allMessages covers context
            otherThreadTokensForCheck,
            currentObsTokensForCheck,
            record,
          );

        // Activate buffered chunks at step 0 if:
        // - We're at or above the regular observation threshold (buffers are needed)
        // Use the regular threshold, not blockAfter — blockAfter gates synchronous observation,
        // but activating already-buffered chunks is cheap (no LLM call) and prevents chunks
        // from piling up in single-step turns that never reach step > 0.
        omDebug(
          `[OM:step0-activation] pendingTokens=${step0PendingTokens}, threshold=${step0Threshold}, blockAfter=${this.observationConfig.blockAfter}, shouldActivate=${step0PendingTokens >= step0Threshold}, allMsgs=${allMsgsForCheck.length}`,
        );

        if (step0PendingTokens >= step0Threshold) {
          const activationResult = await this.tryActivateBufferedObservations(
            record,
            lockKey,
            step0PendingTokens,
            writer,
            messageList,
          );

          if (activationResult.success && activationResult.updatedRecord) {
            record = activationResult.updatedRecord;

            // Remove activated messages from context using activatedMessageIds.
            // Note: swapBufferedToActive does NOT populate record.observedMessageIds
            // (intentionally — recycled IDs would block future content).
            // filterAlreadyObservedMessages runs later at step 0 and uses lastObservedAt
            // as a fallback, but we do explicit removal here for immediate effect.
            const activatedIds = activationResult.activatedMessageIds ?? [];
            if (activatedIds.length > 0) {
              const activatedSet = new Set(activatedIds);
              const allMsgs = messageList.get.all.db();
              const idsToRemove = allMsgs
                .filter(msg => msg?.id && msg.id !== 'om-continuation' && activatedSet.has(msg.id))
                .map(msg => msg.id);

              if (idsToRemove.length > 0) {
                messageList.removeByIds(idsToRemove);
              }
            }

            // Clean up sealed IDs for activated messages (prevents memory leak)
            this.cleanupStaticMaps(threadId, resourceId, activatedIds);

            // Reset lastBufferedBoundary to 0 after activation so that any
            // remaining unbuffered messages in context can trigger a new buffering
            // interval. The worst case is one no-op trigger if all remaining messages
            // are already in buffered chunks.
            const bufKey = this.getObservationBufferKey(lockKey);
            ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
            this.storage.setBufferingObservationFlag(record.id, false, 0).catch(() => {});

            // Propagate continuation hints from activation to thread metadata so
            // injectObservationsIntoContext can include them immediately.
            if (activationResult.suggestedContinuation || activationResult.currentTask) {
              const thread = await this.storage.getThreadById({ threadId });
              if (thread) {
                const newMetadata = setThreadOMMetadata(thread.metadata, {
                  suggestedResponse: activationResult.suggestedContinuation,
                  currentTask: activationResult.currentTask,
                });
                await this.storage.updateThread({
                  id: threadId,
                  title: thread.title ?? '',
                  metadata: newMetadata,
                });
              }
            }

            // Check if reflection should be triggered or activated
            await this.maybeReflect({
              record,
              observationTokens: record.observationTokenCount ?? 0,
              threadId,
              writer,
              messageList,
              requestContext,
            });
            // Re-fetch record — reflection may have created a new generation with lower obsTokens
            record = await this.getOrCreateRecord(threadId, resourceId);
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // STEP 1d: REFLECTION CHECK (step 0 only)
    // If observation tokens are already over the reflection threshold when the
    // conversation starts (e.g. from a previous session), trigger reflection.
    // This covers the case where no buffered observation activation happened above.
    // Safe because reflection carries over lastObservedAt — unobserved messages won't be lost.
    // Also triggers async buffered reflection if above the activation point but
    // below the full threshold (e.g. after a crash lost a previous reflection attempt).
    // ════════════════════════════════════════════════════════════════════════
    if (stepNumber === 0 && !readOnly) {
      const obsTokens = record.observationTokenCount ?? 0;
      if (this.shouldReflect(obsTokens)) {
        omDebug(`[OM:step0-reflect] obsTokens=${obsTokens} over reflectThreshold, triggering reflection`);
        await this.maybeReflect({
          record,
          observationTokens: obsTokens,
          threadId,
          writer,
          messageList,
          requestContext,
        });
        // Re-fetch record after reflection may have created a new generation
        record = await this.getOrCreateRecord(threadId, resourceId);
      } else if (this.isAsyncReflectionEnabled()) {
        // Below full threshold but maybe above activation point — try async reflection
        const lockKey = this.getLockKey(threadId, resourceId);
        if (this.shouldTriggerAsyncReflection(obsTokens, lockKey, record)) {
          omDebug(`[OM:step0-reflect] obsTokens=${obsTokens} above activation point, triggering async reflection`);
          await this.maybeAsyncReflect(record, obsTokens, writer, messageList, requestContext);
          record = await this.getOrCreateRecord(threadId, resourceId);
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

      const thresholds = this.calculateObservationThresholds(
        allMessages,
        unobservedMessages,
        0, // pendingTokens not needed — allMessages covers context
        otherThreadTokens,
        currentObservationTokens,
        record,
      );
      const { totalPendingTokens, threshold } = thresholds;

      // Subtract already-buffered message tokens from the pending count for buffering decisions.
      // Buffered messages are "unobserved" (not yet in activeObservations) but have already been
      // sent to the observer — counting them would cause redundant buffering ops, especially
      // after activation resets lastBufferedBoundary to 0.
      // IMPORTANT: Use messageTokens (message tokens being removed), NOT tokenCount (observation tokens).
      const bufferedChunkTokens = this.getBufferedChunks(record).reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
      const unbufferedPendingTokens = Math.max(0, totalPendingTokens - bufferedChunkTokens);

      // Merge per-state sealedIds with static sealedMessageIds (survives across OM instances)
      const stateSealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();
      const staticSealedIds = ObservationalMemory.sealedMessageIds.get(threadId) ?? new Set<string>();
      const sealedIds = new Set<string>([...stateSealedIds, ...staticSealedIds]);
      state.sealedIds = sealedIds;
      const lockKey = this.getLockKey(threadId, resourceId);

      // ════════════════════════════════════════════════════════════════════════
      // ASYNC BUFFERING: Trigger background observation at bufferTokens intervals
      // ════════════════════════════════════════════════════════════════════════

      if (this.isAsyncObservationEnabled() && totalPendingTokens < threshold) {
        const shouldTrigger = this.shouldTriggerAsyncObservation(totalPendingTokens, lockKey, record, threshold);
        omDebug(
          `[OM:async-obs] belowThreshold: pending=${totalPendingTokens}, unbuffered=${unbufferedPendingTokens}, threshold=${threshold}, shouldTrigger=${shouldTrigger}, isBufferingObs=${record.isBufferingObservation}, lastBufferedAt=${record.lastBufferedAtTokens}`,
        );
        if (shouldTrigger) {
          this.startAsyncBufferedObservation(
            record,
            threadId,
            unobservedMessages,
            lockKey,
            writer,
            unbufferedPendingTokens,
            requestContext,
          );
        }
      } else if (this.isAsyncObservationEnabled()) {
        // Above threshold but we still need to check async buffering:
        // - At step 0, sync observation won't run, so we need chunks ready
        // - Below blockAfter, sync observation won't run, so we need chunks ready
        const shouldTrigger = this.shouldTriggerAsyncObservation(totalPendingTokens, lockKey, record, threshold);
        omDebug(
          `[OM:async-obs] atOrAboveThreshold: pending=${totalPendingTokens}, unbuffered=${unbufferedPendingTokens}, threshold=${threshold}, step=${stepNumber}, shouldTrigger=${shouldTrigger}`,
        );
        if (shouldTrigger) {
          this.startAsyncBufferedObservation(
            record,
            threadId,
            unobservedMessages,
            lockKey,
            writer,
            unbufferedPendingTokens,
            requestContext,
          );
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // PER-STEP SAVE: Always persist messages incrementally (step > 0)
      // Must run BEFORE threshold handling so that:
      // 1. Sealed messages get new IDs (preventing observedMessageIds collisions)
      // 2. Messages are persisted even when activation runs
      // ════════════════════════════════════════════════════════════════════════
      if (stepNumber > 0) {
        await this.handlePerStepSave(messageList, sealedIds, threadId, resourceId, state);
      }

      // ════════════════════════════════════════════════════════════════════════
      // THRESHOLD REACHED: Observe and clean up
      // ════════════════════════════════════════════════════════════════════════
      if (stepNumber > 0 && totalPendingTokens >= threshold) {
        const { observationSucceeded, updatedRecord, activatedMessageIds } = await this.handleThresholdReached(
          messageList,
          record,
          threadId,
          resourceId,
          threshold,
          lockKey,
          writer,
          abortSignal,
          abort,
          requestContext,
        );

        if (observationSucceeded) {
          // Use activatedMessageIds from chunk activation if available,
          // otherwise fall back to observedMessageIds from sync observation.
          // swapBufferedToActive does NOT populate record.observedMessageIds
          // (intentionally — recycled IDs would block future content),
          // so we pass activatedMessageIds directly for cleanup.
          const observedIds = activatedMessageIds?.length
            ? activatedMessageIds
            : Array.isArray(updatedRecord.observedMessageIds)
              ? updatedRecord.observedMessageIds
              : undefined;
          const minRemaining =
            typeof this.observationConfig.bufferActivation === 'number'
              ? Math.min(1000, this.resolveRetentionFloor(this.observationConfig.bufferActivation, threshold))
              : undefined;
          omDebug(
            `[OM:cleanup] observedIds=${observedIds?.length ?? 'undefined'}, ids=${observedIds?.join(',') ?? 'none'}, updatedRecord.observedMessageIds=${JSON.stringify(updatedRecord.observedMessageIds)}, minRemaining=${minRemaining ?? 'n/a'}`,
          );
          await this.cleanupAfterObservation(
            messageList,
            sealedIds,
            threadId,
            resourceId,
            state,
            observedIds,
            minRemaining,
          );

          // Clean up sealed IDs for activated messages (prevents memory leak)
          if (activatedMessageIds?.length) {
            this.cleanupStaticMaps(threadId, resourceId, activatedMessageIds);
          }

          // Reset lastBufferedBoundary to 0 after activation so that any
          // remaining unbuffered messages in context can trigger a new buffering
          // interval on the next step.
          if (this.isAsyncObservationEnabled()) {
            const bufKey = this.getObservationBufferKey(lockKey);
            ObservationalMemory.lastBufferedBoundary.set(bufKey, 0);
            this.storage.setBufferingObservationFlag(updatedRecord.id, false, 0).catch(() => {});
            omDebug(`[OM:threshold] post-activation boundary reset to 0`);
          }
        }

        record = updatedRecord;
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

    // ════════════════════════════════════════════════════════════════════════
    // STEP 5: EMIT FINAL STATUS (after all observations/activations/reflections)
    // ════════════════════════════════════════════════════════════════════════
    {
      // Re-fetch record to capture any changes from observation/activation/reflection
      const freshRecord = await this.getOrCreateRecord(threadId, resourceId);

      // Count tokens from messages actually in the context window.
      // We use messageList directly rather than getUnobservedMessages because after
      // activation, lastObservedAt advances to the chunk's timestamp which incorrectly
      // filters out messages that weren't part of the chunk but predate it.
      // messageList already has activated messages removed (step 1c), so it accurately
      // represents what's still in context.
      const contextMessages = messageList.get.all.db();
      const freshUnobservedTokens = this.tokenCounter.countMessages(contextMessages);
      const otherThreadTokens = unobservedContextBlocks ? this.tokenCounter.countString(unobservedContextBlocks) : 0;
      const currentObservationTokens = freshRecord.observationTokenCount ?? 0;

      const threshold = this.calculateDynamicThreshold(this.observationConfig.messageTokens, currentObservationTokens);
      const baseReflectionThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
      const isSharedBudget = typeof this.observationConfig.messageTokens !== 'number';
      const totalBudget = isSharedBudget
        ? (this.observationConfig.messageTokens as { min: number; max: number }).max
        : 0;
      const effectiveObservationTokensThreshold = isSharedBudget
        ? Math.max(totalBudget - threshold, 1000)
        : baseReflectionThreshold;

      const totalPendingTokens = freshUnobservedTokens + otherThreadTokens;

      await this.emitStepProgress(
        writer,
        threadId,
        resourceId,
        stepNumber,
        freshRecord,
        {
          totalPendingTokens,
          threshold,
          effectiveObservationTokensThreshold,
        },
        currentObservationTokens,
      );

      // Persist the computed token count so the UI can display it on page load
      this.storage.setPendingMessageTokens(freshRecord.id, totalPendingTokens).catch(() => {});
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

    omDebug(
      `[OM:processOutputResult] threadId=${threadId}, inputMsgs=${newInput.length}, responseMsgs=${newOutput.length}, totalToSave=${messagesToSave.length}, allMsgsInList=${messageList.get.all.db().length}`,
    );

    if (messagesToSave.length === 0) {
      omDebug(`[OM:processOutputResult] nothing to save — all messages were already saved during per-step saves`);
      return messageList;
    }

    const sealedIds: Set<string> = (state.sealedIds as Set<string>) ?? new Set<string>();

    omDebug(
      `[OM:processOutputResult] saving ${messagesToSave.length} messages, sealedIds=${sealedIds.size}, ids=${messagesToSave.map(m => m.id?.slice(0, 8)).join(',')}`,
    );
    await this.saveMessagesWithSealedIdTracking(messagesToSave, sealedIds, threadId, resourceId, state);
    omDebug(
      `[OM:processOutputResult] saved successfully, finalIds=${messagesToSave.map(m => m.id?.slice(0, 8)).join(',')}`,
    );

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

    // Look for existing section with same thread ID and date.
    // Use string search instead of regex to avoid polynomial backtracking (CodeQL).
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
        // Verify this section contains the matching date
        if (section.includes(`Date: ${newDate}`) || section.includes(`Date:${newDate}`)) {
          existingSection = section;
        }
      }
    }

    if (existingSection) {
      // Found existing section with same thread ID and date - merge observations
      // Extract observations from new section: everything after the Date: line, before </thread>
      const dateLineEnd = newThreadSection.indexOf('\n', newThreadSection.indexOf('Date:'));
      const newCloseIdx = newThreadSection.lastIndexOf(threadClose);
      if (dateLineEnd !== -1 && newCloseIdx !== -1) {
        const newObsContent = newThreadSection.slice(dateLineEnd + 1, newCloseIdx).trim();
        if (newObsContent) {
          // Insert new observations at the end of the existing section (before </thread>)
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
  private async doSynchronousObservation(opts: {
    record: ObservationalMemoryRecord;
    threadId: string;
    unobservedMessages: MastraDBMessage[];
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const { record, threadId, unobservedMessages, writer, abortSignal, reflectionHooks, requestContext } = opts;
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
    registerOp(record.id, 'observing');

    // Generate unique cycle ID for this observation cycle
    // This ties together the start/end/failed markers
    const cycleId = crypto.randomUUID();

    // Insert START marker before observation (uses total unobserved as estimate;
    // actual observed count may be smaller with ratio-aware observation)
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

      // ════════════════════════════════════════════════════════════
      // RATIO-AWARE MESSAGE SEALING
      // When bufferActivation is set and sync observation fires, seal the
      // most recent message so any future parts added by the LLM go into
      // a new message. This keeps the observation scope bounded — the sealed
      // content gets observed now, and new content accumulates separately
      // for the next observation cycle.
      // ════════════════════════════════════════════════════════════
      let messagesToObserve = unobservedMessages;
      const bufferActivation = this.observationConfig.bufferActivation;
      if (bufferActivation && bufferActivation < 1 && unobservedMessages.length >= 1) {
        const newestMsg = unobservedMessages[unobservedMessages.length - 1];
        if (newestMsg?.content?.parts?.length) {
          this.sealMessagesForBuffering([newestMsg]);
          omDebug(
            `[OM:sync-obs] sealed newest message (${newestMsg.role}, ${newestMsg.content.parts.length} parts) for ratio-aware observation`,
          );
        }
      }

      const result = await this.callObserver(
        freshRecord?.activeObservations ?? record.activeObservations,
        messagesToObserve,
        abortSignal,
        { requestContext },
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

      // Use the max message timestamp as cursor — only for the messages we actually observed
      const lastObservedAt = this.getMaxMessageTimestamp(messagesToObserve);

      // Collect message IDs being observed for the safeguard
      // Only mark the messages we actually observed, not the ones we kept
      const newMessageIds = messagesToObserve.map(m => m.id);
      const existingIds = freshRecord?.observedMessageIds ?? record.observedMessageIds ?? [];
      const allObservedIds = [...new Set([...(Array.isArray(existingIds) ? existingIds : []), ...newMessageIds])];

      // Save thread-specific metadata BEFORE updating the OM record.
      // This ensures a consistent lock ordering (mastra_threads → mastra_observational_memory)
      // that matches the order used by saveMessages, preventing PostgreSQL deadlocks
      // when concurrent agents share a resourceId.
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

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        tokenCount: totalTokenCount,
        lastObservedAt,
        observedMessageIds: allObservedIds,
      });

      // ════════════════════════════════════════════════════════════════════════
      // INSERT END MARKER after successful observation
      // This marks the boundary between observed and unobserved parts
      // ════════════════════════════════════════════════════════════════════════
      const actualTokensObserved = this.tokenCounter.countMessages(messagesToObserve);
      if (lastMessage?.id) {
        const endMarker = this.createObservationEndMarker({
          cycleId,
          operationType: 'observation',
          startedAt,
          tokensObserved: actualTokensObserved,
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
        messages: messagesToObserve.map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        usage: result.usage,
      });

      // Check for reflection
      await this.maybeReflect({
        record: { ...record, activeObservations: newObservations },
        observationTokens: totalTokenCount,
        threadId,
        writer,
        abortSignal,
        reflectionHooks,
        requestContext,
      });
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
      omError('[OM] Observation failed', error);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
      unregisterOp(record.id, 'observing');
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
    contextWindowTokens?: number,
    requestContext?: RequestContext,
  ): void {
    const bufferKey = this.getObservationBufferKey(lockKey);

    // Update the last buffered boundary (in-memory for current instance).
    // Use contextWindowTokens (all messages in context) to match the scale of
    // totalPendingTokens passed to shouldTriggerAsyncObservation.
    const currentTokens =
      contextWindowTokens ?? this.tokenCounter.countMessages(unobservedMessages) + (record.pendingMessageTokens ?? 0);
    ObservationalMemory.lastBufferedBoundary.set(bufferKey, currentTokens);

    // Set persistent flag so new instances (created per request) know buffering is in progress
    registerOp(record.id, 'bufferingObservation');
    this.storage.setBufferingObservationFlag(record.id, true, currentTokens).catch(err => {
      omError('[OM] Failed to set buffering observation flag', err);
    });

    // Start the async operation - waits for any existing op to complete first
    const asyncOp = this.runAsyncBufferedObservation(
      record,
      threadId,
      unobservedMessages,
      bufferKey,
      writer,
      requestContext,
    ).finally(() => {
      // Clean up the operation tracking
      ObservationalMemory.asyncBufferingOps.delete(bufferKey);
      // Clear persistent flag
      unregisterOp(record.id, 'bufferingObservation');
      this.storage.setBufferingObservationFlag(record.id, false).catch(err => {
        omError('[OM] Failed to clear buffering observation flag', err);
      });
    });

    ObservationalMemory.asyncBufferingOps.set(bufferKey, asyncOp);
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
    requestContext?: RequestContext,
  ): Promise<void> {
    // Wait for any existing buffering operation to complete first (mutex behavior)
    const existingOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
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

    // Determine the buffer cursor — the timestamp boundary beyond which we look for new messages.
    // Start from the static map (in-process), fall back to DB record (survives restarts).
    let bufferCursor = ObservationalMemory.lastBufferedAtTime.get(bufferKey) ?? freshRecord.lastBufferedAtTime ?? null;

    // Advance the cursor if lastObservedAt is newer (e.g. sync observation ran after the last buffer)
    if (freshRecord.lastObservedAt) {
      const lastObserved = new Date(freshRecord.lastObservedAt);
      if (!bufferCursor || lastObserved > bufferCursor) {
        bufferCursor = lastObserved;
      }
    }

    // Filter messages to only those newer than the buffer cursor.
    // This prevents re-buffering messages that were already included in a previous chunk,
    // even if their IDs were mutated by saveMessagesWithSealedIdTracking.
    let candidateMessages = this.getUnobservedMessages(unobservedMessages, freshRecord, {
      excludeBuffered: true,
    });
    const preFilterCount = candidateMessages.length;
    if (bufferCursor) {
      candidateMessages = candidateMessages.filter(msg => {
        if (!msg.createdAt) return true; // include messages without timestamps
        return new Date(msg.createdAt) > bufferCursor;
      });
    }

    omDebug(
      `[OM:bufferCursor] cursor=${bufferCursor?.toISOString() ?? 'null'}, unobserved=${unobservedMessages.length}, afterExcludeBuffered=${preFilterCount}, afterCursorFilter=${candidateMessages.length}`,
    );

    // Check if there's enough content to buffer
    const bufferTokens = this.observationConfig.bufferTokens ?? 5000;
    const minNewTokens = bufferTokens / 2;
    const newTokens = this.tokenCounter.countMessages(candidateMessages);

    if (newTokens < minNewTokens) {
      return; // Not enough new content to buffer
    }

    const messagesToBuffer = candidateMessages;

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

    // Track sealed message IDs in the static map so saveMessagesWithSealedIdTracking
    // generates new IDs for any future saves of these messages.
    // Uses static map because async buffering runs in the background and the per-state
    // sealedIds set may belong to a different (already-finished) processInputStep call.
    let staticSealedIds = ObservationalMemory.sealedMessageIds.get(threadId);
    if (!staticSealedIds) {
      staticSealedIds = new Set<string>();
      ObservationalMemory.sealedMessageIds.set(threadId, staticSealedIds);
    }
    for (const msg of messagesToBuffer) {
      staticSealedIds.add(msg.id);
    }

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
      omDebug(
        `[OM:bufferInput] cycleId=${cycleId}, msgCount=${messagesToBuffer.length}, msgTokens=${tokensToBuffer}, ids=${messagesToBuffer.map(m => `${m.id?.slice(0, 8)}@${m.createdAt ? new Date(m.createdAt).toISOString() : 'none'}`).join(',')}`,
      );
      await this.doAsyncBufferedObservation(
        freshRecord,
        threadId,
        messagesToBuffer,
        cycleId,
        startedAt,
        writer,
        requestContext,
      );

      // Update the buffer cursor so the next buffer only sees messages newer than this one.
      // Uses the same timestamp logic as the chunk's lastObservedAt (max message timestamp + 1ms).
      const maxTs = this.getMaxMessageTimestamp(messagesToBuffer);
      const cursor = new Date(maxTs.getTime() + 1);
      ObservationalMemory.lastBufferedAtTime.set(bufferKey, cursor);
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
        await this.persistMarkerToStorage(failedMarker, threadId, freshRecord.resourceId ?? undefined);
      }
      omError('[OM] Async buffered observation failed', error);
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
    requestContext?: RequestContext,
  ): Promise<void> {
    // Build combined context for the observer: active + buffered chunk observations
    const bufferedChunks = this.getBufferedChunks(record);
    const bufferedChunksText = bufferedChunks.map(c => c.observations).join('\n\n');
    const combinedObservations = this.combineObservationsForBuffering(record.activeObservations, bufferedChunksText);

    // Call observer with combined context
    // Allow the observer to produce suggestedResponse/currentTask so they survive
    // activation and maintain continuity when the context window shrinks
    const result = await this.callObserver(
      combinedObservations,
      messagesToBuffer,
      undefined, // No abort signal for background ops
      { requestContext },
    );

    // If the observer returned empty observations, skip buffering
    if (!result.observations) {
      omDebug(`[OM:doAsyncBufferedObservation] empty observations returned, skipping buffer storage`);
      return;
    }

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
        suggestedContinuation: result.suggestedContinuation,
        currentTask: result.currentTask,
      },
      lastBufferedAtTime: lastObservedAt,
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
      // Persist so the badge state survives page reload even if the stream is already closed
      await this.persistMarkerToStorage(endMarker, threadId, record.resourceId ?? undefined);
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
    currentPendingTokens: number,
    writer?: ProcessInputStepArgs['writer'],
    messageList?: MessageList,
  ): Promise<{
    success: boolean;
    updatedRecord?: ObservationalMemoryRecord;
    messageTokensActivated?: number;
    activatedMessageIds?: string[];
    suggestedContinuation?: string;
    currentTask?: string;
  }> {
    // Check if there's buffered content to activate
    const chunks = this.getBufferedChunks(record);
    omDebug(`[OM:tryActivate] chunks=${chunks.length}, recordId=${record.id}`);
    if (!chunks.length) {
      omDebug(`[OM:tryActivate] no chunks, returning false`);
      return { success: false };
    }

    const bufferKey = this.getObservationBufferKey(lockKey);

    // Wait for any in-progress async buffering to complete (with timeout)
    // Use 60s timeout - buffering can take a while for large message batches
    const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
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

    // Re-check whether activation is still needed. A previous activation on this
    // turn (or an in-flight buffering op that just completed) may have already
    // brought us well below the threshold. Activating unnecessarily invalidates
    // the prompt cache, so we skip if we're already under the threshold.
    const messageTokensThreshold = this.getMaxThreshold(this.observationConfig.messageTokens);
    let effectivePendingTokens = currentPendingTokens;
    if (messageList) {
      effectivePendingTokens = this.tokenCounter.countMessages(messageList.get.all.db());
      if (effectivePendingTokens < messageTokensThreshold) {
        omDebug(
          `[OM:tryActivate] skipping activation: freshPendingTokens=${effectivePendingTokens} < threshold=${messageTokensThreshold}`,
        );
        return { success: false };
      }
    }

    // Perform partial swap with bufferActivation
    const bufferActivation = this.observationConfig.bufferActivation ?? 0.7;
    const activationRatio = this.resolveActivationRatio(bufferActivation, messageTokensThreshold);

    // When above blockAfter, prefer the over boundary to reduce context, while still
    // respecting the minimum remaining tokens safeguard.
    const forceMaxActivation = !!(
      this.observationConfig.blockAfter && effectivePendingTokens >= this.observationConfig.blockAfter
    );

    const bufferTokens = this.observationConfig.bufferTokens ?? 0;
    const retentionFloor = this.resolveRetentionFloor(bufferActivation, messageTokensThreshold);
    const projectedMessageRemoval = this.calculateProjectedMessageRemoval(
      freshChunks,
      bufferActivation,
      messageTokensThreshold,
      effectivePendingTokens,
    );
    const projectedRemaining = Math.max(0, effectivePendingTokens - projectedMessageRemoval);
    const maxRemaining = retentionFloor + bufferTokens;

    if (!forceMaxActivation && bufferTokens > 0 && projectedRemaining > maxRemaining) {
      omDebug(
        `[OM:tryActivate] skipping activation: projectedRemaining=${projectedRemaining} > maxRemaining=${maxRemaining} (retentionFloor=${retentionFloor}, bufferTokens=${bufferTokens})`,
      );
      return { success: false };
    }

    omDebug(
      `[OM:tryActivate] swapping: freshChunks=${freshChunks.length}, bufferActivation=${bufferActivation}, activationRatio=${activationRatio}, forceMax=${forceMaxActivation}, totalChunkTokens=${freshChunks.reduce((s, c) => s + (c.tokenCount ?? 0), 0)}`,
    );
    const activationResult = await this.storage.swapBufferedToActive({
      id: freshRecord.id,
      activationRatio,
      messageTokensThreshold,
      currentPendingTokens: effectivePendingTokens,
      forceMaxActivation,
    });
    omDebug(
      `[OM:tryActivate] swapResult: chunksActivated=${activationResult.chunksActivated}, tokensActivated=${activationResult.messageTokensActivated}, obsTokensActivated=${activationResult.observationTokensActivated}, activatedCycleIds=${activationResult.activatedCycleIds.join(',')}`,
    );

    // Clear the buffering flag but do NOT reset lastBufferedBoundary here.
    // The caller sets the boundary to the post-activation context size so that
    // interval tracking continues from the correct position. Deleting it here
    // would reset to 0 and cause the next step to immediately re-trigger buffering.
    await this.storage.setBufferingObservationFlag(freshRecord.id, false);
    unregisterOp(freshRecord.id, 'bufferingObservation');

    // Fetch updated record
    const updatedRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    // Emit activation markers for UI feedback - one per activated cycleId
    // Each marker gets its own chunk's data so the UI shows per-chunk breakdowns
    if (writer && updatedRecord && activationResult.activatedCycleIds.length > 0) {
      const perChunkMap = new Map(activationResult.perChunk?.map(c => [c.cycleId, c]));
      for (const cycleId of activationResult.activatedCycleIds) {
        const chunkData = perChunkMap.get(cycleId);
        const activationMarker = this.createActivationMarker({
          cycleId, // Use the original buffering cycleId so UI can link them
          operationType: 'observation',
          chunksActivated: 1,
          tokensActivated: chunkData?.messageTokens ?? activationResult.messageTokensActivated,
          observationTokens: chunkData?.observationTokens ?? activationResult.observationTokensActivated,
          messagesActivated: chunkData?.messageCount ?? activationResult.messagesActivated,
          recordId: updatedRecord.id,
          threadId: updatedRecord.threadId ?? record.threadId ?? '',
          generationCount: updatedRecord.generationCount ?? 0,
          observations: chunkData?.observations ?? activationResult.observations,
        });
        void writer.custom(activationMarker).catch(() => {});
        await this.persistMarkerToMessage(
          activationMarker,
          messageList,
          record.threadId ?? '',
          record.resourceId ?? undefined,
        );
      }
    }

    return {
      success: true,
      updatedRecord: updatedRecord ?? undefined,
      messageTokensActivated: activationResult.messageTokensActivated,
      activatedMessageIds: activationResult.activatedMessageIds,
      suggestedContinuation: activationResult.suggestedContinuation,
      currentTask: activationResult.currentTask,
    };
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
    requestContext?: RequestContext,
  ): void {
    const bufferKey = this.getReflectionBufferKey(lockKey);

    // Don't start if already in progress
    if (this.isAsyncBufferingInProgress(bufferKey)) {
      return;
    }

    // Update the last buffered boundary (in-memory for current instance)
    ObservationalMemory.lastBufferedBoundary.set(bufferKey, observationTokens);

    // Set persistent flag so new instances know buffering is in progress
    registerOp(record.id, 'bufferingReflection');
    this.storage.setBufferingReflectionFlag(record.id, true).catch(err => {
      omError('[OM] Failed to set buffering reflection flag', err);
    });

    // Start the async operation
    const asyncOp = this.doAsyncBufferedReflection(record, bufferKey, writer, requestContext)
      .catch(async error => {
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
          await this.persistMarkerToStorage(failedMarker, record.threadId ?? '', record.resourceId ?? undefined);
        }
        // Log but don't crash - async buffering failure is recoverable
        omError('[OM] Async buffered reflection failed', error);
      })
      .finally(() => {
        // Clean up the operation tracking
        ObservationalMemory.asyncBufferingOps.delete(bufferKey);
        // Clear persistent flag
        unregisterOp(record.id, 'bufferingReflection');
        this.storage.setBufferingReflectionFlag(record.id, false).catch(err => {
          omError('[OM] Failed to clear buffering reflection flag', err);
        });
      });

    ObservationalMemory.asyncBufferingOps.set(bufferKey, asyncOp);
  }

  /**
   * Perform async buffered reflection - reflects observations and stores to bufferedReflection.
   * Does NOT create a new generation or update activeObservations.
   */
  private async doAsyncBufferedReflection(
    record: ObservationalMemoryRecord,
    _bufferKey: string,
    writer?: ProcessorStreamWriter,
    requestContext?: RequestContext,
  ): Promise<void> {
    // Re-fetch the record to get the latest observation token count.
    // The record passed in may be stale if sync observation just ran.
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const currentRecord = freshRecord ?? record;
    const observationTokens = currentRecord.observationTokenCount ?? 0;
    const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
    const bufferActivation = this.reflectionConfig.bufferActivation ?? 0.5;
    const startedAt = new Date().toISOString();
    const cycleId = `reflect-buf-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Store cycleId so tryActivateBufferedReflection can use it for UI markers
    ObservationalMemory.reflectionBufferCycleIds.set(_bufferKey, cycleId);

    // Slice activeObservations to only the first N lines that fit within the
    // activation-point token budget. This keeps the reflector prompt small
    // (avoiding LLM hangs on huge prompts) and matches the portion that will
    // be replaced at activation time.
    const fullObservations = currentRecord.activeObservations ?? '';
    const allLines = fullObservations.split('\n');
    const totalLines = allLines.length;

    // Calculate how many lines fit within the activation point budget
    const avgTokensPerLine = totalLines > 0 ? observationTokens / totalLines : 0;
    const activationPointTokens = reflectThreshold * bufferActivation;
    const linesToReflect =
      avgTokensPerLine > 0 ? Math.min(Math.floor(activationPointTokens / avgTokensPerLine), totalLines) : totalLines;

    const activeObservations = allLines.slice(0, linesToReflect).join('\n');
    const reflectedObservationLineCount = linesToReflect;
    const sliceTokenEstimate = Math.round(avgTokensPerLine * linesToReflect);
    // Compression target: ask for 75% of the slice size. This is a modest reduction
    // that LLMs can reliably achieve on dense observation text, unlike the more
    // aggressive bufferActivation ratio which often fails on already-compressed content.
    const compressionTarget = Math.round(sliceTokenEstimate * 0.75);

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: slicing observations for reflection — totalLines=${totalLines}, avgTokPerLine=${avgTokensPerLine.toFixed(1)}, activationPointTokens=${activationPointTokens}, linesToReflect=${linesToReflect}/${totalLines}, sliceTokenEstimate=${sliceTokenEstimate}, compressionTarget=${compressionTarget}`,
    );

    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: starting reflector call, recordId=${currentRecord.id}, observationTokens=${sliceTokenEstimate}, compressionTarget=${compressionTarget} (inputTokens), activeObsLength=${activeObservations.length}, reflectedLineCount=${reflectedObservationLineCount}`,
    );

    // Emit buffering start marker (after slice so we report the actual token count)
    if (writer) {
      const startMarker = this.createBufferingStartMarker({
        cycleId,
        operationType: 'reflection',
        tokensToBuffer: sliceTokenEstimate,
        recordId: record.id,
        threadId: record.threadId ?? '',
        threadIds: record.threadId ? [record.threadId] : [],
      });
      void writer.custom(startMarker).catch(() => {});
    }

    // Call reflector with compression target.
    // Start at compression level 1 (standard guidance), retry at level 2 (aggressive).
    const reflectResult = await this.callReflector(
      activeObservations,
      undefined, // No manual prompt
      undefined, // No stream context for background ops
      compressionTarget,
      undefined, // No abort signal for background ops
      true, // Skip continuation hints for async buffering
      1, // Start at compression level 1 for buffered reflection
      requestContext,
    );

    const reflectionTokenCount = this.tokenCounter.countObservations(reflectResult.observations);
    omDebug(
      `[OM:reflect] doAsyncBufferedReflection: reflector returned ${reflectionTokenCount} tokens (${reflectResult.observations?.length} chars), saving to recordId=${currentRecord.id}`,
    );

    // Store to bufferedReflection along with the line boundary
    await this.storage.updateBufferedReflection({
      id: currentRecord.id,
      reflection: reflectResult.observations,
      tokenCount: reflectionTokenCount,
      inputTokenCount: sliceTokenEstimate,
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
        tokensBuffered: sliceTokenEstimate,
        bufferedTokens: reflectionTokenCount,
        recordId: currentRecord.id,
        threadId: currentRecord.threadId ?? '',
        observations: reflectResult.observations,
      });
      void writer.custom(endMarker).catch(() => {});
      // Persist so the badge state survives page reload even if the stream is already closed
      await this.persistMarkerToStorage(endMarker, currentRecord.threadId ?? '', currentRecord.resourceId ?? undefined);
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
    messageList?: MessageList,
  ): Promise<boolean> {
    const bufferKey = this.getReflectionBufferKey(lockKey);

    // Wait for any in-flight async reflection before checking DB state.
    // The passed-in record may be stale — the async reflector could have
    // saved results between when the record was fetched and now.
    const asyncOp = ObservationalMemory.asyncBufferingOps.get(bufferKey);
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

    // Fetch the latest record — either the async op just completed, or we
    // need the freshest DB state to check for buffered reflection content.
    const freshRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);

    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: recordId=${record.id}, hasBufferedReflection=${!!freshRecord?.bufferedReflection}, bufferedReflectionLen=${freshRecord?.bufferedReflection?.length ?? 0}`,
    );
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
    ObservationalMemory.lastBufferedBoundary.delete(bufferKey);

    // Emit activation marker using the original buffering cycleId so the UI can match it
    const afterRecord = await this.storage.getObservationalMemory(record.threadId, record.resourceId);
    const afterTokens = afterRecord?.observationTokenCount ?? 0;
    omDebug(
      `[OM:reflect] tryActivateBufferedReflection: activation complete! beforeTokens=${beforeTokens}, afterTokens=${afterTokens}, newRecordId=${afterRecord?.id}, newGenCount=${afterRecord?.generationCount}`,
    );

    if (writer) {
      const originalCycleId = ObservationalMemory.reflectionBufferCycleIds.get(bufferKey);
      const activationMarker = this.createActivationMarker({
        cycleId: originalCycleId ?? `reflect-act-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        operationType: 'reflection',
        chunksActivated: 1,
        tokensActivated: beforeTokens,
        observationTokens: afterTokens,
        messagesActivated: 0,
        recordId: freshRecord.id,
        threadId: freshRecord.threadId ?? '',
        generationCount: afterRecord?.generationCount ?? freshRecord.generationCount ?? 0,
        observations: afterRecord?.activeObservations,
      });
      void writer.custom(activationMarker).catch(() => {});
      await this.persistMarkerToMessage(
        activationMarker,
        messageList,
        freshRecord.threadId ?? '',
        freshRecord.resourceId ?? undefined,
      );
    }

    // Clean up the stored cycleId
    ObservationalMemory.reflectionBufferCycleIds.delete(bufferKey);

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
  private async doResourceScopedObservation(opts: {
    record: ObservationalMemoryRecord;
    currentThreadId: string;
    resourceId: string;
    currentThreadMessages: MastraDBMessage[];
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const {
      record,
      currentThreadId,
      resourceId,
      currentThreadMessages,
      writer,
      abortSignal,
      reflectionHooks,
      requestContext,
    } = opts;
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
    registerOp(record.id, 'observing');

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
          requestContext,
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
      await this.maybeReflect({
        record: { ...record, activeObservations: currentObservations },
        observationTokens: totalTokenCount,
        threadId: currentThreadId,
        writer,
        abortSignal,
        reflectionHooks,
        requestContext,
      });
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
      omError('[OM] Resource-scoped observation failed', error);
    } finally {
      await this.storage.setObservingFlag(record.id, false);
      unregisterOp(record.id, 'observing');
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
    messageList?: MessageList,
    requestContext?: RequestContext,
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
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
      }
      return;
    }

    // At/above threshold: try to activate buffered reflection
    if (record.isReflecting) {
      if (isOpActiveInProcess(record.id, 'reflecting')) {
        omDebug(`[OM:reflect] skipping - actively reflecting in this process`);
        return;
      }
      omDebug(`[OM:reflect] isReflecting=true but stale (not active in this process), clearing`);
      await this.storage.setReflectingFlag(record.id, false);
    }

    omDebug(`[OM:reflect] at/above threshold, trying activation...`);
    const activationSuccess = await this.tryActivateBufferedReflection(record, lockKey, writer, messageList);
    omDebug(`[OM:reflect] activationSuccess=${activationSuccess}`);
    if (activationSuccess) return;

    // No buffered reflection available — start one now in the background.
    // This can happen when observations jump past the threshold via activation
    // without any background reflection having been triggered beforehand.
    omDebug(`[OM:reflect] no buffered reflection, starting background reflection...`);
    this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
  }

  /**
   * Check if reflection needed and trigger if so.
   * Supports both synchronous reflection and async buffered reflection.
   * When async buffering is enabled via `bufferTokens`, reflection is triggered
   * in the background at intervals, and activated when the threshold is reached.
   */
  private async maybeReflect(opts: {
    record: ObservationalMemoryRecord;
    observationTokens: number;
    threadId?: string;
    writer?: ProcessorStreamWriter;
    abortSignal?: AbortSignal;
    messageList?: MessageList;
    reflectionHooks?: Pick<ObserveHooks, 'onReflectionStart' | 'onReflectionEnd'>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const { record, observationTokens, writer, abortSignal, messageList, reflectionHooks, requestContext } = opts;
    const lockKey = this.getLockKey(record.threadId, record.resourceId);
    const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC BUFFERING: Trigger background reflection at bufferActivation ratio
    // This runs in the background and stores results to bufferedReflection.
    // ════════════════════════════════════════════════════════════════════════
    if (this.isAsyncReflectionEnabled() && observationTokens < reflectThreshold) {
      // Check if we've crossed the bufferActivation threshold
      if (this.shouldTriggerAsyncReflection(observationTokens, lockKey, record)) {
        // Start background reflection (fire-and-forget)
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
      }
    }

    // Check if we've reached the reflection threshold
    if (!this.shouldReflect(observationTokens)) {
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // LOCKING: Check if reflection is already in progress
    // If the DB flag is set but this process isn't actively reflecting,
    // the flag is stale (from a crashed process) — clear it and proceed.
    // ════════════════════════════════════════════════════════════
    if (record.isReflecting) {
      if (isOpActiveInProcess(record.id, 'reflecting')) {
        omDebug(`[OM:reflect] isReflecting=true and active in this process, skipping`);
        return;
      }
      omDebug(`[OM:reflect] isReflecting=true but NOT active in this process — stale flag from dead process, clearing`);
      await this.storage.setReflectingFlag(record.id, false);
    }

    // ════════════════════════════════════════════════════════════════════════
    // ASYNC ACTIVATION: Try to activate buffered reflection first
    // If async buffering was enabled and we have buffered content, activate it.
    // This provides instant activation without blocking on new reflection.
    // ════════════════════════════════════════════════════════════════════════
    if (this.isAsyncReflectionEnabled()) {
      const activationSuccess = await this.tryActivateBufferedReflection(record, lockKey, writer, messageList);
      if (activationSuccess) {
        // Buffered reflection was activated - we're done
        return;
      }
      // No buffered content or activation failed.
      // When async is enabled, only fall through to sync if blockAfter is set and exceeded.
      if (this.reflectionConfig.blockAfter && observationTokens >= this.reflectionConfig.blockAfter) {
        omDebug(
          `[OM:reflect] blockAfter exceeded (${observationTokens} >= ${this.reflectionConfig.blockAfter}), falling through to sync reflection`,
        );
      } else {
        omDebug(
          `[OM:reflect] async activation failed, no blockAfter or below it (obsTokens=${observationTokens}, blockAfter=${this.reflectionConfig.blockAfter}) — starting background reflection`,
        );
        // Start background reflection so it's ready for next activation attempt
        this.startAsyncBufferedReflection(record, observationTokens, lockKey, writer, requestContext);
        return;
      }
    }

    // ════════════════════════════════════════════════════════════
    // SYNC PATH: Do synchronous reflection (blocking)
    // ════════════════════════════════════════════════════════════
    reflectionHooks?.onReflectionStart?.();
    await this.storage.setReflectingFlag(record.id, true);
    registerOp(record.id, 'reflecting');

    // Generate unique cycle ID for this reflection
    const cycleId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const threadId = opts.threadId ?? 'unknown';

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
        undefined,
        undefined,
        requestContext,
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
      omError('[OM] Reflection failed', error);
    } finally {
      await this.storage.setReflectingFlag(record.id, false);
      reflectionHooks?.onReflectionEnd?.();
      unregisterOp(record.id, 'reflecting');
    }
  }

  /**
   * Manually trigger observation.
   *
   * When `messages` is provided, those are used directly (filtered for unobserved)
   * instead of reading from storage. This allows external systems (e.g., opencode)
   * to pass conversation messages without duplicating them into Mastra's DB.
   */
  async observe(opts: {
    threadId: string;
    resourceId?: string;
    messages?: MastraDBMessage[];
    hooks?: ObserveHooks;
    requestContext?: RequestContext;
  }): Promise<void> {
    const { threadId, resourceId, messages, hooks, requestContext } = opts;
    const lockKey = this.getLockKey(threadId, resourceId);
    const reflectionHooks = hooks
      ? { onReflectionStart: hooks.onReflectionStart, onReflectionEnd: hooks.onReflectionEnd }
      : undefined;

    await this.withLock(lockKey, async () => {
      // Re-fetch record inside lock to get latest state
      const freshRecord = await this.getOrCreateRecord(threadId, resourceId);

      if (this.scope === 'resource' && resourceId) {
        // Resource scope: check threshold before observing
        const currentMessages = messages ?? [];
        if (
          !this.meetsObservationThreshold({
            record: freshRecord,
            unobservedTokens: this.tokenCounter.countMessages(currentMessages),
          })
        ) {
          return;
        }

        hooks?.onObservationStart?.();
        try {
          await this.doResourceScopedObservation({
            record: freshRecord,
            currentThreadId: threadId,
            resourceId,
            currentThreadMessages: currentMessages,
            reflectionHooks,
            requestContext,
          });
        } finally {
          hooks?.onObservationEnd?.();
        }
      } else {
        // Thread scope: use provided messages or load from storage
        const unobservedMessages = messages
          ? this.getUnobservedMessages(messages, freshRecord)
          : await this.loadUnobservedMessages(
              threadId,
              resourceId,
              freshRecord.lastObservedAt ? new Date(freshRecord.lastObservedAt) : undefined,
            );

        if (unobservedMessages.length === 0) {
          return;
        }

        // Check token threshold before observing
        if (
          !this.meetsObservationThreshold({
            record: freshRecord,
            unobservedTokens: this.tokenCounter.countMessages(unobservedMessages),
          })
        ) {
          return;
        }

        hooks?.onObservationStart?.();
        try {
          await this.doSynchronousObservation({
            record: freshRecord,
            threadId,
            unobservedMessages,
            reflectionHooks,
            requestContext,
          });
        } finally {
          hooks?.onObservationEnd?.();
        }
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
  async reflect(
    threadId: string,
    resourceId?: string,
    prompt?: string,
    requestContext?: RequestContext,
  ): Promise<void> {
    const record = await this.getOrCreateRecord(threadId, resourceId);

    if (!record.activeObservations) {
      return;
    }

    await this.storage.setReflectingFlag(record.id, true);
    registerOp(record.id, 'reflecting');

    try {
      const reflectThreshold = this.getMaxThreshold(this.reflectionConfig.observationTokens);
      const reflectResult = await this.callReflector(
        record.activeObservations,
        prompt,
        undefined,
        reflectThreshold,
        undefined,
        undefined,
        undefined,
        requestContext,
      );
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
      unregisterOp(record.id, 'reflecting');
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
    // Clean up static maps to prevent memory leaks
    this.cleanupStaticMaps(ids.threadId ?? ids.resourceId, ids.resourceId);
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
