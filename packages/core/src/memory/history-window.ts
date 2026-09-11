import type { MastraDBMessage } from '../agent/message-list';
import type { MemoryStorage } from '../storage';

/*
 * Compatibility note: @mastra/memory intentionally copies the helpers in this
 * file into packages/memory/src/index.ts instead of importing them. Its peer
 * range permits older core versions that do not export these newer names, and
 * importing them can crash published memory builds during ESM instantiation.
 * Until v2 can tighten that peer contract, keep both sides manually in sync.
 */

/** Minimum rows per read, so a small budget cannot force many round-trips. */
const MIN_READ_PAGE = 20;
/** Hard bound on continuation reads; `hasMore` normally ends the loop first. */
const MAX_HISTORY_PAGES = 25;

/**
 * Whether a stored row consumes the `lastMessages` history budget.
 *
 * `signal` rows (the working-memory, task, goal and browser state lanes) and
 * `system` rows never carry conversation content, so letting them consume the
 * budget evicts real messages. With `useStateSignals` a single assistant turn is
 * stored as assistant / signal / assistant, which means a `lastMessages: 2`
 * window can spend its whole budget on the newest turn and drop the previous
 * turn's tool calls and results (#23231).
 */
export function consumesHistoryBudget(message: MastraDBMessage): boolean {
  return message.role !== 'signal' && message.role !== 'system';
}

/**
 * Reads the newest rows until `budget` budget-consuming rows are collected or the
 * thread is exhausted, paging backwards one fixed-size page at a time.
 *
 * Rows that do not consume budget but fall inside the collected span are kept:
 * state-signal processors rely on an in-window snapshot to emit a delta instead
 * of re-injecting a full snapshot, and non-state signals (`user-message`,
 * `notification`) are genuine history.
 *
 * `hasMore` comes from the store's peek read (`includeTotal: false` derives it
 * from one extra row instead of `COUNT(*)`), so continuation pages stay cheap.
 * `includeTotal` is honoured on the first read only, for callers that report
 * `total`; continuation pages always skip the `COUNT(*)` work.
 *
 * @returns `messages` newest-first, in the order they were fetched
 */
export async function listNewestHistoryRows({
  storage,
  threadId,
  resourceId,
  budget,
  counts = consumesHistoryBudget,
  includeTotal,
}: {
  storage: MemoryStorage;
  threadId: string;
  resourceId?: string;
  budget: number;
  counts?: (message: MastraDBMessage) => boolean;
  includeTotal?: boolean;
}): Promise<{ messages: MastraDBMessage[]; total: number; hasMore: boolean }> {
  const perPage = Math.max(budget, MIN_READ_PAGE);
  // Continuation pages never need `total`. The first read keeps the caller's setting so that
  // `total` stays a real count when the caller did not opt out of it.
  const firstPageTotalOption = includeTotal !== undefined ? { includeTotal } : {};
  const collected: MastraDBMessage[] = [];
  let counted = 0;
  let total = 0;
  let hasMore = false;
  let filled = false;

  for (let page = 0; !filled && counted < budget && page < MAX_HISTORY_PAGES; page++) {
    const result = await storage.listMessages({
      threadId,
      resourceId,
      page,
      perPage,
      orderBy: { field: 'createdAt', direction: 'DESC' },
      ...(page === 0 ? firstPageTotalOption : { includeTotal: false }),
    });
    if (page === 0) total = result.total;
    if (result.messages.length === 0) {
      hasMore = false;
      break;
    }

    for (let i = 0; i < result.messages.length; i++) {
      const message = result.messages[i]!;
      collected.push(message);
      if (counts(message)) counted++;
      if (counted >= budget) {
        // Anything still in this page, or any later page, is outside the window.
        hasMore = i + 1 < result.messages.length || result.hasMore;
        filled = true;
        break;
      }
    }

    if (!filled) {
      hasMore = result.hasMore;
      if (!result.hasMore) break;
    }
  }

  return { messages: collected, total, hasMore };
}
