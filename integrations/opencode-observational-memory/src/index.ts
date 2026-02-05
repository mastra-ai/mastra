import type { Plugin, PluginInput, Hooks } from '@opencode-ai/plugin';
import type { Part } from '@opencode-ai/sdk';
// @ts-ignore - tool is exported from @opencode-ai/plugin but types aren't resolving correctly
import { tool } from '@opencode-ai/plugin';

import {
  getObservations,
  getWorkingMemory,
  ensureThread,
  saveMessages,
  getMemoryStore,
} from './services/memory.js';
import { formatContextForPrompt, formatObservationsForCompaction } from './services/context.js';
import { getTags } from './services/tags.js';
import { stripPrivateContent, isFullyPrivate } from './services/privacy.js';
import { log } from './services/logger.js';

import { isConfigured, CONFIG } from './config.js';

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

const MEMORY_KEYWORD_PATTERN = new RegExp(`\\b(${CONFIG.keywordPatterns.join('|')})\\b`, 'i');

const MEMORY_NUDGE_MESSAGE = `[MEMORY TRIGGER DETECTED]
The user mentioned remembering something. The observational memory system will automatically capture important information from this conversation. No action needed.`;

function removeCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_PATTERN, '').replace(INLINE_CODE_PATTERN, '');
}

function detectMemoryKeyword(text: string): boolean {
  const textWithoutCode = removeCodeBlocks(text);
  return MEMORY_KEYWORD_PATTERN.test(textWithoutCode);
}

/**
 * OpenCode plugin for Mastra Observational Memory
 *
 * Provides persistent memory across coding sessions using Mastra's
 * Observational Memory system with local SQLite storage.
 */
