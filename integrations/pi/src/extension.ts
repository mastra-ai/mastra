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
 * @example .pi/extensions/mastra-om.ts
 * ```ts
 * import { mastraOMExtension } from '@mastra/pi/extension';
 * export default mastraOMExtension;
 * ```
 *
 * @example Programmatic registration with overrides
 * ```ts
 * import { createMastraOMExtension } from '@mastra/pi/extension';
 *
 * export default createMastraOMExtension({
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   observation: { messageTokens: 50_000 },
 * });
 * ```
 */

import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';

import type { MastraOMConfig, MastraOMIntegration, PiMessage } from './index.js';
import { loadConfig, convertMessages, createMastraOMFromConfig } from './index.js';

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
 * Default extension factory for pi-coding-agent.
 *
 * Loads config from `.pi/mastra.json`, creates a LibSQLStore, and registers
 * all OM hooks and tools. This is the file-system-aware path — appropriate
 * for the coding agent which always has a `cwd`.
 *
 * @example .pi/extensions/mastra-om.ts
 * ```ts
 * import { mastraOMExtension } from '@mastra/pi/extension';
 * export default mastraOMExtension;
 * ```
 */
export const mastraOMExtension: ExtensionFactory = async (api: ExtensionAPI) => {
  const integration = await createMastraOMFromConfig({ cwd: process.cwd() });
  registerExtension(api, integration);
};

/**
 * Create an extension factory with custom config overrides.
 *
 * Shallow-merges disk config (`.pi/mastra.json`) with provided overrides —
 * override values take precedence. Nested objects like `observation` and
 * `reflection` are replaced entirely, not deep-merged. If no disk config
 * exists, the overrides are used as-is.
 *
 * @example
 * ```ts
 * import { createMastraOMExtension } from '@mastra/pi/extension';
 *
 * export default createMastraOMExtension({
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   observation: { messageTokens: 50_000 },
 * });
 * ```
 */
export function createMastraOMExtension(overrideConfig?: MastraOMConfig): ExtensionFactory {
  return async (api: ExtensionAPI) => {
    const cwd = process.cwd();

    let config: MastraOMConfig | undefined;
    if (overrideConfig) {
      try {
        const diskConfig = await loadConfig(cwd);
        config = { ...diskConfig, ...overrideConfig };
      } catch {
        config = overrideConfig;
      }
    }

    const integration = await createMastraOMFromConfig({ cwd, config });
    registerExtension(api, integration);
  };
}

/**
 * Convenience default export for direct use in `.pi/extensions/` files.
 */
export default mastraOMExtension;
