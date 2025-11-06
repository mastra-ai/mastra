import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import type { MastraMemory } from '@mastra/core/memory';
import type { StorageListMessagesInput, StorageOrderBy } from '@mastra/core/storage';
import { generateEmptyFromSchema } from '@mastra/core/utils';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface MemoryContext extends Context {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext;
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
      requestContext: requestContext ?? new RequestContext(),
    });
  }
}

// Memory handlers
export async function getMemoryStatusHandler({
  mastra,
  agentId,
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'>) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

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
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'>) {
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
}

export async function listThreadsHandler({
  mastra,
  agentId,
  resourceId,
  requestContext,
  page,
  perPage,
  orderBy,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'resourceId' | 'requestContext'> & {
  page: number;
  perPage: number | false;
  orderBy?: StorageOrderBy;
}) {
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
}

export async function getThreadByIdHandler({
  mastra,
  agentId,
  threadId,
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'requestContext'>) {
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
}

export async function saveMessagesHandler({
  mastra,
  agentId,
  body,
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'> & {
  body: {
    messages: Parameters<MastraMemory['saveMessages']>[0]['messages'];
  };
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

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
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'> & {
  body?: Omit<Parameters<MastraMemory['createThread']>[0], 'resourceId'> & { resourceId?: string };
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

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
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'requestContext'> & {
  body?: Parameters<MastraMemory['saveThread']>[0]['thread'];
}) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, requestContext });

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
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'requestContext'>) {
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
}

export async function listMessagesHandler({
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
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'requestContext'> &
  Omit<StorageListMessagesInput, 'threadId'>) {
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
  requestContext,
  memoryConfig,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'requestContext'> & {
  resourceId?: Parameters<MastraMemory['getWorkingMemory']>[0]['resourceId'];
  memoryConfig?: Parameters<MastraMemory['getWorkingMemory']>[0]['memoryConfig'];
}) {
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
    const source = config.workingMemory?.scope !== 'thread' && resourceId ? 'resource' : 'thread';
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
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId' | 'requestContext'> & {
  body: Omit<Parameters<MastraMemory['updateWorkingMemory']>[0], 'threadId'>;
}) {
  try {
    validateBody({ threadId });
    const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
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
  requestContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'> & {
  messageIds: string | string[] | { id: string } | { id: string }[];
}) {
  try {
    if (messageIds === undefined || messageIds === null) {
      throw new HTTPException(400, { message: 'messageIds is required' });
    }

    const memory = await getMemoryFromContext({ mastra, agentId, requestContext });
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
  requestContext,
  memoryConfig,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'requestContext'> & {
  searchQuery: string;
  resourceId: string;
  threadId?: string;
  limit?: number;
  memoryConfig?: any;
}): Promise<SearchResponse | ReturnType<typeof handleError>> {
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
      const content =
        typeof msg.content.content === `string`
          ? msg.content.content
          : msg.content.parts?.map((p: any) => (p.type === 'text' ? p.text : '')).join(' ') || '';

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
            content: m.content,
            createdAt: m.createdAt || new Date(),
          })),
          after: threadMessages.slice(messageIndex + 1, messageIndex + afterRange + 1).map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
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
}
