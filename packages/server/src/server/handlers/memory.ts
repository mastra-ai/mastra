import type { MastraDBMessage } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/di';
import type { MastraMemory } from '@mastra/core/memory';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import { HTTPException } from '../http-exception';
import {
  threadIdPathParams,
  agentIdQuerySchema,
  getMemoryStatusQuerySchema,
  getMemoryConfigQuerySchema,
  listThreadsQuerySchema,
  getThreadByIdQuerySchema,
  listMessagesQuerySchema,
  getWorkingMemoryQuerySchema,
  getMemoryStatusNetworkQuerySchema,
  listThreadsNetworkQuerySchema,
  getThreadByIdNetworkQuerySchema,
  listMessagesNetworkQuerySchema,
  saveMessagesNetworkQuerySchema,
  createThreadNetworkQuerySchema,
  updateThreadNetworkQuerySchema,
  deleteThreadNetworkQuerySchema,
  deleteMessagesNetworkQuerySchema,
  memoryStatusResponseSchema,
  memoryConfigResponseSchema,
  listThreadsResponseSchema,
  getThreadByIdResponseSchema,
  listMessagesResponseSchema,
  getWorkingMemoryResponseSchema,
  saveMessagesBodySchema,
  createThreadBodySchema,
  updateThreadBodySchema,
  updateWorkingMemoryBodySchema,
  deleteMessagesBodySchema,
  searchMemoryQuerySchema,
  saveMessagesResponseSchema,
  updateWorkingMemoryResponseSchema,
  searchMemoryResponseSchema,
  deleteThreadResponseSchema,
  deleteMessagesResponseSchema,
  cloneThreadBodySchema,
  cloneThreadResponseSchema,
  branchThreadBodySchema,
  branchThreadResponseSchema,
  promoteBranchBodySchema,
  promoteBranchResponseSchema,
  listBranchesResponseSchema,
  getParentThreadResponseSchema,
  getBranchHistoryResponseSchema,
} from '../schemas/memory';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface MemoryContext extends Context {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext;
}

interface SearchResult {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  threadId?: string;
  threadTitle?: string;
  score?: number;
  context?: {
    before?: SearchResult[];
    after?: SearchResult[];
  };
}

export function getTextContent(message: MastraDBMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (message.content && typeof message.content === 'object' && 'parts' in message.content) {
    const textPart = message.content.parts.find(p => p.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

async function getMemoryFromContext({
  mastra,
  agentId,
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'>): Promise<MastraMemory | null | undefined> {
  const logger = mastra.getLogger();
  let agent;
  if (agentId) {
    try {
      agent = mastra.getAgentById(agentId);
    } catch (error) {
      logger.debug('Error getting agent from mastra, searching agents for agent', error);
    }
  }
  if (agentId && !agent) {
    logger.debug('Agent not found, searching agents for agent', { agentId });
    const agents = mastra.listAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const agents = await ag.listAgents();

          if (agents[agentId]) {
            agent = agents[agentId];
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }

    if (!agent) {
      throw new HTTPException(404, { message: 'Agent not found' });
    }
  }

  if (agent) {
    return await agent?.getMemory({
      requestContext,
    });
  }
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const GET_MEMORY_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/status',
  responseType: 'json',
  queryParamSchema: getMemoryStatusQuerySchema,
  responseSchema: memoryStatusResponseSchema,
  summary: 'Get memory status',
  description: 'Returns the current status of the memory system including configuration and health information',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        return { result: false };
      }

      return { result: true };
    } catch (error) {
      return handleError(error, 'Error getting memory status');
    }
  },
});

export const GET_MEMORY_CONFIG_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/config',
  responseType: 'json',
  queryParamSchema: getMemoryConfigQuerySchema,
  responseSchema: memoryConfigResponseSchema,
  summary: 'Get memory configuration',
  description: 'Returns the memory configuration for a specific agent or the system default',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, requestContext }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      // Get the merged configuration (defaults + custom)
      const config = memory.getMergedThreadConfig({});

      return { config };
    } catch (error) {
      return handleError(error, 'Error getting memory configuration');
    }
  },
});

