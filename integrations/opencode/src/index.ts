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

import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ObservationalMemoryOptions } from '@mastra/core/memory';
import { LibSQLStore } from '@mastra/libsql';
import {
  ObservationalMemory,
  TokenCounter,
  optimizeObservationsForContext,
  OBSERVATION_CONTINUATION_HINT,
  OBSERVATION_CONTEXT_PROMPT,
  OBSERVATION_CONTEXT_INSTRUCTIONS,
} from '@mastra/memory/processors';
import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import type { Message, Part } from '@opencode-ai/sdk';

export type { ObservationalMemoryOptions };

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

const CONFIG_FILE = '.opencode/mastra.json';
const DEFAULT_STORAGE_PATH = '.opencode/memory/observations.db';

async function loadConfig(directory: string): Promise<MastraOMPluginConfig> {
  try {
    const configPath = join(directory, CONFIG_FILE);
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw) as MastraOMPluginConfig;
  } catch {
    // No config file or invalid JSON — use defaults
    return {};
  }
}

/** Convert opencode messages to MastraDBMessage format.
 * Preserves all part types including tool invocations, files, images, and reasoning.
 */
function convertMessages(messages: { info: Message; parts: Part[] }[], sessionId: string) {
  return messages
    .map(({ info, parts }) => {
      // Convert ALL part types, not just text
      // Use type assertions since Part union type is restrictive
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
        // opencode timestamps are already in milliseconds (JavaScript Date)
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

function progressBar(current: number, total: number, width = 20): string {
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(pct * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(pct * 100).toFixed(1)}%`;
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function resolveThreshold(t: number | { min: number; max: number }): number {
  return typeof t === 'number' ? t : t.max;
}

export const MastraPlugin: Plugin = async ctx => {
  // Load config from .opencode/mastra.json
  const config = await loadConfig(ctx.directory);

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

  // Storage: SQLite via Mastra's LibSQLStore
  const dbRelativePath = config.storagePath ?? DEFAULT_STORAGE_PATH;
  const dbAbsolutePath = join(ctx.directory, dbRelativePath);
  await mkdir(dirname(dbAbsolutePath), { recursive: true });
  const storagePath = `file:${dbAbsolutePath}`;
  const store = new LibSQLStore({ id: 'mastra-om', url: storagePath });
  await store.init();
  const storage = await store.getStore('memory');
  if (!storage) {
    throw new Error(`@mastra/opencode: failed to initialize memory storage from ${storagePath}`);
  }

  // Observational Memory: uses Mastra's full OM class
  // Model string IDs (e.g., 'google/gemini-2.5-flash') are resolved by Mastra's provider registry.
  const om = new ObservationalMemory({
    storage,
    model: config.model,
    observation: config.observation,
    reflection: config.reflection,
    scope: config.scope,
    shareTokenBudget: config.shareTokenBudget,
  });

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
    // so diagnostic tools work immediately (before first observation cycle).
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const sessionId = event.properties.info.id;
        try {
          await om.getOrCreateRecord(sessionId);
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
    // This is the core integration point — observe and shape context in one pass:
    // 1. Convert opencode messages → MastraDBMessage format
    // 2. Run observation if threshold is met (with toast notifications)
    // 3. Inject observation summary and filter out already-observed messages
    'experimental.chat.messages.transform': async (_input, output) => {
      const sessionId = output.messages[0]?.info.sessionID;
      if (!sessionId) return;

      // Ensure API keys are resolved before observation needs a model
      await resolveCredentials();

      try {
        const mastraMessages = convertMessages(output.messages, sessionId);

        // Run observation — OM filters for unobserved messages and checks thresholds
        if (mastraMessages.length > 0) {
          await om.observe({
            threadId: sessionId,
            messages: mastraMessages,
            hooks: {
              onObservationStart: () => {
                void ctx.client.tui.showToast({
                  body: {
                    title: 'Mastra',
                    message: 'Observing conversation...',
                    variant: 'info',
                    duration: 10000,
                  },
                });
              },
              onObservationEnd: () => {
                void ctx.client.tui.showToast({
                  body: {
                    title: 'Mastra',
                    message: 'Observation complete',
                    variant: 'success',
                    duration: 3000,
                  },
                });
              },
              onReflectionStart: () => {
                void ctx.client.tui.showToast({
                  body: {
                    title: 'Mastra',
                    message: 'Reflecting on observations...',
                    variant: 'info',
                    duration: 10000,
                  },
                });
              },
              onReflectionEnd: () => {
                void ctx.client.tui.showToast({
                  body: {
                    title: 'Mastra',
                    message: 'Reflection complete',
                    variant: 'success',
                    duration: 3000,
                  },
                });
              },
            },
          });
        }

        // Discard already-observed messages — observations replace them
        const record = await om.getRecord(sessionId);
        if (record?.lastObservedAt) {
          const lastObservedAt = new Date(record.lastObservedAt);
          output.messages = output.messages.filter(({ info }) => {
            // opencode timestamps are already in milliseconds
            const msgTime = new Date(info.time.created);
            return msgTime > lastObservedAt;
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

    // Hook: Inject observations into the system prompt so the model has compressed context.
    'experimental.chat.system.transform': async (input, output) => {
      const sessionId = input.sessionID;
      if (!sessionId) return;

      try {
        const observations = await om.getObservations(sessionId);
        if (!observations) return;

        const optimized = optimizeObservationsForContext(observations);
        output.system.push(
          `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${optimized}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}\n\n${OBSERVATION_CONTINUATION_HINT}`,
        );
      } catch {
        // Non-fatal — model proceeds without observations
      }
    },

    // Diagnostic tools for inspecting OM state
    tool: {
      memory_status: tool({
        description: 'Show Observational Memory progress — how close the session is to the next observation and reflection cycle.',
        args: {},
        async execute(_args, context) {
          const threadId = context.sessionID;
          const record = await om.getRecord(threadId);
          if (!record) {
            return 'No Observational Memory record found for this session.';
          }

          const omConfig = om.config;
          const obsThreshold = resolveThreshold(omConfig.observation.messageTokens);
          const refThreshold = resolveThreshold(omConfig.reflection.observationTokens);
          const obsTokens = record.observationTokenCount ?? 0;

          // Fetch live messages to compute unobserved token count
          const tokenCounter = new TokenCounter();
          let unobservedTokens = 0;
          try {
            const resp = await ctx.client.session.messages({ path: { id: threadId } });
            if (resp.data) {
              const allMastra = convertMessages(resp.data, threadId);
              const unobserved = record.lastObservedAt
                ? allMastra.filter(m => m.createdAt > new Date(record.lastObservedAt!))
                : allMastra;
              unobservedTokens = tokenCounter.countMessages(unobserved);
            }
          } catch {
            // Fall back to record's pending count
            unobservedTokens = record.pendingMessageTokens ?? 0;
          }

          const lines = [
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
          ];

          return lines.join('\n');
        },
      }),

      memory_observations: tool({
        description: 'Show the current active observations stored in Observational Memory.',
        args: {},
        async execute(_args, context) {
          const threadId = context.sessionID;
          const observations = await om.getObservations(threadId);
          return observations ?? 'No observations stored yet.';
        },
      }),
    },
  };
};
