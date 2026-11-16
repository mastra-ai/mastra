import type { MastraClient } from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

/*
 * Optimistic feedback comments.
 *
 * Feedback writes are eventually consistent on Mastra Platform (Pub/Sub -> ClickHouse writer
 * batching): the create POST resolves before the row is queryable. Writing the new comment
 * straight into the list cache would be wiped by the post-submit refetch and the poll, so
 * pending comments live in their own cache entry and are merged into page 0 of the list
 * until the server returns the same `feedbackId`, or until they expire.
 */

type ListFeedbackResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;
export type FeedbackListItem = ListFeedbackResponse['feedback'][number];

/** How long a pending comment stays visible if the server never returns it (e.g. a lost write). */
export const OPTIMISTIC_FEEDBACK_TTL_MS = 60_000;

type PendingFeedback = { item: FeedbackListItem; expiresAt: number };

const NO_PENDING: FeedbackListItem[] = [];

const pendingFeedbackKey = (traceId: string, spanId?: string) => ['feedback-optimistic', traceId, spanId || null];

function removePendingFeedback(
  queryClient: QueryClient,
  traceId: string,
  spanId: string | undefined,
  shouldRemove: (entry: PendingFeedback) => boolean,
) {
  queryClient.setQueryData<PendingFeedback[]>(pendingFeedbackKey(traceId, spanId), entries => {
    if (!entries) return entries;
    const kept = entries.filter(entry => !shouldRemove(entry));
    return kept.length === entries.length ? entries : kept;
  });
}

export function addPendingFeedback(
  queryClient: QueryClient,
  { traceId, spanId, item }: { traceId: string; spanId?: string; item: FeedbackListItem },
) {
  queryClient.setQueryData<PendingFeedback[]>(pendingFeedbackKey(traceId, spanId), (entries = []) => [
    ...entries.filter(entry => entry.item.feedbackId !== item.feedbackId),
    { item, expiresAt: Date.now() + OPTIMISTIC_FEEDBACK_TTL_MS },
  ]);
}

export function discardPendingFeedback(
  queryClient: QueryClient,
  { traceId, spanId, feedbackId }: { traceId: string; spanId?: string; feedbackId: string },
) {
  removePendingFeedback(queryClient, traceId, spanId, entry => entry.item.feedbackId === feedbackId);
}

const timeOf = (item: FeedbackListItem) => new Date(item.timestamp).getTime();

/** Prepends pending comments the server does not return yet (newest first) and counts them in the total. */
export function mergePendingFeedback(data: ListFeedbackResponse, pending: FeedbackListItem[]): ListFeedbackResponse {
  if (pending.length === 0) return data;
  const serverIds = new Set(data.feedback.map(item => item.feedbackId));
  const missing = pending.filter(item => !serverIds.has(item.feedbackId)).sort((a, b) => timeOf(b) - timeOf(a));
  if (missing.length === 0) return data;
  return {
    ...data,
    feedback: [...missing, ...data.feedback],
    ...(data.pagination ? { pagination: { ...data.pagination, total: data.pagination.total + missing.length } } : {}),
  };
}

/** Stops tracking pending comments once a fetched first page returns them. */
export function settlePendingFeedback(
  queryClient: QueryClient,
  { traceId, spanId }: { traceId: string; spanId?: string },
  data: ListFeedbackResponse,
) {
  const serverIds = new Set(data.feedback.map(item => item.feedbackId));
  removePendingFeedback(queryClient, traceId, spanId, entry => serverIds.has(entry.item.feedbackId));
}

/** Pending comments for a trace (no `spanId`) or a span, to merge into the first page of its list. */
export function usePendingFeedback({
  traceId,
  spanId,
  enabled,
}: {
  traceId: string;
  spanId?: string;
  enabled: boolean;
}): FeedbackListItem[] {
  const queryClient = useQueryClient();
  const queryKey = pendingFeedbackKey(traceId, spanId);
  // Read-only view of a client-side cache entry written by useCreateFeedback; never fetched.
  const { data: entries } = useQuery({
    queryKey,
    queryFn: () => queryClient.getQueryData<PendingFeedback[]>(queryKey) ?? [],
    enabled: false,
    staleTime: Infinity,
    gcTime: OPTIMISTIC_FEEDBACK_TTL_MS,
  });

  useEffect(() => {
    if (!entries?.length) return;
    const nextExpiry = Math.min(...entries.map(entry => entry.expiresAt));
    const timer = setTimeout(
      () => removePendingFeedback(queryClient, traceId, spanId, entry => entry.expiresAt <= Date.now()),
      Math.max(0, nextExpiry - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [entries, queryClient, traceId, spanId]);

  return useMemo(
    () => (enabled && entries?.length ? entries.map(entry => entry.item) : NO_PENDING),
    [enabled, entries],
  );
}