export const ObservationalMemoryPlugin: Plugin = async (ctx: PluginInput) => {
  const { directory } = ctx;
  const tags = getTags(directory);
  const injectedSessions = new Set<string>();
  const sessionThreads = new Map<string, string>();

  log('Plugin init', { directory, tags, configured: isConfigured() });

  if (!isConfigured()) {
    log('Plugin disabled - no model configured');
  }

  const hooks: Hooks = {
    'chat.message': async (input, output) => {
      if (!isConfigured()) return;

      const start = Date.now();

      try {
        const textParts = output.parts.filter(
          (p): p is Part & { type: 'text'; text: string } => p.type === 'text',
        );

        if (textParts.length === 0) {
          log('chat.message: no text parts found');
          return;
        }

        const userMessage = textParts.map(p => p.text).join('\n');

        if (!userMessage.trim()) {
          log('chat.message: empty message, skipping');
          return;
        }

        log('chat.message: processing', {
          messagePreview: userMessage.slice(0, 100),
          partsCount: output.parts.length,
          textPartsCount: textParts.length,
        });

        // Ensure we have a thread for this session
        let threadId = sessionThreads.get(input.sessionID);
        if (!threadId) {
          threadId = await ensureThread(input.sessionID, tags.resourceId);
          sessionThreads.set(input.sessionID, threadId);
        }

        // Save the user message to memory (this triggers OM processing)
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await saveMessages([
          {
            id: messageId,
            role: 'user',
            content: stripPrivateContent(userMessage),
            threadId,
            resourceId: tags.resourceId,
          },
        ]);

        // Detect memory keywords and add nudge
        if (detectMemoryKeyword(userMessage)) {
          log('chat.message: memory keyword detected');
          const nudgePart: Part = {
            id: `om-nudge-${Date.now()}`,
            sessionID: input.sessionID,
            messageID: output.message.id,
            type: 'text',
            text: MEMORY_NUDGE_MESSAGE,
            synthetic: true,
          };
          output.parts.push(nudgePart);
        }

        // Only inject context on first message of session
        const isFirstMessage = !injectedSessions.has(input.sessionID);

        if (isFirstMessage) {
          injectedSessions.add(input.sessionID);

          // Fetch observations and working memory
          const [observations, workingMemory] = await Promise.all([
            getObservations(tags.resourceId, threadId),
            getWorkingMemory(threadId, tags.resourceId),
          ]);

          const memoryContext = formatContextForPrompt(observations, workingMemory);

          if (memoryContext) {
            const contextPart: Part = {
              id: `om-context-${Date.now()}`,
              sessionID: input.sessionID,
              messageID: output.message.id,
              type: 'text',
              text: memoryContext,
              synthetic: true,
            };

            output.parts.unshift(contextPart);

            const duration = Date.now() - start;
            log('chat.message: context injected', {
              duration,
              contextLength: memoryContext.length,
            });
          }
        }
      } catch (error) {
        log('chat.message: ERROR', { error: String(error) });
      }
    },

    // Hook into session compaction to inject observational memory context
    'experimental.session.compacting': async (input, output) => {
      if (!isConfigured()) return;

      try {
        log('session.compacting: injecting observations');

        const observations = await getObservations(tags.resourceId);
        const observationContext = formatObservationsForCompaction(observations);

        if (observationContext) {
          output.context.push(observationContext);
          log('session.compacting: context injected', {
            length: observationContext.length,
          });
        }
      } catch (error) {
        log('session.compacting: ERROR', { error: String(error) });
      }
    },

    tool: {
      'observational-memory': tool({
        description:
          'View and manage Mastra Observational Memory. Use "status" to check memory status, "get-observations" to view current observations, "list-threads" to see conversation threads.',
        args: {
          mode: tool.schema
            .enum([
              'status',
              'get-observations',
              'list-threads',
              'help',
            ])
            .optional(),
          threadId: tool.schema.string().optional(),
          limit: tool.schema.number().optional(),
        },
        async execute(args: {
          mode?: string;
          threadId?: string;
          limit?: number;
        }) {
          if (!isConfigured()) {
            return JSON.stringify({
              success: false,
              error: 'Observational Memory is not configured. Set OM_MODEL environment variable.',
            });
          }

          const mode = args.mode || 'help';

          try {
            switch (mode) {
              case 'help': {
                return JSON.stringify({
                  success: true,
                  message: 'Observational Memory Usage Guide',
                  commands: [
                    {
                      command: 'status',
                      description: 'Check memory system status',
                      args: [],
                    },
                    {
                      command: 'get-observations',
                      description: 'Get current observational memory',
                      args: ['threadId?'],
                    },
                    {
                      command: 'list-threads',
                      description: 'List conversation threads',
                      args: ['limit?'],
                    },
                  ],
                  info: {
                    resourceId: tags.resourceId,
                    projectTag: tags.project,
                    userTag: tags.user,
                    dbPath: CONFIG.dbPath,
                    model: CONFIG.model,
                    scope: CONFIG.scope,
                  },
                });
              }

              case 'status': {
                const memoryStore = await getMemoryStore();
                if (!memoryStore) {
                  return JSON.stringify({
                    success: false,
                    error: 'Memory store not available',
                  });
                }

                const record = await memoryStore.getObservationalMemory(
                  CONFIG.scope === 'resource' ? null : (args.threadId ?? null),
                  tags.resourceId,
                );

                return JSON.stringify({
                  success: true,
                  status: {
                    hasRecord: !!record,
                    scope: CONFIG.scope,
                    resourceId: tags.resourceId,
                    model: CONFIG.model,
                    dbPath: CONFIG.dbPath,
                    ...(record
                      ? {
                          originType: record.originType,
                          generationCount: record.generationCount,
                          totalTokensObserved: record.totalTokensObserved,
                          observationTokenCount: record.observationTokenCount,
                          isObserving: record.isObserving,
                          isReflecting: record.isReflecting,
                          lastObservedAt: record.lastObservedAt,
                        }
                      : {}),
                  },
                });
              }

              case 'get-observations': {
                const observations = await getObservations(tags.resourceId, args.threadId);

                if (!observations) {
                  return JSON.stringify({
                    success: true,
                    message: 'No observations found',
                    hasObservations: false,
                  });
                }

                return JSON.stringify({
                  success: true,
                  hasObservations: true,
                  observations: observations.slice(0, 5000), // Limit output size
                  truncated: observations.length > 5000,
                });
              }

              case 'list-threads': {
                const memoryStore = await getMemoryStore();
                if (!memoryStore) {
                  return JSON.stringify({
                    success: false,
                    error: 'Memory store not available',
                  });
                }

                const result = await memoryStore.listThreads({
                  filter: { resourceId: tags.resourceId },
                  perPage: args.limit || 20,
                });

                return JSON.stringify({
                  success: true,
                  count: result.threads.length,
                  threads: result.threads.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    createdAt: t.createdAt,
                    updatedAt: t.updatedAt,
                  })),
                });
              }

              default:
                return JSON.stringify({
                  success: false,
                  error: `Unknown mode: ${mode}`,
                });
            }
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    },

    event: async (input: { event: { type: string; properties?: unknown } }) => {
      // Handle session deletion - clean up session thread mapping
      if (input.event.type === 'session.deleted') {
        const props = input.event.properties as { info?: { id?: string } } | undefined;
        const sessionId = props?.info?.id;
        if (sessionId) {
          sessionThreads.delete(sessionId);
          injectedSessions.delete(sessionId);
          log('session.deleted: cleaned up', { sessionId });
        }
      }
    },
  };

  return hooks;
};

// Default export for OpenCode plugin system
export default ObservationalMemoryPlugin;

// Re-export types and utilities
export { isConfigured, CONFIG } from './config.js';
export { getTags } from './services/tags.js';
export { getMemory, getObservations, getWorkingMemory } from './services/memory.js';
export type * from './types/index.js';
