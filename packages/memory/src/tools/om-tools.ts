import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryConfigInternal } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { formatMessagesForObserver } from '../processors/observational-memory/observer-agent';

type RecallMemory = {
  getMemoryStore: () => Promise<{
    listMessagesById: (args: { messageIds: string[] }) => Promise<{ messages: MastraDBMessage[] }>;
  }>;
  recall: (args: {
    threadId: string;
    resourceId?: string;
    page: number;
    perPage: number | false;
    orderBy?: { field: 'createdAt'; direction: 'ASC' | 'DESC' };
    filter?: {
      dateRange?: {
        start?: Date;
        end?: Date;
        startExclusive?: boolean;
        endExclusive?: boolean;
      };
    };
  }) => Promise<{ messages: MastraDBMessage[] }>;
};

export type RecallMode = 'list' | 'inspect';

export type RecallListItem = {
  id: string;
  role: MastraDBMessage['role'];
  createdAt: string;
  preview: string;
  isCursor: boolean;
};

export type RecallResult =
  | {
      mode: 'list';
      cursor: string;
      page: number;
      limit: number;
      direction: 'forward' | 'backward';
      count: number;
      hasMore: boolean;
      items: RecallListItem[];
    }
  | {
      mode: 'inspect';
      cursor: string;
      page: number;
      limit: number;
      count: number;
      inspectedIds?: string[];
      items: RecallListItem[];
      messages: string;
    };

async function resolveCursorMessage(memory: RecallMemory, cursor: string): Promise<MastraDBMessage> {
  const normalized = cursor.trim();

  if (!normalized) {
    throw new Error('Cursor is required');
  }

  const memoryStore = await memory.getMemoryStore();
  const result = await memoryStore.listMessagesById({ messageIds: [normalized] });
  const message = result.messages.find(message => message.id === normalized);

  if (!message) {
    throw new Error(`Could not resolve cursor message: ${cursor}`);
  }

  return message;
}

