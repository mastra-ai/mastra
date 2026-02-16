/**
 * @mastra/pi
 *
 * Brings Mastra Observational Memory into Pi agent sessions.
 *
 * Provides two integration surfaces:
 *
 * 1. **pi-agent-core** (`@mariozechner/pi-agent-core`):
 *    `createMastraOM()` returns a `transformContext` function and system prompt
 *    injector that plug directly into the Agent constructor.
 *
 * 2. **pi-coding-agent** (`@mariozechner/pi-coding-agent`):
 *    See `@mastra/pi/extension` for the full extension that hooks into the
 *    coding agent's lifecycle events.
 *
 * Storage is fully pluggable — pass any Mastra `MemoryStorage` adapter
 * (LibSQL, Postgres, in-memory, etc.) or use the convenience helpers to
 * create one from a config file or a LibSQL path.
 *
 * @example Minimal — bring your own storage
 * ```ts
 * import { Agent } from '@mariozechner/pi-agent-core';
 * import { createMastraOM } from '@mastra/pi';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const store = new LibSQLStore({ url: 'file:memory.db' });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * const om = createMastraOM({ storage });
 * const sessionId = 'session-1';
 *
 * const agent = new Agent({
 *   initialState: {
 *     systemPrompt: await om.wrapSystemPrompt('You are helpful.', sessionId),
 *     model: getModel('anthropic', 'claude-sonnet-4-20250514'),
 *   },
 *   transformContext: om.createTransformContext(sessionId),
 * });
 * ```
 *
 * @example From config file (.pi/mastra.json)
 * ```ts
 * import { createMastraOMFromConfig } from '@mastra/pi';
 *
 * const om = await createMastraOMFromConfig({ cwd: process.cwd() });
 * ```
 */

import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { AgentMessage, AgentOptions } from '@mariozechner/pi-agent-core';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservationalMemoryOptions } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import type { ObserveHooks, ObservationalMemoryConfig } from '@mastra/memory/processors';
import {
  ObservationalMemory,
  TokenCounter,
  optimizeObservationsForContext,
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
} from '@mastra/memory/processors';

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { ObservationalMemoryOptions };
export type { MemoryStorage } from '@mastra/core/storage';
export type { ObserveHooks, ObservationalMemoryConfig } from '@mastra/memory/processors';
export {
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  ObservationalMemory,
  TokenCounter,
} from '@mastra/memory/processors';

// ---------------------------------------------------------------------------
// Configuration (for file-based convenience path)
// ---------------------------------------------------------------------------

/**
 * Config read from `.pi/mastra.json`.
 * Extends Mastra's ObservationalMemoryOptions with pi-specific fields.
 */
export interface MastraOMConfig extends ObservationalMemoryOptions {
  /**
   * Path to a SQLite database file for observation storage.
   * Only used by `createMastraOMFromConfig` — ignored when you pass
   * your own `storage` to `createMastraOM`.
   *
   * @default '.pi/memory/observations.db'
   */
  storagePath?: string;
}

const CONFIG_FILE = '.pi/mastra.json';
const DEFAULT_STORAGE_PATH = '.pi/memory/observations.db';

/**
 * Load OM config from `.pi/mastra.json`.
 */
