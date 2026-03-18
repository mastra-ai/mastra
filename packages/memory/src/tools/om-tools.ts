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

function parseRangeFormat(cursor: string): { startId: string; endId: string } | null {
  // Comma-separated merged ranges: "id1:id2,id3:id4"
  if (cursor.includes(',')) {
    const parts = cursor.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 1) {
      const first = parts[0]!;
      const last = parts[parts.length - 1]!;
      const firstColon = first.indexOf(':');
      const lastColon = last.indexOf(':');
      return {
        startId: firstColon > 0 ? first.slice(0, firstColon) : first,
        endId: lastColon > 0 ? last.slice(lastColon + 1) : last,
      };
    }
  }

  // Colon-delimited range: "startId:endId"
  const colonIndex = cursor.indexOf(':');
  if (colonIndex > 0 && colonIndex < cursor.length - 1) {
    return { startId: cursor.slice(0, colonIndex), endId: cursor.slice(colonIndex + 1) };
  }

  return null;
}

async function resolveCursorMessage(
  memory: RecallMemory,
  cursor: string,
): Promise<MastraDBMessage | { hint: string; startId: string; endId: string }> {
  const normalized = cursor.trim();

  if (!normalized) {
    throw new Error('Cursor is required');
  }

  const rangeIds = parseRangeFormat(normalized);
  if (rangeIds) {
    return {
      hint: `The cursor "${cursor}" looks like a range. Use one of the individual message IDs as the cursor instead: start="${rangeIds.startId}" or end="${rangeIds.endId}".`,
      ...rangeIds,
    };
  }

  const memoryStore = await memory.getMemoryStore();
  const result = await memoryStore.listMessagesById({ messageIds: [normalized] });
  const message = result.messages.find(message => message.id === normalized);

  if (!message) {
    throw new Error(`Could not resolve cursor message: ${cursor}`);
  }

  return message;
}

export async function recallMessages({
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
}): Promise<{ messages: string; count: number; cursor: string; page: number; limit: number }> {
  if (!memory) {
    throw new Error('Memory instance is required for recall');
  }

  if (!threadId) {
    throw new Error('Thread ID is required for recall');
  }

  if (typeof memory.getMemoryStore !== 'function') {
    throw new Error('recall requires a Memory instance with storage access');
  }

  const normalizedPage = page === 0 ? 1 : page;
  const normalizedLimit = limit;

  const resolved = await resolveCursorMessage(memory, cursor);

  if ('hint' in resolved) {
    return {
      messages: resolved.hint,
      count: 0,
      cursor,
      page: normalizedPage,
      limit: normalizedLimit,
    };
  }

  const anchor = resolved;

  if (anchor.threadId !== threadId) {
    throw new Error('The requested cursor does not belong to the current thread');
  }

  const isForward = normalizedPage > 0;
  const pageIndex = Math.max(Math.abs(normalizedPage), 1) - 1;
  const skip = pageIndex * normalizedLimit;

  const result = await memory.recall({
    threadId,
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
  const messages = isForward
    ? orderedMessages.slice(skip, skip + normalizedLimit)
    : orderedMessages.slice(
        Math.max(orderedMessages.length - skip - normalizedLimit, 0),
        orderedMessages.length - skip,
      );

  return {
    messages: formatMessagesForObserver(messages),
    count: messages.length,
    cursor,
    page: normalizedPage,
    limit: normalizedLimit,
  };
}

export const recallTool = (_memoryConfig?: MemoryConfigInternal) => {
  return createTool({
    id: 'recall',
    description:
      'Retrieve raw message history near an observation group cursor. Observation group ranges use the format startId:endId. Pass either the start or end message ID as the cursor to retrieve messages around that point.',
    inputSchema: z.object({
      cursor: z
        .string()
        .min(1)
        .describe('A single message ID to use as the pagination cursor. Extract it from the start or end of a range.'),
      page: z
        .number()
        .int()
        .optional()
        .describe(
          'Pagination offset from the cursor. Positive pages move forward, negative pages move backward, and 0 is treated as 1.',
        ),
      limit: z.number().int().positive().optional().describe('Maximum number of messages to return. Defaults to 20.'),
    }),
    execute: async ({ cursor, page, limit }: { cursor: string; page?: number; limit?: number }, context) => {
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
      });
    },
  });
};