function getMessagePreview(message: MastraDBMessage, maxLength = 140): string {
  let text = '';

  if (typeof message.content === 'string') {
    text = message.content;
  } else if (Array.isArray(message.content?.parts)) {
    text = message.content.parts
      .map(part => {
        if (part.type === 'text') return part.text;
        if (part.type === 'tool-invocation') return `[tool:${part.toolInvocation.toolName}]`;
        if (part.type === 'reasoning') return '';
        if (part.type === 'source') return '[source]';
        if (part.type === 'step-start') return '';
        if (part.type.startsWith('data-')) return '';
        return '';
      })
      .filter(Boolean)
      .join(' ');
  } else if (typeof message.content?.content === 'string') {
    text = message.content.content;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '[no text content]';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function toListItem(message: MastraDBMessage, cursor: string): RecallListItem {
  return {
    id: message.id,
    role: message.role,
    createdAt: message.createdAt.toISOString(),
    preview: getMessagePreview(message),
    isCursor: message.id === cursor,
  };
}

async function listMessagesAroundCursor({
  memory,
  threadId,
  resourceId,
  cursor,
  page = 1,
  limit = 20,
}: {
  memory: RecallMemory;
  threadId: string;
  resourceId?: string;
  cursor: string;
  page?: number;
  limit?: number;
}): Promise<Extract<RecallResult, { mode: 'list' }>> {
  const normalizedPage = page === 0 ? 1 : page;
  const normalizedLimit = limit;
  const anchor = await resolveCursorMessage(memory, cursor);
  const recallThreadId = anchor.threadId;

  if (!recallThreadId) {
    throw new Error('The requested cursor is missing a thread id');
  }

  if (recallThreadId !== threadId) {
    throw new Error('The requested cursor does not belong to the current thread');
  }

  const isForward = normalizedPage > 0;
  const pageIndex = Math.max(Math.abs(normalizedPage), 1) - 1;
  const skip = pageIndex * normalizedLimit;

  const result = await memory.recall({
    threadId: recallThreadId,
    resourceId,
    page: 0,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
    filter: {
      dateRange: isForward
        ? {
            start: anchor.createdAt,
            startExclusive: true,
          }
        : {
            end: anchor.createdAt,
            endExclusive: true,
          },
    },
  });

  const orderedMessages = [...result.messages].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
  const pageMessages = isForward
    ? orderedMessages.slice(skip, skip + normalizedLimit)
    : orderedMessages.slice(
        Math.max(orderedMessages.length - skip - normalizedLimit, 0),
        orderedMessages.length - skip,
      );

  return {
    mode: 'list',
    cursor,
    page: normalizedPage,
    limit: normalizedLimit,
    direction: isForward ? 'forward' : 'backward',
    count: pageMessages.length,
    hasMore: isForward
      ? skip + normalizedLimit < orderedMessages.length
      : orderedMessages.length - skip - normalizedLimit > 0,
    items: pageMessages.map(message => toListItem(message, cursor)),
  };
}

async function inspectMessages({
  memory,
  threadId,
  resourceId,
  cursor,
  page = 1,
  limit = 20,
  messageIds,
}: {
  memory: RecallMemory;
  threadId: string;
  resourceId?: string;
  cursor: string;
  page?: number;
  limit?: number;
  messageIds?: string[];
}): Promise<Extract<RecallResult, { mode: 'inspect' }>> {
  const anchor = await resolveCursorMessage(memory, cursor);
  const inspectThreadId = anchor.threadId;

  if (!inspectThreadId) {
    throw new Error('The requested cursor is missing a thread id');
  }

  if (inspectThreadId !== threadId) {
    throw new Error('The requested cursor does not belong to the current thread');
  }

  let messages: MastraDBMessage[];
  let inspectedIds: string[] | undefined;

  if (messageIds && messageIds.length > 0) {
    const normalizedIds = [...new Set(messageIds.map(id => id.trim()).filter(Boolean))];

    if (normalizedIds.length === 0) {
      throw new Error('messageIds must include at least one non-empty message id');
    }

    const memoryStore = await memory.getMemoryStore();
    const result = await memoryStore.listMessagesById({ messageIds: normalizedIds });
    const foundById = new Map(result.messages.map(message => [message.id, message]));

    const missingIds = normalizedIds.filter(id => !foundById.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Could not resolve message ids: ${missingIds.join(', ')}`);
    }

    const outOfThreadIds = normalizedIds.filter(id => foundById.get(id)?.threadId !== inspectThreadId);
    if (outOfThreadIds.length > 0) {
      throw new Error(`The requested message ids do not belong to the current thread: ${outOfThreadIds.join(', ')}`);
    }

    messages = normalizedIds
      .map(id => foundById.get(id)!)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    inspectedIds = normalizedIds;
  } else {
    const listed = await listMessagesAroundCursor({ memory, threadId, resourceId, cursor, page, limit });
    const ids = listed.items.map(item => item.id);
    const memoryStore = await memory.getMemoryStore();
    const result = await memoryStore.listMessagesById({ messageIds: ids });
    const foundById = new Map(result.messages.map(message => [message.id, message]));
    messages = ids.map(id => foundById.get(id)).filter((message): message is MastraDBMessage => Boolean(message));
  }

  return {
    mode: 'inspect',
    cursor,
    page: page === 0 ? 1 : page,
    limit,
    count: messages.length,
    inspectedIds,
    items: messages.map(message => toListItem(message, cursor)),
    messages: formatMessagesForObserver(messages),
  };
}

export async function recallMessages({
  memory,
  threadId,
  resourceId,
  cursor,
  page = 1,
  limit = 20,
  mode = 'list',
  messageIds,
}: {
  memory: RecallMemory;
  threadId: string;
  resourceId?: string;
  cursor: string;
  page?: number;
  limit?: number;
  mode?: RecallMode;
  messageIds?: string[];
}): Promise<RecallResult> {
  if (!memory) {
    throw new Error('Memory instance is required for recall');
  }

  if (!threadId) {
    throw new Error('Thread ID is required for recall');
  }

  if (typeof memory.getMemoryStore !== 'function') {
    throw new Error('recall requires a Memory instance with storage access');
  }

  if (mode === 'inspect') {
    return inspectMessages({ memory, threadId, resourceId, cursor, page, limit, messageIds });
  }

  return listMessagesAroundCursor({ memory, threadId, resourceId, cursor, page, limit });
}

export const recallTool = (_memoryConfig?: MemoryConfigInternal) => {
  return createTool({
    id: 'recall',
    description:
      'Explore raw message history near an observation-group cursor. Start with mode="list" to browse nearby messages, then use mode="inspect" to fetch exact transcript details for specific message ids or a cursor window.',
    inputSchema: z.object({
      mode: z.enum(['list', 'inspect']).optional().describe('Exploration mode. Defaults to list.'),
      cursor: z.string().min(1).describe('The message id to use as the anchor cursor.'),
      page: z
        .number()
        .int()
        .optional()
        .describe(
          'Pagination offset from the cursor. Positive pages move forward, negative pages move backward, and 0 is treated as 1.',
        ),
      limit: z.number().int().positive().optional().describe('Maximum number of messages to return. Defaults to 20.'),
      messageIds: z
        .array(z.string().min(1))
        .optional()
        .describe('Optional exact message ids to inspect in detail. Only used with inspect mode.'),
    }),
    execute: async (
      {
        cursor,
        page,
        limit,
        mode,
        messageIds,
      }: { cursor: string; page?: number; limit?: number; mode?: RecallMode; messageIds?: string[] },
      context,
    ) => {
      const memory = (context as any)?.memory as RecallMemory | undefined;
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      if (!memory) {
        throw new Error('Memory instance is required for recall');
      }

      if (!threadId) {
        throw new Error('Thread ID is required for recall');
      }

      return recallMessages({
        memory,
        threadId,
        resourceId,
        cursor,
        page,
        limit,
        mode,
        messageIds,
      });
    },
  });
};
