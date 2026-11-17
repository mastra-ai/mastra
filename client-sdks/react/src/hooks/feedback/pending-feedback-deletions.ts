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
 * until a refetch of the same page stops returning it. If that does not happen in time, the row
 * is marked `deleteStatus: 'failed'` so the UI can show it again with an error.
 */

type ListFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;

/** How long a row shows as deleting before it is restored with an error. */
export const PENDING_FEEDBACK_DELETION_TTL_MS = 5 * 60_000;

type PendingDeletion = { feedbackId: string; expiresAt: number; failed: boolean };

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

export function addPendingFeedbackDeletion(
  queryClient: QueryClient,
  { traceId, spanId, feedbackId }: { traceId: string; spanId?: string; feedbackId: string },
) {
  queryClient.setQueryData<PendingDeletion[]>(pendingDeletionsKey(traceId, spanId), (entries = []) => [
    ...entries.filter(entry => entry.feedbackId !== feedbackId),
    { feedbackId, expiresAt: Date.now() + PENDING_FEEDBACK_DELETION_TTL_MS, failed: false },
  ]);
  // No-op if the row was dropped (settled) or the entry was garbage-collected before then.
  setTimeout(
    () =>
      updatePendingDeletions(queryClient, traceId, spanId, entries =>
        entries.map(entry => (!entry.failed && entry.expiresAt <= Date.now() ? { ...entry, failed: true } : entry)),
      ),
    PENDING_FEEDBACK_DELETION_TTL_MS,
  );
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
 * Stops tracking deletions of rows that the previous fetch of this page returned and this one
 * does not, i.e. the row is gone.
 */
export function settlePendingFeedbackDeletions(
  queryClient: QueryClient,
  { traceId, spanId }: { traceId: string; spanId?: string },
  previous: ListFeedbackResponse | undefined,
  data: ListFeedbackResponse,
) {
  if (!previous) return;
  const previousIds = new Set(previous.feedback.map(item => item.feedbackId));
  const currentIds = new Set(data.feedback.map(item => item.feedbackId));
  updatePendingDeletions(queryClient, traceId, spanId, entries =>
    entries.filter(entry => !(previousIds.has(entry.feedbackId) && !currentIds.has(entry.feedbackId))),
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