export const LIST_THREADS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads',
  responseType: 'json',
  queryParamSchema: listThreadsQuerySchema,
  responseSchema: listThreadsResponseSchema,
  summary: 'List memory threads',
  description: 'Returns a paginated list of conversation threads filtered by resource ID',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, resourceId, requestContext, page, perPage, orderBy }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      validateBody({ resourceId });

      const result = await memory.listThreadsByResourceId({
        resourceId: resourceId!,
        page,
        perPage,
        orderBy,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error listing threads');
    }
  },
});

export const GET_THREAD_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: getThreadByIdQuerySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Get thread by ID',
  description: 'Returns details for a specific conversation thread',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const thread = await memory.getThreadById({ threadId: threadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }

      return thread;
    } catch (error) {
      return handleError(error, 'Error getting thread');
    }
  },
});

export const LIST_MESSAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads/:threadId/messages',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: listMessagesQuerySchema,
  responseSchema: listMessagesResponseSchema,
  summary: 'List thread messages',
  description: 'Returns a paginated list of messages in a conversation thread',
  tags: ['Memory'],
  handler: async ({
    mastra,
    agentId,
    threadId,
    resourceId,
    perPage,
    page,
    orderBy,
    include,
    filter,
    requestContext,
  }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      if (!threadId) {
        throw new HTTPException(400, { message: 'No threadId found' });
      }

      const thread = await memory.getThreadById({ threadId: threadId });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }

      const result = await memory.recall({
        threadId: threadId,
        resourceId,
        perPage,
        page,
        orderBy,
        include,
        filter,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error getting messages');
    }
  },
});

export const GET_WORKING_MEMORY_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads/:threadId/working-memory',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: getWorkingMemoryQuerySchema,
  responseSchema: getWorkingMemoryResponseSchema,
  summary: 'Get working memory',
  description: 'Returns the working memory state for a thread',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, resourceId, requestContext, memoryConfig }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      validateBody({ threadId });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }
      const thread = await memory.getThreadById({ threadId: threadId! });
      const threadExists = !!thread;
      const template = await memory.getWorkingMemoryTemplate({ memoryConfig });
      const workingMemoryTemplate =
        template?.format === 'json'
          ? { ...template, content: JSON.stringify(generateEmptyFromSchema(template.content)) }
          : template;
      const workingMemory = await memory.getWorkingMemory({ threadId: threadId!, resourceId, memoryConfig });
      const config = memory.getMergedThreadConfig(memoryConfig || {});
      const source: 'thread' | 'resource' =
        config.workingMemory?.scope !== 'thread' && resourceId ? 'resource' : 'thread';
      return { workingMemory, source, workingMemoryTemplate, threadExists };
    } catch (error) {
      return handleError(error, 'Error getting working memory');
    }
  },
});

export const SAVE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/save-messages',
  responseType: 'json',
  queryParamSchema: agentIdQuerySchema,
  bodySchema: saveMessagesBodySchema,
  responseSchema: saveMessagesResponseSchema,
  summary: 'Save messages',
  description: 'Saves new messages to memory',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, messages, requestContext }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      if (!messages) {
        throw new HTTPException(400, { message: 'Messages are required' });
      }

      if (!Array.isArray(messages)) {
        throw new HTTPException(400, { message: 'Messages should be an array' });
      }

      // Validate that all messages have threadId and resourceId
      const invalidMessages = messages.filter(message => !message.threadId || !message.resourceId);
      if (invalidMessages.length > 0) {
        throw new HTTPException(400, {
          message: `All messages must have threadId and resourceId fields. Found ${invalidMessages.length} invalid message(s).`,
        });
      }

      const processedMessages = messages.map(message => ({
        ...message,
        id: message.id || memory.generateId(),
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      }));

      const result = await memory.saveMessages({ messages: processedMessages as any, memoryConfig: {} });
      return result;
    } catch (error) {
      return handleError(error, 'Error saving messages');
    }
  },
});

