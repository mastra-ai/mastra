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
 * (LibSQL, Postgres, in-memory, etc.).
 *
 * @example
 * ```ts
 * import { Agent } from '@mariozechner/pi-agent-core';
 * import { createMastraOM, loadConfig } from '@mastra/pi';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const config = await loadConfig(process.cwd());
 * const store = new LibSQLStore({ url: `file:${config.storagePath ?? '.pi/memory/observations.db'}` });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * const om = createMastraOM({ storage, ...config });
 * const sessionId = 'session-1';
 *
 * const agent = new Agent({
 *   initialState: {
 *     systemPrompt: await om.wrapSystemPrompt({ basePrompt: 'You are helpful.', sessionId }),
 *     model: getModel('anthropic', 'claude-sonnet-4-20250514'),
 *   },
 *   transformContext: om.createTransformContext({ sessionId }),
 * });
 * ```
 */

import { join } from 'node:path';
import type { AgentMessage, AgentOptions } from '@mariozechner/pi-agent-core';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservationalMemoryOptions } from '@mastra/core/memory';
import type {
  ObserveHooks,
  OMIntegration,
  OMIntegrationOptions,
  OMFileConfig,
} from '@mastra/memory/integration';
import {
  createOMIntegration,
  loadOMConfig,
} from '@mastra/memory/integration';

// ---------------------------------------------------------------------------
// Re-exports from shared module
// ---------------------------------------------------------------------------

export type { ObservationalMemoryOptions };
export type { MemoryStorage } from '@mastra/core/storage';
export type { ObserveHooks, ObservationalMemoryConfig, OMIntegration, OMIntegrationOptions } from '@mastra/memory/integration';
export {
  ObservationalMemory,
  TokenCounter,
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
  progressBar,
  formatTokens,
  resolveThreshold,
  buildObservationBlock,
  formatOMStatus,
  createOMIntegration,
  loadOMConfig,
} from '@mastra/memory/integration';

// ---------------------------------------------------------------------------
// Pi-specific Config
// ---------------------------------------------------------------------------

/**
 * Config read from `.pi/mastra.json`.
 *
 * Currently inherits all fields from `OMFileConfig` (including `storagePath`).
 * Extend with Pi-specific config fields as needed.
 */
export interface MastraOMConfig extends OMFileConfig {}

const CONFIG_FILE = '.pi/mastra.json';

/**
 * Load OM config from `.pi/mastra.json`.
 */
export async function loadConfig(directory: string): Promise<MastraOMConfig> {
  return loadOMConfig(join(directory, CONFIG_FILE));
}

// ---------------------------------------------------------------------------
// Pi-specific Message Conversion
// ---------------------------------------------------------------------------

type ContentPart = { type: string;[key: string]: any };

/**
 * Structural type matching Pi's AgentMessage shape.
 * Exported so extension.ts can reuse it for type-safe timestamp filtering.
 */
export interface PiMessage {
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
// Pi-specific Integration (adds createTransformContext on top of OMIntegration)
// ---------------------------------------------------------------------------

/**
 * Options for `createMastraOM`.
 *
 * Same as `OMIntegrationOptions` — accepts any Mastra `MemoryStorage` adapter.
 */
export type CreateMastraOMOptions = OMIntegrationOptions;

/**
 * Extended integration interface with Pi-specific `createTransformContext`.
 */
export interface MastraOMIntegration extends OMIntegration {
  /**
   * Create a `transformContext` compatible with `AgentOptions.transformContext`.
   *
   * Plugs into `new Agent({ transformContext })`.
   * Runs observation on the current messages, then filters out already-observed
   * messages so the model sees observations + recent unobserved turns.
   */
  createTransformContext(params: {
    sessionId: string;
    hooks?: ObserveHooks;
  }): NonNullable<AgentOptions['transformContext']>;
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
 *     systemPrompt: await om.wrapSystemPrompt({ basePrompt: 'You are helpful.', sessionId }),
 *     model: getModel('anthropic', 'claude-sonnet-4-20250514'),
 *   },
 *   transformContext: om.createTransformContext({ sessionId }),
 * });
 * ```
 */
/**
 * Shared helper — builds a `transformContext` closure that converts messages,
 * runs observation, and filters out already-observed messages by timestamp.
 */
function buildTransformContext(
  base: OMIntegration,
  { sessionId, hooks }: { sessionId: string; hooks?: ObserveHooks },
): NonNullable<AgentOptions['transformContext']> {
  return async (messages: AgentMessage[]) => {
    const mastraMessages = convertMessages(messages, sessionId);
    const cutoff = await base.observeAndGetCutoff({ sessionId, messages: mastraMessages, hooks });

    if (cutoff) {
      const cutoffMs = cutoff.getTime();
      return messages.filter(msg => {
        const timestamp = (msg as unknown as PiMessage).timestamp;
        if (!timestamp) return true;
        return timestamp > cutoffMs;
      });
    }

    return messages;
  };
}

export function createMastraOM(options: CreateMastraOMOptions): MastraOMIntegration {
  const base = createOMIntegration(options);
  return {
    ...base,
    createTransformContext: params => buildTransformContext(base, params),
  };
}

