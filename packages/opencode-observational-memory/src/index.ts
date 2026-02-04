import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Part } from '@opencode-ai/sdk';
// @ts-ignore - tool is exported from @opencode-ai/plugin but types aren't being resolved correctly
import { tool } from '@opencode-ai/plugin';

import { mastraClient } from './services/client.js';
import { formatContextForPrompt } from './services/context.js';
import { getTags } from './services/tags.js';
import { stripPrivateContent, isFullyPrivate } from './services/privacy.js';
import { log } from './services/logger.js';

import { isConfigured, CONFIG } from './config.js';
import type { MemoryScope, MemoryType } from './types/index.js';

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;

const MEMORY_KEYWORD_PATTERN = new RegExp(`\\b(${CONFIG.keywordPatterns.join('|')})\\b`, 'i');

const MEMORY_NUDGE_MESSAGE = `[MEMORY TRIGGER DETECTED]
The user wants you to remember something. You MUST use the \`observational-memory\` tool with \`mode: "update-working-memory"\` to save this information to the working memory.

Extract the key information the user wants remembered and save it as a concise, searchable note.
- Working memory persists across conversations
- Keep it concise and actionable
- Update existing working memory rather than replacing it entirely

DO NOT skip this step. The user explicitly asked you to remember.`;

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
 * Observational Memory system.
 */