export async function loadConfig(directory: string): Promise<MastraOMConfig> {
  const configPath = join(directory, CONFIG_FILE);
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    // Config file doesn't exist — use defaults
    return {};
  }
  try {
    return JSON.parse(raw) as MastraOMConfig;
  } catch (err) {
    throw new Error(
      `@mastra/pi: invalid JSON in ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Message Conversion
// ---------------------------------------------------------------------------

type ContentPart = { type: string; [key: string]: any };

/**
 * Structural type matching Pi's AgentMessage shape.
 *
 * We define this locally so `convertMessages` can access properties in a
 * type-safe way without needing `as any` throughout.
 */
interface PiMessage {
  role: string;
  content?: string | Array<PiContentPart>;
  timestamp?: number;
  id?: string;
}

interface PiContentPart {
  type?: string;
  text?: string;
  thinking?: string;
  data?: string;
  image?: string;
  toolCallId?: string;
  id?: string;
  name?: string;
  toolName?: string;
  args?: unknown;
}

/**
 * Convert Pi `AgentMessage[]` to Mastra's `MastraDBMessage` format.
 *
 * Pi messages use a content array with `TextContent`, `ImageContent`,
 * and tool call content. We map what we can — text, tool invocations,
 * and images — and skip the rest.
 */
export function convertMessages(messages: AgentMessage[], sessionId: string): MastraDBMessage[] {
  return (messages as unknown as PiMessage[])
    .map(msg => {
      if (msg.role !== 'user' && msg.role !== 'assistant') return null;

      const rawContent = msg.content;
      if (!rawContent) return null;

      const parts: ContentPart[] = [];

      if (typeof rawContent === 'string') {
        parts.push({ type: 'text', text: rawContent });
      } else if (Array.isArray(rawContent)) {
        for (const p of rawContent) {
          const type = p.type;

          if (type === 'text' && p.text) {
            parts.push({ type: 'text', text: p.text });
          } else if (type === 'toolCall') {
            parts.push({
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: p.toolCallId ?? p.id,
                toolName: p.name ?? p.toolName,
                args: p.args,
                result: undefined,
                state: 'call',
              },
            });
          } else if (type === 'image') {
            parts.push({
              type: 'image',
              image: p.data ?? p.image,
            });
          } else if (type === 'thinking' && p.thinking) {
            parts.push({ type: 'reasoning', reasoning: p.thinking });
          }
        }
      }

      if (parts.length === 0) return null;

      const timestamp = msg.timestamp;
      const id =
        msg.id ??
        `${sessionId}-${timestamp ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      return {
        id,
        role: msg.role as 'user' | 'assistant',
        createdAt: new Date(timestamp ?? Date.now()),
        threadId: sessionId,
        resourceId: sessionId,
        content: {
          format: 2 as const,
          parts,
        },
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null) as MastraDBMessage[];
}

// ---------------------------------------------------------------------------
// Formatting Helpers (exported for extension use)
// ---------------------------------------------------------------------------

/** @internal */
export function progressBar(current: number, total: number, width = 20): string {
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(pct * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(pct * 100).toFixed(1)}%`;
}

/** @internal */
export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** @internal */
export function resolveThreshold(t: number | { min: number; max: number }): number {
  return typeof t === 'number' ? t : t.max;
}

// ---------------------------------------------------------------------------
// Core Integration for pi-agent-core
// ---------------------------------------------------------------------------

/**
 * Options for `createMastraOM`.
 *
 * At minimum you need a `storage` adapter. Everything else has sensible
 * defaults matching `ObservationalMemory`'s own defaults.
 */
export interface CreateMastraOMOptions {
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

export interface MastraOMIntegration {
  /** The underlying ObservationalMemory instance. */
  om: ObservationalMemory;

  /**
   * Create a `transformContext` compatible with `AgentOptions.transformContext`.
   *
   * Plugs into `new Agent({ transformContext })`.
   * Runs observation on the current messages, then filters out already-observed
   * messages so the model sees observations + recent unobserved turns.
   *
   * @param sessionId - The session / thread identifier.
   * @param hooks - Optional callbacks for observation/reflection lifecycle.
   */
  createTransformContext(
    sessionId: string,
    hooks?: ObserveHooks,
  ): NonNullable<AgentOptions['transformContext']>;

  /**
   * Build the observation context block for injection into a system prompt.
   *
   * @param sessionId - The session / thread identifier.
   * @returns The observations block (or empty string if none exist).
   */
  getSystemPromptBlock(sessionId: string): Promise<string>;

  /**
   * Wrap a base system prompt with the observations block appended.
   *
   * @param basePrompt - The original system prompt.
   * @param sessionId - The session / thread identifier.
   */
  wrapSystemPrompt(basePrompt: string, sessionId: string): Promise<string>;

  /**
   * Format a status string showing OM progress for diagnostics.
   */
  getStatus(sessionId: string, messages?: AgentMessage[]): Promise<string>;

  /**
   * Get current active observations as a string.
   */
  getObservations(sessionId: string): Promise<string | undefined>;

  /** Eagerly initialize the OM record for a session. */
  initSession(sessionId: string): Promise<void>;
}

/**
 * Create a Mastra Observational Memory integration for `pi-agent-core`.
 *
 * Accepts any Mastra `MemoryStorage` adapter — LibSQL, Postgres, in-memory, etc.
 * Returns helpers that plug directly into `Agent` constructor options.
 *
 * @example Bring your own storage
 * ```ts
 * import { Agent } from '@mariozechner/pi-agent-core';
 * import { getModel } from '@mariozechner/pi-ai';
 * import { createMastraOM } from '@mastra/pi';
 * import { PgStore } from '@mastra/pg';
 *
 * const store = new PgStore({ connectionString: process.env.DATABASE_URL });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * const om = createMastraOM({
 *   storage,
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   observation: { messageTokens: 30_000 },
 * });
 *
 * const sessionId = 'session-1';
 * const agent = new Agent({
 *   initialState: {
 *     systemPrompt: await om.wrapSystemPrompt('You are helpful.', sessionId),
 *     model: getModel('anthropic', 'claude-sonnet-4-20250514'),
 *   },
 *   transformContext: om.createTransformContext(sessionId),
 * });
 * ```
 *
 * @example Minimal with defaults
 * ```ts
 * const om = createMastraOM({ storage });
 * ```
 */
export function createMastraOM(options: CreateMastraOMOptions): MastraOMIntegration {
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

  function createTransformContext(
    sessionId: string,
    hooks?: ObserveHooks,
  ): NonNullable<AgentOptions['transformContext']> {
    return async (messages: AgentMessage[]) => {
      const mastraMessages = convertMessages(messages, sessionId);

      if (mastraMessages.length > 0) {
        await om.observe({ threadId: sessionId, messages: mastraMessages, hooks });
      }

      const record = await om.getRecord(sessionId);
      if (record?.lastObservedAt) {
        const lastObservedAt = new Date(record.lastObservedAt);
        return messages.filter(msg => {
          const timestamp = (msg as unknown as PiMessage).timestamp;
          if (!timestamp) return true;
          return new Date(timestamp) > lastObservedAt;
        });
      }

      return messages;
    };
  }

  async function getSystemPromptBlock(sessionId: string): Promise<string> {
    const observations = await om.getObservations(sessionId);
    if (!observations) return '';

    const optimized = optimizeObservationsForContext(observations);
    return `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${optimized}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}\n\n${OBSERVATION_CONTINUATION_HINT}`;
  }

  async function wrapSystemPrompt(basePrompt: string, sessionId: string): Promise<string> {
    const block = await getSystemPromptBlock(sessionId);
    return block ? `${basePrompt}\n\n${block}` : basePrompt;
  }

  async function getStatus(sessionId: string, messages?: AgentMessage[]): Promise<string> {
    const record = await om.getRecord(sessionId);
    if (!record) {
      return 'No Observational Memory record found for this session.';
    }

    const omConfig = om.config;
    const obsThreshold = resolveThreshold(omConfig.observation.messageTokens);
    const refThreshold = resolveThreshold(omConfig.reflection.observationTokens);
    const obsTokens = record.observationTokenCount ?? 0;

    let unobservedTokens = record.pendingMessageTokens ?? 0;
    if (messages) {
      const mastraMessages = convertMessages(messages, sessionId);
      const unobserved = record.lastObservedAt
        ? mastraMessages.filter(m => m.createdAt > new Date(record.lastObservedAt!))
        : mastraMessages;
      tokenCounter ??= new TokenCounter();
      unobservedTokens = tokenCounter.countMessages(unobserved);
    }

    return [
      `Observational Memory`,
      `Scope: ${record.scope}  |  Generations: ${record.generationCount ?? 0}`,
      ``,
      `── Observation ──────────────────────────────`,
      `Unobserved: ${formatTokens(unobservedTokens)} / ${formatTokens(obsThreshold)} tokens`,
      progressBar(unobservedTokens, obsThreshold),
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

  async function getObservations(sessionId: string): Promise<string | undefined> {
    return om.getObservations(sessionId);
  }

  async function initSession(sessionId: string): Promise<void> {
    await om.getOrCreateRecord(sessionId);
  }

  return {
    om,
    createTransformContext,
    getSystemPromptBlock,
    wrapSystemPrompt,
    getStatus,
    getObservations,
    initSession,
  };
}

// ---------------------------------------------------------------------------
// Convenience: File-based config + LibSQLStore
// ---------------------------------------------------------------------------

export interface CreateMastraOMFromConfigOptions {
  /** Working directory for config file and default storage path. @default process.cwd() */
  cwd?: string;
  /** Override config instead of loading from disk. */
  config?: MastraOMConfig;
}

/**
 * Convenience wrapper that reads `.pi/mastra.json` and creates a LibSQLStore.
 *
 * This is the file-system-aware path intended for CLI tools and coding agents.
 * For server deployments or custom storage, use `createMastraOM` directly with
 * your own `MemoryStorage` adapter.
 *
 * @example
 * ```ts
 * import { createMastraOMFromConfig } from '@mastra/pi';
 *
 * const om = await createMastraOMFromConfig({ cwd: process.cwd() });
 * ```
 */
export async function createMastraOMFromConfig(
  options: CreateMastraOMFromConfigOptions = {},
): Promise<MastraOMIntegration> {
  // Lazy-import LibSQLStore so it's not required in the dependency graph
  // when consumers bring their own storage.
  const { LibSQLStore } = await import('@mastra/libsql');

  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? (await loadConfig(cwd));

  const dbRelativePath = config.storagePath ?? DEFAULT_STORAGE_PATH;
  const dbAbsolutePath = join(cwd, dbRelativePath);
  await mkdir(dirname(dbAbsolutePath), { recursive: true });
  const storagePath = `file:${dbAbsolutePath}`;
  const store = new LibSQLStore({ id: 'mastra-om', url: storagePath });
  await store.init();
  const storage = await store.getStore('memory');
  if (!storage) {
    throw new Error(`@mastra/pi: failed to initialize memory storage from ${storagePath}`);
  }

  return createMastraOM({
    storage,
    model: config.model,
    observation: config.observation,
    reflection: config.reflection,
    scope: config.scope,
    shareTokenBudget: config.shareTokenBudget,
  });
}
