/**
 * @mastra/opencode
 *
 * OpenCode plugin that brings Mastra Observational Memory into opencode sessions.
 *
 * Mastra OM compresses long conversation history into structured observations
 * using an Observer (extract) and Reflector (condense) architecture.
 *
 * Configuration is read from .opencode/mastra.json in the project root.
 *
 * @example .opencode/mastra.json
 * ```json
 * {
 *   "model": "google/gemini-2.5-flash",
 *   "observation": { "messageTokens": 20000 },
 *   "reflection": { "observationTokens": 90000 },
 *   "storagePath": ".opencode/memory/observations.db"
 * }
 * ```
 */

import type { ObservationalMemoryOptions } from '@mastra/core/memory';
import {
  createOMFromConfig,
  type OMIntegration,
} from '@mastra/memory/integration';
import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import type { Message, Part } from '@opencode-ai/sdk';

export type { ObservationalMemoryOptions };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Plugin config read from .opencode/mastra.json.
 * Extends Mastra's ObservationalMemoryOptions with opencode-specific fields.
 *
 * In the opencode plugin context, pass string model IDs
 * (e.g., 'google/gemini-2.5-flash') — Mastra's provider registry resolves them.
 */
export interface MastraOMPluginConfig extends ObservationalMemoryOptions {
  /**
   * Path to the SQLite database file for observation storage.
   * Relative to the project root.
   *
   * @default '.opencode/memory/observations.db'
   */
  storagePath?: string;
}

const CONFIG_PATH = '.opencode/mastra.json';
const DEFAULT_STORAGE_PATH = '.opencode/memory/observations.db';

// ---------------------------------------------------------------------------
// Message Conversion (opencode-specific)
// ---------------------------------------------------------------------------

/** Convert opencode messages to MastraDBMessage format.
 * Preserves all part types including tool invocations, files, images, and reasoning.
 */
