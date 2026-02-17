/**
 * @mastra/memory/integration
 *
 * Shared integration helpers for adding Observational Memory to any agent
 * framework. Provides the core factory, system prompt construction, status
 * formatting, and config loading — so platform-specific integrations only
 * need to handle message conversion, hook wiring, and storage setup.
 *
 * @example Bring your own storage
 * ```ts
 * import { createOMIntegration } from '@mastra/memory/integration';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const store = new LibSQLStore({ url: 'file:memory.db' });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * const integration = createOMIntegration({ storage });
 * const block = await integration.getSystemPromptBlock({ sessionId: 'session-1' });
 * ```
 *
 * @example With config from disk
 * ```ts
 * import { createOMIntegration, loadOMConfig } from '@mastra/memory/integration';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const config = await loadOMConfig('.myagent/mastra.json');
 * const store = new LibSQLStore({ url: `file:${config.storagePath ?? 'memory.db'}` });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * const integration = createOMIntegration({ storage, ...config });
 * ```
 */

import { readFile } from 'node:fs/promises';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservationalMemoryOptions } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';

import {
  ObservationalMemory,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  OBSERVATION_CONTINUATION_HINT,
} from '../processors/observational-memory/observational-memory';
import type { ObserveHooks, ObservationalMemoryConfig } from '../processors/observational-memory/observational-memory';
import { optimizeObservationsForContext } from '../processors/observational-memory/observer-agent';
import { TokenCounter } from '../processors/observational-memory/token-counter';

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { ObservationalMemoryOptions };
export type { MemoryStorage } from '@mastra/core/storage';
export {
  ObservationalMemory,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  OBSERVATION_CONTINUATION_HINT,
  type ObserveHooks,
  type ObservationalMemoryConfig,
} from '../processors/observational-memory/observational-memory';
export { TokenCounter } from '../processors/observational-memory/token-counter';
export { optimizeObservationsForContext } from '../processors/observational-memory/observer-agent';

// ---------------------------------------------------------------------------
// Formatting Utilities
// ---------------------------------------------------------------------------

/**
 * Render a text-based progress bar.
 *
 * @param current - Current value
 * @param total - Maximum value
 * @param width - Bar width in characters (default 20)
 */
export function progressBar(current: number, total: number, width = 20): string {
  const pct = Math.min(Math.max(total > 0 ? current / total : 0, 0), 1);
  const filled = Math.round(pct * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(pct * 100).toFixed(1)}%`;
}

/**
 * Format a token count for display (e.g. 30000 → '30.0k').
 */
export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * Resolve a threshold that can be a number or a `{ min, max }` range.
 * Returns the `max` when given a range.
 */
export function resolveThreshold(t: number | { min: number; max: number }): number {
  return typeof t === 'number' ? t : t.max;
}

/**
 * Build the observation context block for injection into a system prompt.
 *
 * This is the standard format all integrations use — wraps optimized
 * observations with the context prompt, instructions, and continuation hint.
 *
 * @returns The formatted block, or empty string if observations is empty/null.
 */
export function buildObservationBlock(observations: string | null | undefined): string {
  if (!observations) return '';

  const optimized = optimizeObservationsForContext(observations);
  return `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${optimized}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}\n\n${OBSERVATION_CONTINUATION_HINT}`;
}

/**
 * Format a status string showing OM progress for diagnostics.
 *
 * @param record - The OM record (from `om.getRecord()`)
 * @param omConfig - The OM config (from `om.config`)
 * @param unobservedTokens - Optional override for unobserved token count.
 *   When not provided, falls back to `record.pendingMessageTokens`.
 */
export function formatOMStatus(
  record: {
    scope: string;
    generationCount?: number;
    observationTokenCount?: number;
    pendingMessageTokens?: number;
    lastObservedAt?: string | Date | null;
    isObserving?: boolean;
    isReflecting?: boolean;
  },
  omConfig: {
    observation: { messageTokens: number | { min: number; max: number } };
    reflection: { observationTokens: number | { min: number; max: number } };
  },
  unobservedTokens?: number,
): string {
  const obsThreshold = resolveThreshold(omConfig.observation.messageTokens);
  const refThreshold = resolveThreshold(omConfig.reflection.observationTokens);
  const obsTokens = record.observationTokenCount ?? 0;
  const unobserved = unobservedTokens ?? record.pendingMessageTokens ?? 0;

  return [
    `Observational Memory`,
    `Scope: ${record.scope}  |  Generations: ${record.generationCount ?? 0}`,
    ``,
    `── Observation ──────────────────────────────`,
    `Unobserved: ${formatTokens(unobserved)} / ${formatTokens(obsThreshold)} tokens`,
    progressBar(unobserved, obsThreshold),
    ``,
    `── Reflection ──────────────────────────────`,
    `Observations: ${formatTokens(obsTokens)} / ${formatTokens(refThreshold)} tokens`,
    progressBar(obsTokens, refThreshold),
    ``,
    `── Status ──────────────────────────────────`,
    `Last observed: ${record.lastObservedAt ?? 'never'}`,
    `Observing: ${record.isObserving ? 'yes' : 'no'}  |  Reflecting: ${record.isReflecting ? 'yes' : 'no'}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Core Integration Factory
