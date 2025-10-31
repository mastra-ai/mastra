import type { Mastra } from '@mastra/core/mastra';
import type {
  StorageGetMessagesArg,
  MastraMessageFormat,
  ThreadOrderBy,
  ThreadSortDirection,
} from '@mastra/core/storage';
import {
  getMemoryStatusHandler as getOriginalMemoryStatusHandler,
  getMemoryConfigHandler as getOriginalMemoryConfigHandler,
  listThreadsHandler as getOriginalListThreadsHandler,
  getThreadByIdHandler as getOriginalThreadByIdHandler,
  saveMessagesHandler as getOriginalSaveMessagesHandler,
  createThreadHandler as getOriginalCreateThreadHandler,
  updateThreadHandler as getOriginalUpdateThreadHandler,
  deleteThreadHandler as getOriginalDeleteThreadHandler,
  getMessagesHandler as getOriginalGetMessagesHandler,
  getMessagesPaginatedHandler as getOriginalGetMessagesPaginatedHandler,
  getWorkingMemoryHandler as getOriginalGetWorkingMemoryHandler,
  updateWorkingMemoryHandler as getOriginalUpdateWorkingMemoryHandler,
  searchMemoryHandler as getOriginalSearchMemoryHandler,
  deleteMessagesHandler as getOriginalDeleteMessagesHandler,
} from '@mastra/server/handlers/memory';
import type { Context } from 'hono';

import { handleError } from '../../error';
import { parseLimit } from '../../utils/query-parsers';

// Memory handlers
export async function getMemoryStatusHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const requestContext = c.get('requestContext');

    const result = await getOriginalMemoryStatusHandler({
      mastra,
      agentId,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting memory status');
  }
}

export async function getMemoryConfigHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const requestContext = c.get('requestContext');

    const result = await getOriginalMemoryConfigHandler({
      mastra,
      agentId,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting memory configuration');
  }
}

export async function listThreadsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const resourceId = c.req.query('resourceId');
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const field = c.req.query('orderBy') as ThreadOrderBy | undefined;
    const direction = c.req.query('sortDirection') as ThreadSortDirection | undefined;
    const requestContext = c.get('requestContext');

    // Validate query parameters
    const validFields: ThreadOrderBy[] = ['createdAt', 'updatedAt'];
    const validDirections: ThreadSortDirection[] = ['ASC', 'DESC'];

    if (field && !validFields.includes(field)) {
      return c.json({ error: `Invalid orderBy field: ${field}. Must be one of: ${validFields.join(', ')}` }, 400);
    }
    if (direction && !validDirections.includes(direction)) {
      return c.json(
        { error: `Invalid sortDirection: ${direction}. Must be one of: ${validDirections.join(', ')}` },
        400,
      );
    }

    // Transform to nested structure
    const orderBy = field || direction ? { field: field || 'createdAt', direction: direction || 'DESC' } : undefined;

    const result = await getOriginalListThreadsHandler({
      mastra,
      agentId,
      resourceId,
      offset,
      limit,
      orderBy,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error listing threads');
  }
}

export async function getThreadByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const requestContext = c.get('requestContext');

    const result = await getOriginalThreadByIdHandler({
      mastra,
      agentId,
      threadId,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting thread');
  }
}

export async function saveMessagesHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const body = await c.req.json();
    const requestContext = c.get('requestContext');

    const result = await getOriginalSaveMessagesHandler({
      mastra,
      agentId,
      body,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error saving messages');
  }
}

export async function createThreadHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const body = await c.req.json();
    const requestContext = c.get('requestContext');

    const result = await getOriginalCreateThreadHandler({
      mastra,
      agentId,
      body,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error saving thread to memory');
  }
}

export async function updateThreadHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const body = await c.req.json();
    const requestContext = c.get('requestContext');

    const result = await getOriginalUpdateThreadHandler({
      mastra,
      agentId,
      threadId,
      body,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating thread');
  }
}

export async function deleteThreadHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const requestContext = c.get('requestContext');

    const result = await getOriginalDeleteThreadHandler({
      mastra,
      agentId,
      threadId,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error deleting thread');
  }
}

export async function getMessagesHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const limit = parseLimit(c.req.query('limit'));
    const requestContext = c.get('requestContext');

    const result = await getOriginalGetMessagesHandler({
      mastra,
      agentId,
      threadId,
      limit,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}

export async function getMessagesPaginatedHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const threadId = c.req.param('threadId');
    const resourceId = c.req.query('resourceId');
    const format = (c.req.query('format') || 'v1') as MastraMessageFormat;
    const selectByArgs = c.req.query('selectBy');

    let selectBy = {} as StorageGetMessagesArg['selectBy'];

    if (selectByArgs) {
      try {
        selectBy = JSON.parse(selectByArgs);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // swallow
      }
    }

    const result = await getOriginalGetMessagesPaginatedHandler({
      mastra,
      threadId,
      resourceId,
      format,
      selectBy,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}

export async function updateWorkingMemoryHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const body = await c.req.json();
    const requestContext = c.get('requestContext');

    const result = await getOriginalUpdateWorkingMemoryHandler({
      mastra,
      agentId,
      threadId,
      body,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error updating working memory');
  }
}

export async function getWorkingMemoryHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const resourceId = c.req.query('resourceId');
    const requestContext = c.get('requestContext');

    const result = await getOriginalGetWorkingMemoryHandler({
      mastra,
      agentId,
      threadId,
      resourceId,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting working memory');
  }
}

export async function searchMemoryHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const searchQuery = c.req.query('searchQuery');
    const resourceId = c.req.query('resourceId');
    const threadId = c.req.query('threadId');
    const limit = parseLimit(c.req.query('limit'));
    const memoryConfig = c.req.query('memoryConfig') ? JSON.parse(c.req.query('memoryConfig')!) : undefined;
    const requestContext = c.get('requestContext');

    const result = await getOriginalSearchMemoryHandler({
      mastra,
      agentId,
      searchQuery: searchQuery!,
      resourceId: resourceId!,
      threadId,
      limit,
      memoryConfig,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error searching memory');
  }
}

export async function deleteMessagesHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const requestContext = c.get('requestContext');
    const body = await c.req.json();
    const messageIds = body?.messageIds;

    const result = await getOriginalDeleteMessagesHandler({
      mastra,
      agentId,
      messageIds,
      requestContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error deleting messages');
  }
}