function convertMessages(messages: { info: Message; parts: Part[] }[], sessionId: string) {
  return messages
    .map(({ info, parts }) => {
      const convertedParts = parts
        .map((part): any => {
          const p = part as any;
          const type = p.type as string;

          if (type === 'text' && p.text) {
            return { type: 'text', text: p.text };
          }

          if (type === 'tool-invocation') {
            return {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: p.toolCallId,
                toolName: p.toolName,
                args: p.args,
                result: p.result,
                state: p.state,
              },
            };
          }

          if (type === 'file') {
            return {
              type: 'file',
              url: p.url,
              mediaType: p.mediaType,
            };
          }

          if (type === 'image') {
            return {
              type: 'image',
              image: p.image,
            };
          }

          if (type === 'reasoning' && p.reasoning) {
            return { type: 'reasoning', reasoning: p.reasoning };
          }

          // Skip unknown or internal part types
          if (type?.startsWith('data-om-')) {
            return null;
          }

          return null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (convertedParts.length === 0) return null;
      if (info.role !== 'user' && info.role !== 'assistant') return null;

      return {
        id: info.id,
        role: info.role,
        createdAt: new Date(info.time.created),
        threadId: sessionId,
        resourceId: sessionId,
        content: {
          format: 2 as const,
          parts: convertedParts,
        },
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const MastraPlugin: Plugin = async ctx => {
  // Initialize OM via the shared module — handles config loading + LibSQL setup
  let integration: OMIntegration;
  try {
    integration = await createOMFromConfig({
      cwd: ctx.directory,
      configPath: CONFIG_PATH,
      defaultStoragePath: DEFAULT_STORAGE_PATH,
    });
  } catch (err) {
    void ctx.client.tui.showToast({
      body: {
        title: 'Mastra',
        message: `Failed to initialize Observational Memory: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'error',
        duration: 5000,
      },
    });
    // Return a no-op plugin if initialization fails
    return {};
  }

  // Resolve API keys from opencode's provider store (deferred so it doesn't block plugin init).
  // .env takes priority — opencode keys only fill in gaps.
  let credentialsReady = false;
  const resolveCredentials = async () => {
    if (credentialsReady) return;
    try {
      const providersResponse = await ctx.client.config.providers();
      if (providersResponse.data) {
        for (const provider of providersResponse.data.providers) {
          if (provider.key && provider.env) {
            for (const envVar of provider.env) {
              if (!process.env[envVar]) {
                process.env[envVar] = provider.key;
              }
            }
          }
        }
      }
    } catch {
      // Credentials not available from opencode — rely on .env
    }
    credentialsReady = true;
  };

  // Notify user that OM is active (delayed to let TUI initialize)
  setTimeout(() => {
    void ctx.client.tui.showToast({
      body: {
        title: 'Mastra',
        message: 'Observational Memory activated',
        variant: 'success',
        duration: 3000,
      },
    });
  }, 500);

  return {
    // Hook: Eagerly initialize OM record on session creation
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const sessionId = event.properties.info.id;
        try {
          await integration.initSession({ sessionId });
        } catch (err) {
          void ctx.client.tui.showToast({
            body: {
              title: 'Mastra',
              message: `Failed to initialize Observational Memory: ${err instanceof Error ? err.message : String(err)}`,
              variant: 'error',
              duration: 5000,
            },
          });
        }
      }
    },

    // Hook: Transform messages before they reach the model.
    'experimental.chat.messages.transform': async (_input, output) => {
      const sessionId = output.messages[0]?.info.sessionID;
      if (!sessionId) return;

      // Ensure API keys are resolved before observation needs a model
      await resolveCredentials();

      try {
        const mastraMessages = convertMessages(output.messages, sessionId);
        const cutoff = await integration.observeAndGetCutoff({
          sessionId, messages: mastraMessages, hooks: {
            onObservationStart: () => {
              void ctx.client.tui.showToast({
                body: { title: 'Mastra', message: 'Observing conversation...', variant: 'info', duration: 10000 },
              });
            },
            onObservationEnd: () => {
              void ctx.client.tui.showToast({
                body: { title: 'Mastra', message: 'Observation complete', variant: 'success', duration: 3000 },
              });
            },
            onReflectionStart: () => {
              void ctx.client.tui.showToast({
                body: { title: 'Mastra', message: 'Reflecting on observations...', variant: 'info', duration: 10000 },
              });
            },
            onReflectionEnd: () => {
              void ctx.client.tui.showToast({
                body: { title: 'Mastra', message: 'Reflection complete', variant: 'success', duration: 3000 },
              });
            },
          }
        });

        // Discard already-observed messages — observations replace them
        if (cutoff) {
          output.messages = output.messages.filter(({ info }) => {
            const msgTime = new Date(info.time.created);
            return msgTime > cutoff;
          });
        }
      } catch (err) {
        void ctx.client.tui.showToast({
          body: {
            title: 'Mastra',
            message: `Observational Memory error: ${err instanceof Error ? err.message : String(err)}`,
            variant: 'error',
            duration: 5000,
          },
        });
      }
    },

    // Hook: Inject observations into the system prompt
    'experimental.chat.system.transform': async (input, output) => {
      const sessionId = input.sessionID;
      if (!sessionId) return;

      try {
        const block = await integration.getSystemPromptBlock({ sessionId });
        if (block) {
          output.system.push(block);
        }
      } catch {
        // Non-fatal — model proceeds without observations
      }
    },

    // Diagnostic tools
    tool: {
      memory_status: tool({
        description: 'Show Observational Memory progress — how close the session is to the next observation and reflection cycle.',
        args: {},
        async execute(_args, context) {
          const threadId = context.sessionID;

          // Try to compute live unobserved token count from session messages
          let liveMessages;
          try {
            const resp = await ctx.client.session.messages({ path: { id: threadId } });
            if (resp.data) {
              liveMessages = convertMessages(resp.data, threadId);
            }
          } catch {
            // Fall back to record's pending count
          }

          return integration.getStatus({ sessionId: threadId, messages: liveMessages });
        },
      }),

      memory_observations: tool({
        description: 'Show the current active observations stored in Observational Memory.',
        args: {},
        async execute(_args, context) {
          const threadId = context.sessionID;
          const observations = await integration.getObservations({ sessionId: threadId });
          return observations ?? 'No observations stored yet.';
        },
      }),
    },
  };
};