export const ObservationalMemoryPlugin: Plugin = async (ctx: PluginInput) => {
  const { directory } = ctx;
  const tags = getTags(directory);
  const injectedSessions = new Set<string>();

  log('Plugin init', { directory, tags, configured: isConfigured() });

  if (!isConfigured()) {
    log('Plugin disabled - MASTRA_URL or MASTRA_AGENT_ID not set');
  }

  return {
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

          // Fetch observational memory and working memory in parallel
          const [omResult, threadsResult] = await Promise.all([
            mastraClient.getObservationalMemory(tags.resourceId),
            mastraClient.listThreads(tags.resourceId, { perPage: 1 }),
          ]);

          // Get working memory from the most recent thread if it exists
          let workingMemoryResult = null;
          if (threadsResult?.threads.length) {
            const recentThread = threadsResult.threads[0]!;
            workingMemoryResult = await mastraClient.getWorkingMemory(recentThread.id, tags.resourceId);
          }

          const memoryContext = formatContextForPrompt(omResult?.record ?? null, workingMemoryResult);

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

    tool: {
      'observational-memory': tool({
        description:
          'Manage and query Mastra Observational Memory. Use "status" to check memory status, "search" to find relevant memories, "list-threads" to see conversation threads, "get-observations" to view current observations, "get-working-memory" to view working memory, "update-working-memory" to update working memory.',
        args: {
          mode: tool.schema
            .enum([
              'status',
              'search',
              'list-threads',
              'list-messages',
              'get-observations',
              'get-working-memory',
              'update-working-memory',
              'help',
            ])
            .optional(),
          query: tool.schema.string().optional(),
          threadId: tool.schema.string().optional(),
          content: tool.schema.string().optional(),
          limit: tool.schema.number().optional(),
        },
        async execute(args: {
          mode?: string;
          query?: string;
          threadId?: string;
          content?: string;
          limit?: number;
        }) {
          if (!isConfigured()) {
            return JSON.stringify({
              success: false,
              error:
                'MASTRA_URL and MASTRA_AGENT_ID not set. Set these in your environment to use Observational Memory.',
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
                      command: 'search',
                      description: 'Search memories semantically',
                      args: ['query', 'threadId?', 'limit?'],
                    },
                    {
                      command: 'list-threads',
                      description: 'List conversation threads',
                      args: ['limit?'],
                    },
                    {
                      command: 'list-messages',
                      description: 'List messages in a thread',
                      args: ['threadId', 'limit?'],
                    },
                    {
                      command: 'get-observations',
                      description: 'Get current observational memory',
                      args: ['threadId?'],
                    },
                    {
                      command: 'get-working-memory',
                      description: 'Get working memory for a thread',
                      args: ['threadId'],
                    },
                    {
                      command: 'update-working-memory',
                      description: 'Update working memory for a thread',
                      args: ['threadId', 'content'],
                    },
                  ],
                  info: {
                    resourceId: tags.resourceId,
                    projectTag: tags.project,
                    userTag: tags.user,
                  },
                });
              }

              case 'status': {
                const status = await mastraClient.getMemoryStatus(tags.resourceId, args.threadId);
                if (!status) {
                  return JSON.stringify({
                    success: false,
                    error: 'Failed to get memory status',
                  });
                }

                return JSON.stringify({
                  success: true,
                  status: {
                    memoryEnabled: status.result,
                    observationalMemory: status.observationalMemory,
                    resourceId: tags.resourceId,
                  },
                });
              }

              case 'search': {
                if (!args.query) {
                  return JSON.stringify({
                    success: false,
                    error: 'query parameter is required for search mode',
                  });
                }

                const result = await mastraClient.searchMemory(
                  args.query,
                  tags.resourceId,
                  args.threadId,
                  args.limit || CONFIG.maxSearchResults,
                );

                if (!result) {
                  return JSON.stringify({
                    success: false,
                    error: 'Failed to search memories',
                  });
                }

                return JSON.stringify({
                  success: true,
                  query: args.query,
                  count: result.count,
                  searchScope: result.searchScope,
                  searchType: result.searchType,
                  results: result.results.slice(0, args.limit || CONFIG.maxSearchResults),
                });
              }

              case 'list-threads': {
                const result = await mastraClient.listThreads(tags.resourceId, {
                  perPage: args.limit || 20,
                });

                if (!result) {
                  return JSON.stringify({
                    success: false,
                    error: 'Failed to list threads',
                  });
                }

                return JSON.stringify({
                  success: true,
                  count: result.threads.length,
                  totalPages: result.totalPages,
                  threads: result.threads.map(t => ({
                    id: t.id,
                    title: t.title,
                    createdAt: t.createdAt,
                    updatedAt: t.updatedAt,
                  })),
                });
              }

              case 'list-messages': {
                if (!args.threadId) {
                  return JSON.stringify({
                    success: false,
                    error: 'threadId parameter is required for list-messages mode',
                  });
                }

                const result = await mastraClient.listMessages(args.threadId, tags.resourceId, {
                  perPage: args.limit || 20,
                });

                if (!result) {
                  return JSON.stringify({
                    success: false,
                    error: 'Failed to list messages',
                  });
                }

                return JSON.stringify({
                  success: true,
                  threadId: args.threadId,
                  count: result.messages.length,
                  messages: result.messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content.slice(0, 200) : '[complex content]',
                    createdAt: m.createdAt,
                  })),
                });
              }

              case 'get-observations': {
                const result = await mastraClient.getObservationalMemory(tags.resourceId, args.threadId);

                if (!result) {
                  return JSON.stringify({
                    success: false,
                    error: 'Failed to get observations',
                  });
                }

                if (!result.record) {
                  return JSON.stringify({
                    success: true,
                    message: 'No observations found',
                    hasRecord: false,
                  });
                }

                return JSON.stringify({
                  success: true,
                  hasRecord: true,
                  observations: {
                    active: result.record.activeObservations,
                    buffered: result.record.bufferedObservations,
                    originType: result.record.originType,
                    generationCount: result.record.generationCount,
                    totalTokensObserved: result.record.totalTokensObserved,
                    observationTokenCount: result.record.observationTokenCount,
                    lastObservedAt: result.record.lastObservedAt,
                    isObserving: result.record.isObserving,
                    isReflecting: result.record.isReflecting,
                  },
                  historyCount: result.history?.length || 0,
                });
              }

              case 'get-working-memory': {
                if (!args.threadId) {
                  return JSON.stringify({
                    success: false,
                    error: 'threadId parameter is required for get-working-memory mode',
                  });
                }

                const result = await mastraClient.getWorkingMemory(args.threadId, tags.resourceId);

                if (!result) {
                  return JSON.stringify({
                    success: false,
                    error: 'Failed to get working memory',
                  });
                }

                return JSON.stringify({
                  success: true,
                  threadId: args.threadId,
                  source: result.source,
                  threadExists: result.threadExists,
                  workingMemory: result.workingMemory,
                });
              }

              case 'update-working-memory': {
                if (!args.threadId) {
                  return JSON.stringify({
                    success: false,
                    error: 'threadId parameter is required for update-working-memory mode',
                  });
                }

                if (!args.content) {
                  return JSON.stringify({
                    success: false,
                    error: 'content parameter is required for update-working-memory mode',
                  });
                }

                const sanitizedContent = stripPrivateContent(args.content);
                if (isFullyPrivate(args.content)) {
                  return JSON.stringify({
                    success: false,
                    error: 'Cannot store fully private content',
                  });
                }

                const result = await mastraClient.updateWorkingMemory(
                  args.threadId,
                  sanitizedContent,
                  tags.resourceId,
                );

                return JSON.stringify({
                  success: result.success,
                  message: result.success ? 'Working memory updated' : 'Failed to update working memory',
                  threadId: args.threadId,
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
      // Handle events if needed (e.g., context compaction)
      log('event received', { type: input.event.type });

      // Could implement context compaction handling here similar to supermemory
    },
  };
};

// Default export for OpenCode plugin system
export default ObservationalMemoryPlugin;

// Re-export types and utilities
export { isConfigured, CONFIG } from './config.js';
export { getTags } from './services/tags.js';
export { mastraClient } from './services/client.js';
export type * from './types/index.js';