export const CREATE_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/threads',
  responseType: 'json',
  queryParamSchema: agentIdQuerySchema,
  bodySchema: createThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Create thread',
  description: 'Creates a new conversation thread',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, resourceId, title, metadata, threadId, requestContext }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      validateBody({ resourceId });

      const result = await memory.createThread({
        resourceId: resourceId!,
        title,
        metadata,
        threadId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error saving thread to memory');
    }
  },
});

export const UPDATE_THREAD_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/memory/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: updateThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Update thread',
  description: 'Updates a conversation thread',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, title, metadata, resourceId, requestContext }) => {
    try {
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

      const updatedAt = new Date();

      validateBody({ threadId });

      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const thread = await memory.getThreadById({ threadId: threadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }

      const updatedThread = {
        ...thread,
        title: title || thread.title,
        metadata: metadata || thread.metadata,
        resourceId: resourceId || thread.resourceId,
        createdAt: thread.createdAt,
        updatedAt,
      };

      const result = await memory.saveThread({ thread: updatedThread });
      return {
        ...result,
        resourceId: result.resourceId ?? null,
      };
    } catch (error) {
      return handleError(error, 'Error updating thread');
    }
  },
});

export const DELETE_THREAD_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/memory/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  responseSchema: deleteThreadResponseSchema,
  summary: 'Delete thread',
  description: 'Deletes a conversation thread',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const thread = await memory.getThreadById({ threadId: threadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }

      await memory.deleteThread(threadId!);
      return { result: 'Thread deleted' };
    } catch (error) {
      return handleError(error, 'Error deleting thread');
    }
  },
});

export const CLONE_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/threads/:threadId/clone',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: cloneThreadBodySchema,
  responseSchema: cloneThreadResponseSchema,
  summary: 'Clone thread',
  description: 'Creates a copy of a conversation thread with all its messages',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, newThreadId, resourceId, title, metadata, options, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const result = await memory.cloneThread({
        sourceThreadId: threadId!,
        newThreadId,
        resourceId,
        title,
        metadata,
        options,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error cloning thread');
    }
  },
});

export const BRANCH_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/threads/:threadId/branch',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: branchThreadBodySchema,
  responseSchema: branchThreadResponseSchema,
  summary: 'Branch thread',
  description:
    'Creates a new thread that references the parent thread messages up to a branch point. Unlike cloning, branched threads share message history with their parent.',
  tags: ['Memory'],
  handler: async ({
    mastra,
    agentId,
    threadId,
    branchPointMessageId,
    newThreadId,
    resourceId,
    title,
    metadata,
    requestContext,
  }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const result = await memory.branchThread({
        sourceThreadId: threadId!,
        branchPointMessageId,
        newThreadId,
        resourceId,
        title,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error branching thread');
    }
  },
});

export const PROMOTE_BRANCH_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/threads/:threadId/promote',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: promoteBranchBodySchema,
  responseSchema: promoteBranchResponseSchema,
  summary: 'Promote branch',
  description:
    'Promotes a branch to become the canonical thread, optionally archiving or deleting the parent messages that came after the branch point.',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, deleteParentMessages, archiveThreadTitle, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const result = await memory.promoteBranch({
        branchThreadId: threadId!,
        deleteParentMessages,
        archiveThreadTitle,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error promoting branch');
    }
  },
});

export const LIST_BRANCHES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads/:threadId/branches',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  responseSchema: listBranchesResponseSchema,
  summary: 'List branches',
  description: 'Lists all threads that were branched from the specified source thread.',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const branches = await memory.listBranches(threadId!);

      return { branches };
    } catch (error) {
      return handleError(error, 'Error listing branches');
    }
  },
});

export const GET_PARENT_THREAD_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads/:threadId/parent',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  responseSchema: getParentThreadResponseSchema,
  summary: 'Get parent thread',
  description: 'Gets the parent thread that this thread was branched from, if any.',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const thread = await memory.getParentThread(threadId!);

      return { thread };
    } catch (error) {
      return handleError(error, 'Error getting parent thread');
    }
  },
});

