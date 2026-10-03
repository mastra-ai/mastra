import type { MastraDBMessage } from '../agent/message-list';
import { isTransientSignalMessage } from '../agent/signals';
import type { MemoryStorage, StorageListMessagesInput } from '../storage';
import type { MemoryTokenBoundary } from './message-history-config';
import { isAfterMemoryTokenBoundary } from './message-history-config';

const DEFAULT_HISTORY_PAGE_SIZE = 40;

type TokenCounter = {
  countMessage(message: MastraDBMessage): number | Promise<number>;
};

type HistoryLimits = {
  maxMessages?: number;
  maxTokens?: number;
  atMaxRemoveTokens?: number;
};

export type LoadMessageHistoryArgs = HistoryLimits & {
  storage: MemoryStorage;
  threadId: string;
  resourceId?: string;
  boundary?: MemoryTokenBoundary;
  filter?: StorageListMessagesInput['filter'];
  tokenCounter?: TokenCounter;
  initialTokens?: number;
  includeOverflow?: boolean;
  pageSize?: number;
};

export type LoadMessageHistoryResult = {
  messages: MastraDBMessage[];
  overflow: MastraDBMessage[];
};

function getToolCallIds(message: MastraDBMessage): string[] {
  const ids = new Set<string>();
  for (const part of message.content.parts) {
    if (part.type === 'tool-invocation' && part.toolInvocation?.toolCallId) {
      ids.add(part.toolInvocation.toolCallId);
    }
  }
  for (const invocation of message.content.toolInvocations ?? []) {
    if (invocation.toolCallId) ids.add(invocation.toolCallId);
  }
  return [...ids];
}

export function groupLinkedToolMessages(messages: MastraDBMessage[]): MastraDBMessage[][] {
  const parent = messages.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]!]!;
      index = parent[index]!;
    }
    return index;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  const firstMessageByToolCallId = new Map<string, number>();

  messages.forEach((message, index) => {
    for (const toolCallId of getToolCallIds(message)) {
      const firstIndex = firstMessageByToolCallId.get(toolCallId);
      if (firstIndex === undefined) firstMessageByToolCallId.set(toolCallId, index);
      else union(firstIndex, index);
    }
  });

  const groups = new Map<number, MastraDBMessage[]>();
  messages.forEach((message, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(message);
    groups.set(root, group);
  });
  return [...groups.values()];
}

async function partitionMessages(
  messagesDescending: MastraDBMessage[],
  limits: HistoryLimits,
  tokenCounter?: TokenCounter,
  initialTokens = 0,
): Promise<
  LoadMessageHistoryResult & {
    cutoff?: MastraDBMessage;
    overflowReason?: 'messages' | 'tokens';
  }
> {
  const maxTokens = limits.maxTokens === undefined ? undefined : limits.maxTokens - (limits.atMaxRemoveTokens ?? 0);
  if (maxTokens !== undefined && !tokenCounter) {
    throw new Error('A token counter is required to load token-limited message history');
  }

  const groups = groupLinkedToolMessages(messagesDescending);
  const countWindowGroups: MastraDBMessage[][] = [];
  const countWindowIds = new Set<string>();
  let messageCount = 0;
  let reachedMessageLimit = false;

  for (const group of groups) {
    const exceedsMessageLimit = limits.maxMessages !== undefined && messageCount + group.length > limits.maxMessages;
    if (reachedMessageLimit || exceedsMessageLimit) {
      reachedMessageLimit = true;
      continue;
    }

    messageCount += group.length;
    countWindowGroups.push(group);
    group.forEach(message => countWindowIds.add(message.id));
  }

  const retainedIds = new Set<string>();
  let tokenCount = initialTokens;
  let reachedTokenLimit = false;

  for (const group of countWindowGroups) {
    let groupTokens = 0;
    if (tokenCounter) {
      for (const message of group) groupTokens += await tokenCounter.countMessage(message);
    }
    const exceedsTokenLimit = maxTokens !== undefined && tokenCount + groupTokens > maxTokens;
    if (reachedTokenLimit || exceedsTokenLimit) {
      reachedTokenLimit = true;
      continue;
    }

    tokenCount += groupTokens;
    group.forEach(message => retainedIds.add(message.id));
  }

  const messages = messagesDescending.filter(message => retainedIds.has(message.id)).reverse();
  const overflow = messagesDescending
    .filter(message => countWindowIds.has(message.id) && !retainedIds.has(message.id))
    .reverse();
  const cutoff = messagesDescending.find(message => !retainedIds.has(message.id));
  const overflowReason = reachedTokenLimit ? 'tokens' : reachedMessageLimit ? 'messages' : undefined;
  return { messages, overflow, cutoff, overflowReason };
}

