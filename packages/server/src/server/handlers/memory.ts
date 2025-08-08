import { generateEmptyFromSchema } from '@mastra/core';
import type { StorageGetMessagesArg } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/di';
import type { MastraMemory } from '@mastra/core/memory';
import type { ThreadSortOptions } from '@mastra/core/storage';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface MemoryContext extends Context {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
  networkId?: string;
  runtimeContext?: RuntimeContext;
}

async function getMemoryFromContext({
  mastra,
  agentId,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'>): Promise<
  MastraMemory | null | undefined
> {
  const agent = agentId ? mastra.getAgent(agentId) : null;
  if (agentId && !agent) {
    throw new HTTPException(404, { message: 'Agent not found' });
  }

  const network = networkId ? mastra.vnext_getNetwork(networkId) : null;

  if (networkId && !network) {
    throw new HTTPException(404, { message: 'Network not found' });
  }

  if (agent) {
    return (await agent?.getMemory()) || mastra.getMemory();
  }

  if (network) {
    return (await network?.getMemory({ runtimeContext })) || mastra.getMemory();
  }

  return mastra.getMemory();
}

// Memory handlers
export async function getMemoryStatusHandler({
  mastra,
  agentId,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'>) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      return { result: false };
    }

    return { result: true };
  } catch (error) {
    return handleError(error, 'Error getting memory status');
  }
}

export async function getMemoryConfigHandler({
  mastra,
  agentId,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'>) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    // Get the merged configuration (defaults + custom)
    const config = memory.getMergedThreadConfig({});

    return { config };
  } catch (error) {
    return handleError(error, 'Error getting memory configuration');
  }
}

export async function getThreadsHandler({
  mastra,
  agentId,
  resourceId,
  networkId,
  runtimeContext,
  orderBy,
  sortDirection,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'resourceId' | 'networkId' | 'runtimeContext'> & ThreadSortOptions) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ resourceId });

    const threads = await memory.getThreadsByResourceId({
      resourceId: resourceId!,
      orderBy,
      sortDirection,
    });
    return threads;
  } catch (error) {
    return handleError(error, 'Error getting threads');
  }
}

export async function getThreadsPaginatedHandler({
  mastra,
  agentId,
  resourceId,
  networkId,
  runtimeContext,
  page,
  perPage,
  orderBy,
  sortDirection,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'resourceId' | 'networkId' | 'runtimeContext'> & {
  page: number;
  perPage: number;
} & ThreadSortOptions) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ resourceId });

    const result = await memory.getThreadsByResourceIdPaginated({
      resourceId: resourceId!,
      page,
      perPage,
      orderBy,
      sortDirection,
    });
    return result;
  } catch (error) {
    return handleError(error, 'Error getting paginated threads');
  }
}

export async function getThreadByIdHandler({
  mastra,
  agentId,
  threadId,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'networkId' | 'runtimeContext'>) {
  try {
    validateBody({ threadId });

    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });
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
}

export async function saveMessagesHandler({
  mastra,
  agentId,
  body,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'> & {
  body: {
    messages: Parameters<MastraMemory['saveMessages']>[0]['messages'];
  };
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    if (!body?.messages) {
      throw new HTTPException(400, { message: 'Messages are required' });
    }

    if (!Array.isArray(body.messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    // Validate that all messages have threadId and resourceId
    const invalidMessages = body.messages.filter(message => !message.threadId || !message.resourceId);
    if (invalidMessages.length > 0) {
      throw new HTTPException(400, {
        message: `All messages must have threadId and resourceId fields. Found ${invalidMessages.length} invalid message(s).`,
      });
    }

    const processedMessages = body.messages.map(message => ({
      ...message,
      id: message.id || memory.generateId(),
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
    }));

    const result = await memory.saveMessages({ messages: processedMessages, memoryConfig: {} });
    return result;
  } catch (error) {
    return handleError(error, 'Error saving messages');
  }
}

export async function createThreadHandler({
  mastra,
  agentId,
  body,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'> & {
  body?: Omit<Parameters<MastraMemory['createThread']>[0], 'resourceId'> & { resourceId?: string };
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ resourceId: body?.resourceId });

    const result = await memory.createThread({
      resourceId: body?.resourceId!,
      title: body?.title,
      metadata: body?.metadata,
      threadId: body?.threadId,
    });
    return result;
  } catch (error) {
    return handleError(error, 'Error saving thread to memory');
  }
}

export async function updateThreadHandler({
  mastra,
  agentId,
  threadId,
  body,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'networkId' | 'runtimeContext'> & {
  body?: Parameters<MastraMemory['saveThread']>[0]['thread'];
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!body) {
      throw new HTTPException(400, { message: 'Body is required' });
    }

    const { title, metadata, resourceId } = body;
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
    return result;
  } catch (error) {
    return handleError(error, 'Error updating thread');
  }
}

