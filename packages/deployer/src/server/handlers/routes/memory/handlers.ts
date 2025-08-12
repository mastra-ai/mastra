import type { Mastra } from '@mastra/core';
import type {
  StorageGetMessagesArg,
  MastraMessageFormat,
  ThreadOrderBy,
  ThreadSortDirection,
} from '@mastra/core/storage';
import {
  getMemoryStatusHandler as getOriginalMemoryStatusHandler,
  getMemoryConfigHandler as getOriginalMemoryConfigHandler,
  getThreadsHandler as getOriginalThreadsHandler,
  getThreadsPaginatedHandler as getOriginalGetThreadsPaginatedHandler,
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
    const networkId = c.req.query('networkId');

    const result = await getOriginalMemoryStatusHandler({
      mastra,
      agentId,
      networkId,
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
    const networkId = c.req.query('networkId');

    const result = await getOriginalMemoryConfigHandler({
      mastra,
      agentId,
      networkId,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting memory configuration');
  }
}

export async function getThreadsHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const resourceId = c.req.query('resourceid');
    const networkId = c.req.query('networkId');
    const orderBy = c.req.query('orderBy') as ThreadOrderBy | undefined;
    const sortDirection = c.req.query('sortDirection') as ThreadSortDirection | undefined;

    const result = await getOriginalThreadsHandler({
      mastra,
      agentId,
      resourceId,
      networkId,
      orderBy,
      sortDirection,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting threads');
  }
}

export async function getThreadsPaginatedHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const resourceId = c.req.query('resourceId');
    const networkId = c.req.query('networkId');
    const page = parseInt(c.req.query('page') || '0', 10);
    const perPage = parseInt(c.req.query('perPage') || '100', 10);
    const orderBy = c.req.query('orderBy') as ThreadOrderBy | undefined;
    const sortDirection = c.req.query('sortDirection') as ThreadSortDirection | undefined;

    const result = await getOriginalGetThreadsPaginatedHandler({
      mastra,
      agentId,
      resourceId,
      networkId,
      page,
      perPage,
      orderBy,
      sortDirection,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error getting paginated threads');
  }
}

export async function getThreadByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const agentId = c.req.query('agentId');
    const threadId = c.req.param('threadId');
    const networkId = c.req.query('networkId');

    const result = await getOriginalThreadByIdHandler({
      mastra,
      agentId,
      threadId,
      networkId,
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
    const networkId = c.req.query('networkId');
    const body = await c.req.json();

    const result = await getOriginalSaveMessagesHandler({
      mastra,
      agentId,
      body,
      networkId,
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
    const networkId = c.req.query('networkId');
    const body = await c.req.json();

    const result = await getOriginalCreateThreadHandler({
      mastra,
      agentId,
      body,
      networkId,
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
    const networkId = c.req.query('networkId');
    const body = await c.req.json();

    const result = await getOriginalUpdateThreadHandler({
      mastra,
      agentId,
      threadId,
      body,
      networkId,
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
    const networkId = c.req.query('networkId');

    const result = await getOriginalDeleteThreadHandler({
      mastra,
      agentId,
      threadId,
      networkId,
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
    const networkId = c.req.query('networkId');
    const threadId = c.req.param('threadId');
    const limit = parseLimit(c.req.query('limit'));

    const result = await getOriginalGetMessagesHandler({
      mastra,
      agentId,
      threadId,
      networkId,
      limit,
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
    const networkId = c.req.query('networkId');
    const body = await c.req.json();

    const result = await getOriginalUpdateWorkingMemoryHandler({
      mastra,
      agentId,
      threadId,
      body,
      networkId,
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
    const networkId = c.req.query('networkId');

    const result = await getOriginalGetWorkingMemoryHandler({
      mastra,
      agentId,
      threadId,
      resourceId,
      networkId,
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
    const networkId = c.req.query('networkId');
    const runtimeContext = c.get('runtimeContext');

    const result = await getOriginalSearchMemoryHandler({
      mastra,
      agentId,
      searchQuery: searchQuery!,
      resourceId: resourceId!,
      threadId,
      limit,
      memoryConfig,
      networkId,
      runtimeContext,
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
    const networkId = c.req.query('networkId');
    const runtimeContext = c.get('runtimeContext');
    const body = await c.req.json();
    const messageIds = body?.messageIds;

    const result = await getOriginalDeleteMessagesHandler({
      mastra,
      agentId,
      messageIds,
      networkId,
      runtimeContext,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error deleting messages');
  }
}