// ---------------------------------------------------------------------------

/**
 * Options for `createOMIntegration`.
 *
 * At minimum you need a `storage` adapter. Everything else has sensible
 * defaults matching `ObservationalMemory`'s own defaults.
 */
export interface OMIntegrationOptions {
  /**
   * Storage adapter for persisting observations.
   *
   * Obtain one from any Mastra storage provider:
   *
   * ```ts
   * // LibSQL
   * const store = new LibSQLStore({ url: 'file:memory.db' });
   * await store.init();
   * const storage = await store.getStore('memory');
   *
   * // Postgres
   * const store = new PgStore({ connectionString: '...' });
   * await store.init();
   * const storage = await store.getStore('memory');
   * ```
   */
  storage: MemoryStorage;

  /**
   * Model for both Observer and Reflector agents.
   * Uses Mastra's provider registry format (e.g. `'google/gemini-2.5-flash'`).
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: ObservationalMemoryConfig['model'];

  /** Observation step configuration. */
  observation?: ObservationalMemoryConfig['observation'];

  /** Reflection step configuration. */
  reflection?: ObservationalMemoryConfig['reflection'];

  /**
   * Memory scope for observations.
   * - `'resource'`: Observations span all threads for a resource (cross-thread memory)
   * - `'thread'`: Observations are per-thread (default)
   */
  scope?: 'resource' | 'thread';

  /**
   * Share the token budget between messages and observations.
   * When true, total budget = observation.messageTokens + reflection.observationTokens.
   *
   * @default false
   */
  shareTokenBudget?: boolean;

  /** Debug callback for observation events. */
  onDebugEvent?: ObservationalMemoryConfig['onDebugEvent'];
}

/**
 * The platform-agnostic OM integration object.
 *
 * Returned by `createOMIntegration` — provides everything an integration
 * needs except the platform-specific message conversion and hook wiring.
 */
export interface OMIntegration {
  /** The underlying ObservationalMemory instance. */
  om: ObservationalMemory;

  /**
   * Build the observation context block for injection into a system prompt.
   * @returns The observations block (or empty string if none exist).
   */
  getSystemPromptBlock(params: { sessionId: string }): Promise<string>;

  /**
   * Wrap a base system prompt with the observations block appended.
   */
  wrapSystemPrompt(params: { basePrompt: string; sessionId: string }): Promise<string>;

  /**
   * Format a status string showing OM progress for diagnostics.
   */
  getStatus(params: { sessionId: string; messages?: MastraDBMessage[] }): Promise<string>;

  /**
   * Get current active observations as a string.
   */
  getObservations(params: { sessionId: string }): Promise<string | undefined>;

  /** Eagerly initialize the OM record for a session. */
  initSession(params: { sessionId: string }): Promise<void>;

  /**
   * Run observation on converted messages and return a cutoff timestamp
   * for filtering already-observed messages from context.
   *
   * @returns The `lastObservedAt` timestamp (or null if no observation has occurred).
   */
  observeAndGetCutoff(params: {
    sessionId: string;
    messages: MastraDBMessage[];
    hooks?: ObserveHooks;
  }): Promise<Date | null>;
}