export async function deleteThreadHandler({
  mastra,
  agentId,
  threadId,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'networkId' | 'runtimeContext'>) {
  try {
    validateBody({ threadId });

    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });
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
}

export async function getMessagesPaginatedHandler({
  mastra,
  threadId,
  resourceId,
  selectBy,
  format,
}: StorageGetMessagesArg & Pick<MemoryContext, 'mastra'>) {
  try {
    validateBody({ threadId });

    const storage = mastra.getStorage();

    if (!storage) {
      throw new HTTPException(400, { message: 'Storage is not initialized' });
    }

    const thread = await storage.getThreadById({ threadId: threadId! });

    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    const result = await storage.getMessagesPaginated({ threadId: threadId!, resourceId, selectBy, format });
    return result;
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}

export async function getMessagesHandler({
  mastra,
  agentId,
  threadId,
  limit,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'networkId' | 'runtimeContext'> & {
  limit?: number;
}) {
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new HTTPException(400, { message: 'Invalid limit: must be a positive integer' });
  }
  try {
    validateBody({ threadId });

    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    const thread = await memory.getThreadById({ threadId: threadId! });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    const result = await memory.query({
      threadId: threadId!,
      ...(limit && { selectBy: { last: limit } }),
    });
    return { messages: result.messages, uiMessages: result.uiMessages };
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}

/**
 * Handler to get the working memory for a thread (optionally resource-scoped).
 * @returns workingMemory - the working memory for the thread
 * @returns source - thread or resource
 */
export async function getWorkingMemoryHandler({
  mastra,
  agentId,
  threadId,
  resourceId,
  networkId,
  runtimeContext,
  memoryConfig,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'networkId' | 'runtimeContext'> & {
  resourceId?: Parameters<MastraMemory['getWorkingMemory']>[0]['resourceId'];
  memoryConfig?: Parameters<MastraMemory['getWorkingMemory']>[0]['memoryConfig'];
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });
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
    const source = config.workingMemory?.scope === 'resource' && resourceId ? 'resource' : 'thread';
    return { workingMemory, source, workingMemoryTemplate, threadExists };
  } catch (error) {
    return handleError(error, 'Error getting working memory');
  }
}

/**
 * Handler to update the working memory for a thread (optionally resource-scoped).
 * @param threadId - the thread id
 * @param body - the body containing the working memory to update and the resource id (optional)
 */
export async function updateWorkingMemoryHandler({
  mastra,
  agentId,
  threadId,
  body,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'networkId' | 'runtimeContext'> & {
  body: Omit<Parameters<MastraMemory['updateWorkingMemory']>[0], 'threadId'>;
}) {
  try {
    validateBody({ threadId });
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });
    const { resourceId, memoryConfig, workingMemory } = body;
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
}

interface SearchResult {
  id: string;
  role: string;
  content: any;
  createdAt: Date;
  threadId?: string;
  threadTitle?: string;
  score?: number;
  context?: {
    before?: SearchResult[];
    after?: SearchResult[];
  };
}

interface SearchResponse {
  results: SearchResult[];
  count: number;
  query: string;
  searchScope?: string;
  searchType?: string;
}

/**
 * Handler to delete one or more messages.
 * @param messageIds - Can be a single ID, array of IDs, or objects with ID property
 */
export async function deleteMessagesHandler({
  mastra,
  agentId,
  messageIds,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'> & {
  messageIds: string | string[] | { id: string } | { id: string }[];
}) {
  try {
    if (messageIds === undefined || messageIds === null) {
      throw new HTTPException(400, { message: 'messageIds is required' });
    }

    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });
    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    // Delete the messages - let the memory method handle validation
    await memory.deleteMessages(messageIds as any);

    // Count messages for response
    let count = 1;
    if (Array.isArray(messageIds)) {
      count = messageIds.length;
    }

    return { success: true, message: `${count} message${count === 1 ? '' : 's'} deleted successfully` };
  } catch (error) {
    return handleError(error, 'Error deleting messages');
  }
}

