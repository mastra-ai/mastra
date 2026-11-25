import type { MastraClient } from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { FeedbackListResponse } from './optimistic-feedback';

/*
 * Pending feedback deletions.
 *
 * Deletes are eventually consistent on Mastra Platform: the DELETE request is accepted (202)
 * and a background cleanup job removes the row later, so the list keeps returning it for a while.
 * Accepted deletions live in their own cache entry and mark the row `deleteStatus: 'deleting'`
 * until a fetch of the page it was last seen on stops returning it. If that does not happen in time, the row
 * is marked `deleteStatus: 'failed'` so the UI can show it again with an error.
 */

type ListFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;

/** How long a row shows as deleting before it is restored with an error. */
export const PENDING_FEEDBACK_DELETION_TTL_MS = 5 * 60_000;

type PendingDeletion = {
  feedbackId: string;
  expiresAt: number;
  failed: boolean;
  /** List page the row was last returned on; a fetch of that page without the row settles the deletion. */
  page?: number;
};

const pendingDeletionsKey = (traceId: string, spanId?: string) => ['feedback-deleting', traceId, spanId || null];

function updatePendingDeletions(
  queryClient: QueryClient,
  traceId: string,
  spanId: string | undefined,
  update: (entries: PendingDeletion[]) => PendingDeletion[],
) {
  queryClient.setQueryData<PendingDeletion[]>(pendingDeletionsKey(traceId, spanId), entries => {
    if (!entries) return entries;
    const next = update(entries);
    const changed = next.length !== entries.length || next.some((entry, i) => entry !== entries[i]);
    return changed ? next : entries;
  });
}

const feedbackListKey = (traceId: string, spanId?: string) =>
  spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId];

/** The list page whose cached copy shows the row, i.e. the page it was deleted from. */
function findCachedPage(queryClient: QueryClient, traceId: string, spanId: string | undefined, feedbackId: string) {
  const match = queryClient
    .getQueriesData<ListFeedbackResponse>({ queryKey: feedbackListKey(traceId, spanId) })
    .find(([, data]) => data?.feedback.some(item => item.feedbackId === feedbackId));
  const page = match?.[0].at(-1);
  return typeof page === 'number' ? page : undefined;
}

export function addPendingFeedbackDeletion(
  queryClient: QueryClient,
  { traceId, spanId, feedbackId }: { traceId: string; spanId?: string; feedbackId: string },
) {
  const page = findCachedPage(queryClient, traceId, spanId, feedbackId);
  queryClient.setQueryData<PendingDeletion[]>(pendingDeletionsKey(traceId, spanId), (entries = []) => [
    ...entries.filter(entry => entry.feedbackId !== feedbackId),
    { feedbackId, expiresAt: Date.now() + PENDING_FEEDBACK_DELETION_TTL_MS, failed: false, page },
  ]);
}

/** Marks rows with an accepted deletion as `deleting`, or `failed` once the deletion timed out. */
export function applyPendingFeedbackDeletions(
  data: FeedbackListResponse,
  entries: PendingDeletion[],
): FeedbackListResponse {
  if (entries.length === 0) return data;
  const byId = new Map(entries.map(entry => [entry.feedbackId, entry]));
  if (!data.feedback.some(item => item.feedbackId && byId.has(item.feedbackId))) return data;
  return {
    ...data,
    feedback: data.feedback.map(item => {
      const entry = item.feedbackId ? byId.get(item.feedbackId) : undefined;
      return entry ? { ...item, deleteStatus: entry.failed ? 'failed' : 'deleting' } : item;
    }),
  };
}

/**
 * Runs on every fetch of a feedback page, including the 3s poll while a deletion is pending.
 * Records which page each deleting row was returned on, and stops tracking a deletion once a
 * fetch of the page it was last seen on no longer returns it, i.e. the row is gone. Comparing
 * against the page rather than the previous fetch also settles a row that went away while the
 * list was unmounted (the list cache is dropped on unmount). A deletion still pending after
 * `PENDING_FEEDBACK_DELETION_TTL_MS` is marked `failed`.
 */
export function settlePendingFeedbackDeletions(
  queryClient: QueryClient,
  { traceId, spanId, page }: { traceId: string; spanId?: string; page: number },
  data: ListFeedbackResponse,
) {
  const currentIds = new Set(data.feedback.map(item => item.feedbackId));
  const now = Date.now();
  updatePendingDeletions(queryClient, traceId, spanId, entries =>
    entries.flatMap(entry => {
      const returned = currentIds.has(entry.feedbackId);
      if (!returned && entry.page === page) return [];
      const nextPage = returned ? page : entry.page;
      const failed = entry.failed || entry.expiresAt <= now;
      return nextPage === entry.page && failed === entry.failed ? [entry] : [{ ...entry, page: nextPage, failed }];
    }),
  );
}

const NO_DELETIONS: PendingDeletion[] = [];

/** Deletions accepted for a trace (no `spanId`) or a span, to mark in its feedback list. */
export function usePendingFeedbackDeletions({ traceId, spanId }: { traceId: string; spanId?: string }) {
  const queryClient = useQueryClient();
  const queryKey = pendingDeletionsKey(traceId, spanId);
  // Read-only view of a client-side cache entry written by useDeleteFeedback; never fetched.
  const { data = NO_DELETIONS } = useQuery({
    queryKey,
    queryFn: () => queryClient.getQueryData<PendingDeletion[]>(queryKey) ?? [],
    enabled: false,
    staleTime: Infinity,
    gcTime: PENDING_FEEDBACK_DELETION_TTL_MS,
  });
  return data;
}

/** True while at least one deletion is waiting for the server to drop its row. */
export const hasDeletingFeedback = (entries: PendingDeletion[]) => entries.some(entry => !entry.failed);