/**
 * Create a platform-agnostic Observational Memory integration.
 *
 * Accepts any Mastra `MemoryStorage` adapter — LibSQL, Postgres, in-memory, etc.
 * Returns helpers that handle system prompt injection, status formatting, and
 * the observe→filter flow. Platform-specific integrations wrap this with their
 * own message conversion and hook wiring.
 *
 * @example
 * ```ts
 * import { createOMIntegration } from '@mastra/memory/integration';
 *
 * const integration = createOMIntegration({ storage });
 * const block = await integration.getSystemPromptBlock({ sessionId: 'session-1' });
 * const status = await integration.getStatus({ sessionId: 'session-1' });
 * ```
 */
export function createOMIntegration(options: OMIntegrationOptions): OMIntegration {
  const om = new ObservationalMemory({
    storage: options.storage,
    model: options.model,
    observation: options.observation,
    reflection: options.reflection,
    scope: options.scope,
    shareTokenBudget: options.shareTokenBudget,
    onDebugEvent: options.onDebugEvent,
  });

  let tokenCounter: TokenCounter | undefined;

  async function getSystemPromptBlock({ sessionId }: { sessionId: string }): Promise<string> {
    const observations = await om.getObservations(sessionId);
    return buildObservationBlock(observations);
  }

  async function wrapSystemPrompt({
    basePrompt,
    sessionId,
  }: {
    basePrompt: string;
    sessionId: string;
  }): Promise<string> {
    const block = await getSystemPromptBlock({ sessionId });
    return block ? `${basePrompt}\n\n${block}` : basePrompt;
  }

  async function getStatus({
    sessionId,
    messages,
  }: {
    sessionId: string;
    messages?: MastraDBMessage[];
  }): Promise<string> {
    const record = await om.getRecord(sessionId);
    if (!record) {
      return 'No Observational Memory record found for this session.';
    }

    let unobservedTokens: number | undefined;
    if (messages) {
      const unobserved = record.lastObservedAt
        ? messages.filter(m => m.createdAt > new Date(record.lastObservedAt!))
        : messages;
      tokenCounter ??= new TokenCounter();
      unobservedTokens = tokenCounter.countMessages(unobserved);
    }

    return formatOMStatus(record, om.config, unobservedTokens);
  }

  async function getObservations({ sessionId }: { sessionId: string }): Promise<string | undefined> {
    return om.getObservations(sessionId);
  }

  async function initSession({ sessionId }: { sessionId: string }): Promise<void> {
    await om.getOrCreateRecord(sessionId);
  }

  async function observeAndGetCutoff({
    sessionId,
    messages: mastraMessages,
    hooks,
  }: {
    sessionId: string;
    messages: MastraDBMessage[];
    hooks?: ObserveHooks;
  }): Promise<Date | null> {
    if (mastraMessages.length > 0) {
      await om.observe({ threadId: sessionId, messages: mastraMessages, hooks });
    }

    const record = await om.getRecord(sessionId);
    return record?.lastObservedAt ? new Date(record.lastObservedAt) : null;
  }

  return {
    om,
    getSystemPromptBlock,
    wrapSystemPrompt,
    getStatus,
    getObservations,
    initSession,
    observeAndGetCutoff,
  };
}

// ---------------------------------------------------------------------------
// Config Loading
// ---------------------------------------------------------------------------

/**
 * Config shape for file-based OM setup.
 * Extends `ObservationalMemoryOptions` with a `storagePath` for SQLite location.
 */
export interface OMFileConfig extends ObservationalMemoryOptions {
  /**
   * Path to the SQLite database file for observation storage.
   * Relative to `cwd`.
   */
  storagePath?: string;
}

/**
 * Load OM config from a JSON file.
 *
 * Returns `{}` if the file doesn't exist. Throws if the file exists but
 * contains invalid JSON, so misconfigurations surface immediately.
 *
 * @param configPath - Absolute path to the JSON config file.
 */
export async function loadOMConfig(configPath: string): Promise<OMFileConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `@mastra/memory: failed to read config ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    return JSON.parse(raw) as OMFileConfig;
  } catch (err) {
    throw new Error(
      `@mastra/memory: invalid JSON in ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
