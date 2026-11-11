// Structural capability types keep memory compatible with cores predating bounded paging.
export type ObservationHistoryState = { after?: { createdAt: string; id: string }; end?: string; complete?: boolean };
type ObservationHistoryPageInput = {
  threadId?: string;
  resourceId?: string;
  after?: { createdAt: string; id: string };
  start?: string;
  end?: string;
  limit: number;
  order?: 'asc' | 'desc';
};
type ObservationHistoryPage<T> = { messages: T[]; hasMore: boolean };
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

import type { TokenCounter } from './token-counter';

export type ObservationHistoryStorage = MemoryStorage & {
  supportsObservationHistoryPaging?: boolean;
  listObservationHistory(input: ObservationHistoryPageInput): Promise<ObservationHistoryPage<MastraDBMessage>>;
};

export function supportsObservationHistoryPaging(storage: MemoryStorage): storage is ObservationHistoryStorage {
  return (
    'supportsObservationHistoryPaging' in storage &&
    storage.supportsObservationHistoryPaging === true &&
    'listObservationHistory' in storage &&
    typeof storage.listObservationHistory === 'function'
  );
}

export function getObservationHistoryState(record: ObservationalMemoryRecord): ObservationHistoryState | undefined {
  const state = record.metadata?.observationHistory;
  if (!state || typeof state !== 'object') return undefined;
  const value = state as Record<string, unknown>;
  if (value.end !== undefined && (typeof value.end !== 'string' || !Number.isFinite(Date.parse(value.end))))
    return undefined;
  if (value.after !== undefined) {
    if (!value.after || typeof value.after !== 'object') return undefined;
    const after = value.after as Record<string, unknown>;
    if (
      typeof after.id !== 'string' ||
      typeof after.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(after.createdAt))
    )
      return undefined;
    return {
      after: { id: after.id, createdAt: after.createdAt },
      ...(value.end === undefined ? {} : { end: value.end as string }),
      ...(value.complete === true ? { complete: true } : {}),
    };
  }
  return {
    ...(value.end === undefined ? {} : { end: value.end as string }),
    ...(value.complete === true ? { complete: true } : {}),
  };
}

export async function loadObservationHistory(args: {
  storage: ObservationHistoryStorage;
  threadId?: string;
  resourceId?: string;
  record: ObservationalMemoryRecord;
  tokenCounter: TokenCounter;
  budget: number;
  isObservable(message: MastraDBMessage): boolean | Promise<boolean>;
}) {
  const prior = getObservationHistoryState(args.record);
  const latest = prior
    ? undefined
    : await args.storage.listObservationHistory({
        threadId: args.threadId,
        resourceId: args.resourceId,
        limit: 1,
        order: 'desc',
      });
  const end = prior ? prior.end : latest?.messages[0]?.createdAt.toISOString();
  let after = prior?.after;
  const start =
    !prior && args.threadId && args.record.lastObservedAt
      ? new Date(args.record.lastObservedAt).toISOString()
      : undefined;
  const observed = new Set(Array.isArray(args.record.observedMessageIds) ? args.record.observedMessageIds : []);
  const messages: MastraDBMessage[] = [];
  let tokens = 24;
  while (true) {
    const page = await args.storage.listObservationHistory({
      threadId: args.threadId,
      resourceId: args.resourceId,
      start,
      after,
      end,
      limit: 40,
    });
    for (let index = 0; index < page.messages.length; index++) {
      const message = page.messages[index]!;
      after = { createdAt: new Date(message.createdAt).toISOString(), id: message.id };
      if (observed.has(message.id) || !(await args.isObservable(message))) continue;
      // Legacy records excluded every message at lastObservedAt. Only the new tuple cursor
      // allows a partially observed timestamp cohort to remain eligible.
      if (!prior && start && new Date(message.createdAt).getTime() <= Date.parse(start)) continue;
      messages.push(message);
      tokens += await args.tokenCounter.countMessageAsync(message);
    }
    const hasMore = page.messages.length > 0 && page.hasMore;
    if (tokens >= args.budget || !hasMore) {
      return {
        messages,
        state: { after, ...(hasMore && end ? { end } : {}), ...(!hasMore ? { complete: true } : {}) },
        hasMore,
      };
    }
  }
}