export async function searchMemoryHandler({
  mastra,
  agentId,
  searchQuery,
  resourceId,
  threadId,
  limit = 20,
  networkId,
  runtimeContext,
  memoryConfig,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'networkId' | 'runtimeContext'> & {
  searchQuery: string;
  resourceId: string;
  threadId?: string;
  limit?: number;
  memoryConfig?: any;
}): Promise<SearchResponse | ReturnType<typeof handleError>> {
  try {
    validateBody({ searchQuery, resourceId });

    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });
    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    // Get memory configuration first to check scope
    const config = memory.getMergedThreadConfig(memoryConfig || {});
    const hasSemanticRecall = !!config?.semanticRecall;
    const resourceScope = typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope === 'resource';

    // Only validate thread ownership if we're in thread scope
    if (threadId && !resourceScope) {
      const thread = await memory.getThreadById({ threadId });
      if (!thread) {
        throw new HTTPException(404, { message: 'Thread not found' });
      }
      if (thread.resourceId !== resourceId) {
        throw new HTTPException(403, { message: 'Thread does not belong to the specified resource' });
      }
    }

    const searchResults: SearchResult[] = [];
    const messageMap = new Map<string, boolean>(); // For deduplication

    // If threadId is provided and scope is thread-based, check if the thread exists
    if (threadId && !resourceScope) {
      const thread = await memory.getThreadById({ threadId });
      if (!thread) {
        // Thread doesn't exist yet (new unsaved thread) - return empty results
        return {
          results: [],
          count: 0,
          query: searchQuery,
          searchScope: 'thread',
          searchType: hasSemanticRecall ? 'semantic' : 'text',
        };
      }
    }

    // If resource scope is enabled or no threadId provided, search across all threads
    if (!threadId || resourceScope) {
      // Search across all threads for this resource
      const threads = await memory.getThreadsByResourceId({ resourceId });

      // If no threads exist yet, return empty results
      if (threads.length === 0) {
        return {
          results: [],
          count: 0,
          query: searchQuery,
          searchScope: 'resource',
          searchType: hasSemanticRecall ? 'semantic' : 'text',
        };
      }

      for (const thread of threads) {
        // Use rememberMessages for semantic search
        const result = await memory.rememberMessages({
          threadId: thread.id,
          resourceId,
          vectorMessageSearch: searchQuery,
          config,
        });

        // Get thread messages for context
        const threadMessages = (await memory.query({ threadId: thread.id })).uiMessages;

        // Process results
        result.messagesV2.forEach(msg => {
          if (messageMap.has(msg.id)) return;
          messageMap.set(msg.id, true);

          const content =
            msg.content.content || msg.content.parts?.map(p => (p.type === 'text' ? p.text : '')).join(' ') || '';

          if (!hasSemanticRecall && !content.toLowerCase().includes(searchQuery.toLowerCase())) {
            return;
          }

          const messageIndex = threadMessages.findIndex(m => m.id === msg.id);

          const searchResult: SearchResult = {
            id: msg.id,
            role: msg.role,
            content,
            createdAt: msg.createdAt,
            threadId: msg.threadId || thread.id,
            threadTitle: thread.title || msg.threadId || thread.id,
          };

          if (messageIndex !== -1) {
            searchResult.context = {
              before: threadMessages.slice(Math.max(0, messageIndex - 2), messageIndex).map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt || new Date(),
              })),
              after: threadMessages.slice(messageIndex + 1, messageIndex + 3).map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt || new Date(),
              })),
            };
          }

          searchResults.push(searchResult);
        });
      }
    } else if (threadId) {
      // Search in specific thread only
      const thread = await memory.getThreadById({ threadId });
      if (!thread) {
        // Thread doesn't exist yet - return empty results
        return {
          results: [],
          count: 0,
          query: searchQuery,
          searchScope: 'thread',
          searchType: hasSemanticRecall ? 'semantic' : 'text',
        };
      }

      const result = await memory.rememberMessages({
        threadId,
        resourceId,
        vectorMessageSearch: searchQuery,
        config,
      });

      const threadMessages = (await memory.query({ threadId })).uiMessages;

      result.messagesV2.forEach(msg => {
        // Skip duplicates
        if (messageMap.has(msg.id)) return;
        messageMap.set(msg.id, true);

        // Extract content
        const content =
          msg.content.content || msg.content.parts?.map(p => (p.type === 'text' ? p.text : '')).join(' ') || '';

        // If not using semantic recall, filter by text search
        if (!hasSemanticRecall && !content.toLowerCase().includes(searchQuery.toLowerCase())) {
          return;
        }

        // Find message index for context
        const messageIndex = threadMessages.findIndex(m => m.id === msg.id);

        const searchResult: SearchResult = {
          id: msg.id,
          role: msg.role,
          content,
          createdAt: msg.createdAt,
          threadId: threadId,
          threadTitle: thread?.title || threadId,
        };

        // Add context if found
        if (messageIndex !== -1) {
          searchResult.context = {
            before: threadMessages.slice(Math.max(0, messageIndex - 2), messageIndex).map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt || new Date(),
            })),
            after: threadMessages.slice(messageIndex + 1, messageIndex + 3).map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt || new Date(),
            })),
          };
        }

        searchResults.push(searchResult);
      });
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
}
