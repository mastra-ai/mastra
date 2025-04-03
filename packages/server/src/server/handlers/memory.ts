import type { MastraMemory } from '@mastra/core/memory';
import { HTTPException } from '../http-exception';
import type { Context } from '../types';

import { handleError } from './error';
import { validateBody } from './utils';

interface MemoryContext extends Context {
  agentId?: string;
  resourceId?: string;
  threadId?: string;
}

function getMemoryFromContext({
  mastra,
  agentId,
}: Pick<MemoryContext, 'mastra' | 'agentId'>): MastraMemory | null | undefined {
  const agent = agentId ? mastra.getAgent(agentId) : null;
  if (agentId && !agent) {
    throw new HTTPException(404, { message: 'Agent not found' });
  }

  const memory = agent?.getMemory?.() || mastra.getMemory();

  return memory;
}

// Memory handlers
export async function getMemoryStatusHandler({ mastra, agentId }: Pick<MemoryContext, 'mastra' | 'agentId'>) {
  try {
    const memory = getMemoryFromContext({ mastra, agentId });

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
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'resourceId'>) {
  try {
    const memory = getMemoryFromContext({ mastra, agentId });

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
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId'>) {
  try {
    validateBody({ threadId });

    const memory = getMemoryFromContext({ mastra, agentId });
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
}: Pick<MemoryContext, 'mastra' | 'agentId'> & {
  body: {
    messages: Parameters<MastraMemory['saveMessages']>[0]['messages'];
  };
}) {
  try {
    const memory = getMemoryFromContext({ mastra, agentId });

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
}: Pick<MemoryContext, 'mastra' | 'agentId'> & {
  body?: Omit<Parameters<MastraMemory['createThread']>[0], 'resourceId'> & { resourceId?: string };
}) {
  try {
    const memory = getMemoryFromContext({ mastra, agentId });

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
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId'> & {
  body?: Parameters<MastraMemory['saveThread']>[0]['thread'];
}) {
  try {
    const memory = getMemoryFromContext({ mastra, agentId });

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
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId'>) {
  try {
    validateBody({ threadId });

    const memory = getMemoryFromContext({ mastra, agentId });
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

export async function getMessagesHandler({
  mastra,
  agentId,
  threadId,
}: Pick<MemoryContext, 'mastra' | 'agentId' | 'threadId'>) {
  try {
    validateBody({ threadId });

    const memory = getMemoryFromContext({ mastra, agentId });

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    const thread = await memory.getThreadById({ threadId: threadId! });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    const result = await memory.query({ threadId: threadId! });
    return result;
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}