export const GET_BRANCH_HISTORY_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/threads/:threadId/history',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  responseSchema: getBranchHistoryResponseSchema,
  summary: 'Get branch history',
  description: 'Gets the full branch history chain from the root thread to this thread.',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, requestContext }) => {
    try {
      validateBody({ threadId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      const history = await memory.getBranchHistory(threadId!);

      return { history };
    } catch (error) {
      return handleError(error, 'Error getting branch history');
    }
  },
});

export const UPDATE_WORKING_MEMORY_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/threads/:threadId/working-memory',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: agentIdQuerySchema,
  bodySchema: updateWorkingMemoryBodySchema,
  responseSchema: updateWorkingMemoryResponseSchema,
  summary: 'Update working memory',
  description: 'Updates the working memory state for a thread',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, threadId, resourceId, memoryConfig, workingMemory, requestContext }) => {
    try {
      validateBody({ threadId, workingMemory });
      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }
      const thread = await memory.getThreadById({ threadId: threadId! });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }

      await memory.updateWorkingMemory({ threadId: threadId!, resourceId, workingMemory, memoryConfig });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error updating working memory');
    }
  },
});

export const DELETE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/messages/delete',
  responseType: 'json',
  queryParamSchema: agentIdQuerySchema,
  bodySchema: deleteMessagesBodySchema,
  responseSchema: deleteMessagesResponseSchema,
  summary: 'Delete messages',
  description: 'Deletes specific messages from memory',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, messageIds, requestContext }) => {
    try {
      if (messageIds === undefined || messageIds === null) {
        throw new HTTPException(400, { message: 'messageIds is required' });
      }

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      // Normalize messageIds to the format expected by deleteMessages
      // Convert single values to arrays and extract IDs from objects
      let normalizedIds: string[] | { id: string }[];

      if (Array.isArray(messageIds)) {
        // Already an array - keep as is (could be string[] or { id: string }[])
        normalizedIds = messageIds;
      } else if (typeof messageIds === 'string') {
        // Single string ID - wrap in array
        normalizedIds = [messageIds];
      } else {
        // Single object with id property - wrap in array
        normalizedIds = [messageIds];
      }

      await memory.deleteMessages(normalizedIds);

      // Count messages for response
      const count = Array.isArray(messageIds) ? messageIds.length : 1;

      return { success: true, message: `${count} message${count === 1 ? '' : 's'} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting messages');
    }
  },
});

export const SEARCH_MEMORY_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/search',
  responseType: 'json',
  queryParamSchema: searchMemoryQuerySchema,
  responseSchema: searchMemoryResponseSchema,
  summary: 'Search memory',
  description: 'Searches across memory using semantic or text search',
  tags: ['Memory'],
  handler: async ({ mastra, agentId, searchQuery, resourceId, threadId, limit = 20, requestContext, memoryConfig }) => {
    try {
      validateBody({ searchQuery, resourceId });

      const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
      if (!memory) {
        throw new HTTPException(400, { message: 'Memory is not initialized' });
      }

      // Get memory configuration first to check scope
      const config = memory.getMergedThreadConfig(memoryConfig || {});
      const hasSemanticRecall = !!config?.semanticRecall;
      const resourceScope =
        typeof config?.semanticRecall === 'object' ? config?.semanticRecall?.scope !== 'thread' : true;

      const searchResults: SearchResult[] = [];

      // If threadId is provided and scope is thread-based, check if the thread exists
      if (threadId && !resourceScope) {
        const thread = await memory.getThreadById({ threadId });
        if (!thread) {
          // Thread doesn't exist yet (new unsaved thread) - return empty results
          return {
            results: [],
            count: 0,
            query: searchQuery,
            searchScope: resourceScope ? 'resource' : 'thread',
            searchType: hasSemanticRecall ? 'semantic' : 'text',
          };
        }
        if (thread.resourceId !== resourceId) {
          throw new HTTPException(403, { message: 'Thread does not belong to the specified resource' });
        }
      }

      // If no threadId provided, get one from the resource
      if (!threadId) {
        const { threads } = await memory.listThreadsByResourceId({
          resourceId,
          page: 0,
          perPage: 1,
          orderBy: { field: 'updatedAt', direction: 'DESC' },
        });

        if (threads.length === 0) {
          return {
            results: [],
            count: 0,
            query: searchQuery,
            searchScope: resourceScope ? 'resource' : 'thread',
            searchType: hasSemanticRecall ? 'semantic' : 'text',
          };
        }

        // Use first thread - Memory class will handle scope internally
        threadId = threads[0]!.id;
      }

      const beforeRange =
        typeof config.semanticRecall === `boolean`
          ? 2
          : typeof config.semanticRecall?.messageRange === `number`
            ? config.semanticRecall.messageRange
            : config.semanticRecall?.messageRange.before || 2;
      const afterRange =
        typeof config.semanticRecall === `boolean`
          ? 2
          : typeof config.semanticRecall?.messageRange === `number`
            ? config.semanticRecall.messageRange
            : config.semanticRecall?.messageRange.after || 2;

      if (resourceScope && config.semanticRecall) {
        config.semanticRecall =
          typeof config.semanticRecall === `boolean`
            ? // make message range 0 so we can highlight the matches in search, message range will include other messages, not the matching ones
              // and we add prev/next messages in a special section on each message anyway
              { messageRange: 0, topK: 2, scope: 'resource' }
            : { ...config.semanticRecall, messageRange: 0 };
      }

      // Single call to recall - just like the agent does
      // The Memory class handles scope (thread vs resource) internally
      const threadConfig = memory.getMergedThreadConfig(config || {});
      if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
        return { results: [], count: 0, query: searchQuery };
      }

      const result = await memory.recall({
        threadId,
        resourceId,
        perPage: threadConfig.lastMessages,
        threadConfig: config,
        vectorSearchString: threadConfig.semanticRecall && searchQuery ? searchQuery : undefined,
      });

      // Get all threads to build context and show which thread each message is from
      // Fetch threads by IDs from the actual messages to avoid truncation
      const threadIds = Array.from(
        new Set(result.messages.map((m: MastraDBMessage) => m.threadId || threadId!).filter(Boolean)),
      );
      const fetched = await Promise.all(threadIds.map((id: string) => memory.getThreadById({ threadId: id })));
      const threadMap = new Map(fetched.filter(Boolean).map(t => [t!.id, t!]));

      // Process each message in the results
      for (const msg of result.messages) {
        const content = getTextContent(msg);

        const msgThreadId = msg.threadId || threadId;
        const thread = threadMap.get(msgThreadId);

        // Get thread messages for context
        const threadMessages = (await memory.recall({ threadId: msgThreadId })).messages;
        const messageIndex = threadMessages.findIndex(m => m.id === msg.id);

        const searchResult: SearchResult = {
          id: msg.id,
          role: msg.role,
          content,
          createdAt: msg.createdAt,
          threadId: msgThreadId,
          threadTitle: thread?.title || msgThreadId,
        };

        if (messageIndex !== -1) {
          searchResult.context = {
            before: threadMessages.slice(Math.max(0, messageIndex - beforeRange), messageIndex).map(m => ({
              id: m.id,
              role: m.role,
              content: getTextContent(m),
              createdAt: m.createdAt || new Date(),
            })),
            after: threadMessages.slice(messageIndex + 1, messageIndex + afterRange + 1).map(m => ({
              id: m.id,
              role: m.role,
              content: getTextContent(m),
              createdAt: m.createdAt || new Date(),
            })),
          };
        }

        searchResults.push(searchResult);
      }

      // Sort by date (newest first) and limit
      const sortedResults = searchResults
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      return {
        results: sortedResults,
        count: sortedResults.length,
        query: searchQuery,
        searchScope: resourceScope ? 'resource' : 'thread',
        searchType: hasSemanticRecall ? 'semantic' : 'text',
      };
    } catch (error) {
      return handleError(error, 'Error searching memory');
    }
  },
});

// Network routes (same handlers with /network/ prefix)
export const GET_MEMORY_STATUS_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/network/status',
  responseType: 'json',
  queryParamSchema: getMemoryStatusNetworkQuerySchema,
  responseSchema: memoryStatusResponseSchema,
  summary: 'Get memory status (network)',
  description: 'Returns the current status of the memory system (network route)',
  tags: ['Memory - Network'],
  handler: GET_MEMORY_STATUS_ROUTE.handler,
});

export const LIST_THREADS_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/network/threads',
  responseType: 'json',
  queryParamSchema: listThreadsNetworkQuerySchema,
  responseSchema: listThreadsResponseSchema,
  summary: 'List memory threads (network)',
  description: 'Returns a paginated list of conversation threads (network route)',
  tags: ['Memory - Network'],
  handler: LIST_THREADS_ROUTE.handler,
});

export const GET_THREAD_BY_ID_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/network/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: getThreadByIdNetworkQuerySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Get thread by ID (network)',
  description: 'Returns details for a specific conversation thread (network route)',
  tags: ['Memory - Network'],
  handler: GET_THREAD_BY_ID_ROUTE.handler,
});

export const LIST_MESSAGES_NETWORK_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/network/threads/:threadId/messages',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: listMessagesNetworkQuerySchema,
  responseSchema: listMessagesResponseSchema,
  summary: 'List thread messages (network)',
  description: 'Returns a paginated list of messages in a conversation thread (network route)',
  tags: ['Memory - Network'],
  handler: LIST_MESSAGES_ROUTE.handler,
});

export const SAVE_MESSAGES_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/network/save-messages',
  responseType: 'json',
  queryParamSchema: saveMessagesNetworkQuerySchema,
  bodySchema: saveMessagesBodySchema,
  responseSchema: saveMessagesResponseSchema,
  summary: 'Save messages (network)',
  description: 'Saves new messages to memory (network route)',
  tags: ['Memory - Network'],
  handler: SAVE_MESSAGES_ROUTE.handler,
});

export const CREATE_THREAD_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/network/threads',
  responseType: 'json',
  queryParamSchema: createThreadNetworkQuerySchema,
  bodySchema: createThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Create thread (network)',
  description: 'Creates a new conversation thread (network route)',
  tags: ['Memory - Network'],
  handler: CREATE_THREAD_ROUTE.handler,
});

export const UPDATE_THREAD_NETWORK_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/memory/network/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: updateThreadNetworkQuerySchema,
  bodySchema: updateThreadBodySchema,
  responseSchema: getThreadByIdResponseSchema,
  summary: 'Update thread (network)',
  description: 'Updates a conversation thread (network route)',
  tags: ['Memory - Network'],
  handler: UPDATE_THREAD_ROUTE.handler,
});

export const DELETE_THREAD_NETWORK_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/memory/network/threads/:threadId',
  responseType: 'json',
  pathParamSchema: threadIdPathParams,
  queryParamSchema: deleteThreadNetworkQuerySchema,
  responseSchema: deleteThreadResponseSchema,
  summary: 'Delete thread (network)',
  description: 'Deletes a conversation thread (network route)',
  tags: ['Memory - Network'],
  handler: DELETE_THREAD_ROUTE.handler,
});

export const DELETE_MESSAGES_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/api/memory/network/messages/delete',
  responseType: 'json',
  queryParamSchema: deleteMessagesNetworkQuerySchema,
  bodySchema: deleteMessagesBodySchema,
  responseSchema: deleteMessagesResponseSchema,
  summary: 'Delete messages (network)',
  description: 'Deletes specific messages from memory (network route)',
  tags: ['Memory - Network'],
  handler: DELETE_MESSAGES_ROUTE.handler,
});
