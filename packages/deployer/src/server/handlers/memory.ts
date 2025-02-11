import type { MastraMemory } from '@mastra/core/memory';
import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';
import { validateBody } from './utils';

function getMemoryFromContext(c: Context): MastraMemory | null | undefined {
  const mastra = c.get('mastra');
  const agentId = c.req.query('agentId');
  const agent = agentId ? mastra.getAgent(agentId) : null;

  if (agentId && !agent) {
    throw new HTTPException(404, { message: 'Agent not found' });
  }

  const memory = agent?.getMemory?.() || mastra.memory;

  return memory;
}

// Memory handlers
export async function getMemoryStatusHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);

    if (!memory) {
      return c.json({ result: false });
    }

    return c.json({ result: true });
  } catch (error) {
    return handleError(error, 'Error getting memory status');
  }
}

export async function getThreadsHandler(c: Context) {
  try {
    const { resourceid } = c.req.query();
    const memory = getMemoryFromContext(c);

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    if (!resourceid) {
      throw new HTTPException(400, { message: 'Resource ID is required' });
    }

    const threads = await memory.getThreadsByResourceId({ resourceId: resourceid });
    return c.json(threads);
  } catch (error) {
    return handleError(error, 'Error getting threads');
  }
}

export async function getThreadByIdHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);
    const threadId = c.req.param('threadId');

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    return c.json(thread);
  } catch (error) {
    return handleError(error, 'Error getting thread');
  }
}

export async function saveMessagesHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);
    const { messages } = await c.req.json();

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ messages });

    if (!Array.isArray(messages)) {
      throw new HTTPException(400, { message: 'Messages should be an array' });
    }

    const processedMessages = messages.map(message => ({
      ...message,
      id: memory.generateId(),
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
    }));

    const result = await memory.saveMessages({ messages: processedMessages, memoryConfig: {} });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error saving messages');
  }
}

export async function createThreadHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);
    const { title, metadata, resourceid, threadId } = await c.req.json();

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    validateBody({ resourceid });

    const result = await memory.createThread({ resourceId: resourceid, title, metadata, threadId });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error saving thread to memory');
  }
}

export async function updateThreadHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);
    const threadId = c.req.param('threadId');
    const { title, metadata, resourceid } = await c.req.json();
    const updatedAt = new Date();

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    const updatedThread = {
      ...thread,
      title: title || thread.title,
      metadata: metadata || thread.metadata,
      resourceId: resourceid || thread.resourceId,
      createdAt: thread.createdAt,
      updatedAt,
    };

    const result = await memory.saveThread({ thread: updatedThread });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating thread');
  }
}

export async function deleteThreadHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);
    const threadId = c.req.param('threadId');

    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    await memory.deleteThread(threadId);
    return c.json({ result: 'Thread deleted' });
  } catch (error) {
    return handleError(error, 'Error deleting thread');
  }
}

export async function getMessagesHandler(c: Context) {
  try {
    const memory = getMemoryFromContext(c);
    const threadId = c.req.param('threadId');

    if (!memory) {
      return c.json({ error: 'Memory is not initialized' }, 400);
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    const result = await memory.query({ threadId });
    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}
