/**
 * @mastra/pi/extension
 *
 * Pi coding-agent extension that brings Mastra Observational Memory into
 * pi-coding-agent sessions via the extension API.
 *
 * The extension:
 * - Hooks into `context` to run observation and filter observed messages
 * - Hooks into `before_agent_start` to inject observations into the system prompt
 * - Registers `memory_status` and `memory_observations` diagnostic tools
 * - Eagerly initializes the OM record on `session_start`
 *
 * Storage must be provided explicitly — bring any Mastra storage adapter.
 *
 * @example .pi/extensions/mastra-om.ts
 * ```ts
 * import { createMastraOMExtension } from '@mastra/pi/extension';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const store = new LibSQLStore({ url: 'file:.pi/memory/observations.db' });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * export default createMastraOMExtension({ storage });
 * ```
 */

import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';
import type { MemoryStorage } from '@mastra/core/storage';
import { Type } from '@sinclair/typebox';

import type { MastraOMConfig, MastraOMIntegration, PiMessage } from './index.js';
import { loadConfig, convertMessages, createMastraOM } from './index.js';

export type { MastraOMConfig };

/**
 * Wire all OM hooks and tools into a pi-coding-agent `ExtensionAPI`.
 *
 * Accepts the full `MastraOMIntegration` so it can reuse `getSystemPromptBlock`,
 * `getStatus`, and `getObservations` rather than duplicating that logic.
 *
 * @internal Exported for testing — not part of the public API contract.
 */
export function registerExtension(api: ExtensionAPI, integration: MastraOMIntegration): void {
  // ---------------------------------------------------------------------------
  // Session initialization — eagerly create OM record
  // ---------------------------------------------------------------------------

  api.on('session_start', async (_event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    try {
      await integration.initSession({ sessionId });
    } catch (err) {
      ctx.ui.notify(
        `Mastra OM: failed to initialize — ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Context transform — observe + filter already-observed messages
  // ---------------------------------------------------------------------------

  api.on('context', async (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const messages = event.messages;

    try {
      const mastraMessages = convertMessages(messages, sessionId);
      const cutoff = await integration.observeAndGetCutoff({
        sessionId, messages: mastraMessages, hooks: {
          onObservationStart: () => {
            ctx.ui.notify('Mastra: observing conversation...', 'info');
            ctx.ui.setStatus('mastra-om', 'Observing...');
          },
          onObservationEnd: () => {
            ctx.ui.notify('Mastra: observation complete', 'info');
            ctx.ui.setStatus('mastra-om', undefined);
          },
          onReflectionStart: () => {
            ctx.ui.notify('Mastra: reflecting on observations...', 'info');
            ctx.ui.setStatus('mastra-om', 'Reflecting...');
          },
          onReflectionEnd: () => {
            ctx.ui.notify('Mastra: reflection complete', 'info');
            ctx.ui.setStatus('mastra-om', undefined);
          },
        }
      });

      if (cutoff) {
        const cutoffMs = cutoff.getTime();
        const filtered = messages.filter(msg => {
          const timestamp = (msg as unknown as PiMessage).timestamp;
          if (!timestamp) return true;
          return timestamp > cutoffMs;
        });
        return { messages: filtered };
      }
    } catch (err) {
      ctx.ui.notify(
        `Mastra OM error: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }

    return {};
  });

  // ---------------------------------------------------------------------------
  // System prompt injection (delegates to integration.getSystemPromptBlock)
  // ---------------------------------------------------------------------------

  api.on('before_agent_start', async (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();

    try {
      const block = await integration.getSystemPromptBlock({ sessionId });
      if (!block) return {};

      return {
        systemPrompt: `${event.systemPrompt}\n\n${block}`,
      };
    } catch {
      return {};
    }
  });

  // ---------------------------------------------------------------------------
  // Diagnostic tools (delegate to integration helpers)
  // ---------------------------------------------------------------------------

  api.registerTool({
    name: 'memory_status',
    label: 'Memory Status',
    description:
      'Show Observational Memory progress — how close the session is to the next observation and reflection cycle.',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sessionId = ctx.sessionManager.getSessionId();
      const status = await integration.getStatus({ sessionId });
      return {
        content: [{ type: 'text', text: status }],
        details: {},
      };
    },
  });

  api.registerTool({
    name: 'memory_observations',
    label: 'Memory Observations',
    description: 'Show the current active observations stored in Observational Memory.',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sessionId = ctx.sessionManager.getSessionId();
      const observations = await integration.getObservations({ sessionId });
      return {
        content: [{ type: 'text', text: observations ?? 'No observations stored yet.' }],
        details: {},
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for `createMastraOMExtension`.
 */
export interface CreateMastraOMExtensionOptions {
  /**
   * Storage adapter for persisting observations.
   *
   * Bring any Mastra storage provider — LibSQL, Postgres, etc.
   */
  storage: MemoryStorage;

  /**
   * Override config instead of (or merged with) loading from disk.
   * When provided alongside `.pi/mastra.json`, values are shallow-merged
   * with overrides taking precedence.
   */
  config?: MastraOMConfig;
}

/**
 * Create an extension factory for pi-coding-agent with explicit storage.
 *
 * Loads config from `.pi/mastra.json` (if present), merges with any
 * provided overrides, and registers all OM hooks and tools.
 *
 * @example .pi/extensions/mastra-om.ts
 * ```ts
 * import { createMastraOMExtension } from '@mastra/pi/extension';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const store = new LibSQLStore({ url: 'file:.pi/memory/observations.db' });
 * await store.init();
 * const storage = await store.getStore('memory');
 *
 * export default createMastraOMExtension({ storage });
 * ```
 *
 * @example With config overrides
 * ```ts
 * export default createMastraOMExtension({
 *   storage,
 *   config: {
 *     model: 'anthropic/claude-sonnet-4-20250514',
 *     observation: { messageTokens: 50_000 },
 *   },
 * });
 * ```
 */
export function createMastraOMExtension(options: CreateMastraOMExtensionOptions): ExtensionFactory {
  return async (api: ExtensionAPI) => {
    const cwd = process.cwd();

    let config: MastraOMConfig;
    try {
      const diskConfig = await loadConfig(cwd);
      config = options.config ? { ...diskConfig, ...options.config } : diskConfig;
    } catch {
      config = options.config ?? {};
    }

    const integration = createMastraOM({
      storage: options.storage,
      model: config.model,
      observation: config.observation,
      reflection: config.reflection,
      scope: config.scope,
      shareTokenBudget: config.shareTokenBudget,
    });

    registerExtension(api, integration);
  };
}
