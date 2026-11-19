export type ObservationHistoryCursor = { createdAt: string; id: string };

export type ObservationHistoryState = {
  after?: ObservationHistoryCursor;
  /** Frozen initial-history upper bound. Removed once the initial history is drained. */
  end?: string;
  complete?: boolean;
};

export type ObservationHistoryPageInput = {
  threadId?: string;
  resourceId?: string;
  after?: ObservationHistoryCursor;
  before?: ObservationHistoryCursor;
  start?: string;
  end?: string;
  limit: number;
  order?: 'asc' | 'desc';
};

export type ObservationHistoryPage<T> = { messages: T[]; hasMore: boolean };

/** A recomposed CAS retry must not move an already committed prefix backwards. */
export function mergeObservationHistory(stored: unknown, incoming: ObservationHistoryState): ObservationHistoryState {
  if (!stored || typeof stored !== 'object') return incoming;
  const prior = stored as ObservationHistoryState;
  if (prior.after && typeof prior.after.createdAt === 'string' && typeof prior.after.id === 'string') {
    if (!incoming.after) return prior;
    const difference =
      Date.parse(prior.after.createdAt) - Date.parse(incoming.after.createdAt) ||
      Buffer.compare(Buffer.from(prior.after.id), Buffer.from(incoming.after.id));
    if (difference > 0) return prior;
  }
  return { ...incoming, ...(incoming.end && prior.end ? { end: prior.end } : {}) };
}