function laterDate(left: Date | undefined, right: Date | undefined): Date | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function earlierDate(left: Date | undefined, right: Date | undefined): Date | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() <= right.getTime() ? left : right;
}

/**
 * Loads newest message history through finite storage pages and applies count/token limits.
 * Pages use an inclusive timestamp cursor plus ID de-duplication so messages sharing a
 * timestamp are not skipped. Messages linked by a tool-call ID are retained or omitted together.
 */
export async function loadMessageHistory(args: LoadMessageHistoryArgs): Promise<LoadMessageHistoryResult> {
  const pageSize = args.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;
  const loadedById = new Map<string, MastraDBMessage>();
  let end: Date | undefined;
  let page = 0;
  let cutoffTimestamp: number | undefined;

  while (true) {
    const configuredStart = args.filter?.dateRange?.start;
    const boundaryStart = args.boundary ? new Date(args.boundary.createdAt) : undefined;
    const start = laterDate(configuredStart, boundaryStart);
    const configuredEnd = args.filter?.dateRange?.end;
    const rangeEnd = earlierDate(configuredEnd, end);
    const dateRange =
      start || rangeEnd
        ? {
            start,
            end: rangeEnd,
            startExclusive:
              configuredStart?.getTime() === start?.getTime() ? args.filter?.dateRange?.startExclusive : false,
            endExclusive:
              configuredEnd?.getTime() === rangeEnd?.getTime() ? args.filter?.dateRange?.endExclusive : false,
          }
        : undefined;
    const result = await args.storage.listMessages({
      threadId: args.threadId,
      resourceId: args.resourceId,
      page,
      perPage: pageSize,
      filter: args.filter || dateRange ? { ...args.filter, dateRange } : undefined,
      orderBy: { field: 'createdAt', direction: 'DESC' },
      includeTotal: false,
    });

    const pageMessages = result.messages.filter(
      message =>
        message.role !== 'system' &&
        !isTransientSignalMessage(message) &&
        (!args.boundary || isAfterMemoryTokenBoundary(message, args.boundary)),
    );
    let added = 0;
    for (const message of pageMessages) {
      if (!loadedById.has(message.id)) {
        loadedById.set(message.id, message);
        added++;
      }
    }

    const sorted = [...loadedById.values()].sort((left, right) => {
      const timeDifference = right.createdAt.getTime() - left.createdAt.getTime();
      return timeDifference || right.id.localeCompare(left.id);
    });
    const partitioned = await partitionMessages(sorted, args, args.tokenCounter, args.initialTokens);
    if (partitioned.cutoff) cutoffTimestamp = partitioned.cutoff.createdAt.getTime();

    const oldestPageMessage = result.messages.at(-1);
    const oldestTimestamp = oldestPageMessage?.createdAt.getTime();
    const crossedCutoff =
      cutoffTimestamp !== undefined && oldestTimestamp !== undefined && oldestTimestamp < cutoffTimestamp;
    const reachedBoundary =
      args.boundary !== undefined &&
      oldestTimestamp !== undefined &&
      oldestTimestamp < new Date(args.boundary.createdAt).getTime();

    if (!result.hasMore || crossedCutoff || reachedBoundary || result.messages.length === 0) {
      return args.includeOverflow && partitioned.overflowReason === 'tokens'
        ? partitioned
        : { messages: partitioned.messages, overflow: [] };
    }

    if (oldestTimestamp === undefined) {
      return args.includeOverflow && partitioned.overflowReason === 'tokens'
        ? partitioned
        : { messages: partitioned.messages, overflow: [] };
    }

    if (end?.getTime() === oldestTimestamp && added === 0) {
      page++;
    } else {
      end = new Date(oldestTimestamp);
      page = 0;
    }
  }
}
