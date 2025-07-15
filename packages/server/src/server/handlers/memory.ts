import { generateEmptyFromSchema } from '@mastra/core';
import type { StorageGetMessagesArg } from '@mastra/core';
import type { RuntimeContext } from '@mastra/core/di';
import type { MastraMemory } from '@mastra/core/memory';
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
    return agent?.getMemory() || mastra.getMemory();
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

export async function getThreadsHandler({
  mastra,
  agentId,
  resourceId,
  networkId,
  runtimeContext,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'resourceId' | 'networkId' | 'runtimeContext'>) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, networkId, runtimeContext });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ resourceId });

    const threads = await memory.getThreadsByResourceId({ resourceId: resourceId! });
    return threads;
  } catch (error) {
    return handleError(error, 'Error getting threads');
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

    const processedMessages = body.messages.map(message => ({
      ...message,
      id: memory.generateId(),
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
