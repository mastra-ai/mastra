import type { FeedbackItem, ListFeedbackResponse } from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';

/** Published feedback may not be readable yet. Keep it separate from fetched pages until ingestion catches up. */
const submittedKey = (traceId: string, spanId?: string) => ['submitted-feedback', traceId, spanId || null];
export const feedbackListKey = (traceId: string, spanId?: string) =>
  spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId];

function overlaySubmitted(response: ListFeedbackResponse, submitted: FeedbackItem[]): ListFeedbackResponse {
  if (response.pagination && response.pagination.page !== 0) return response;
  const visibleIds = new Set(response.feedback.map(record => record.feedbackId));
  const missing = submitted.filter(record => !visibleIds.has(record.feedbackId));
  if (!missing.length) return response;
  return {
    ...response,
    feedback: [...missing, ...response.feedback],
    ...(response.pagination && {
      pagination: { ...response.pagination, total: response.pagination.total + missing.length },
    }),
  };
}

export function rememberSubmittedFeedback(
  queryClient: QueryClient,
  traceId: string,
  spanId: string | undefined,
  feedback: FeedbackItem,
) {
  // Survive panel unmounts (the list queries use gcTime: 0). Explicitly discard on read/delete or client.clear().
  queryClient.setQueryDefaults(['submitted-feedback'], { gcTime: Infinity });
  const key = submittedKey(traceId, spanId);
  queryClient.setQueryData<FeedbackItem[]>(key, previous => [
    feedback,
    ...(previous ?? []).filter(record => record.feedbackId !== feedback.feedbackId),
  ]);
  const submitted = queryClient.getQueryData<FeedbackItem[]>(key) ?? [];
  queryClient.setQueriesData<ListFeedbackResponse>(
    { queryKey: feedbackListKey(traceId, spanId), predicate: query => query.queryKey.at(-1) === 0 },
    previous => (previous ? overlaySubmitted(previous, submitted) : previous),
  );
}

export function forgetSubmittedFeedback(
  queryClient: QueryClient,
  traceId: string,
  spanId: string | undefined,
  feedbackIds: Set<string | null | undefined>,
) {
  const key = submittedKey(traceId, spanId);
  const previous = queryClient.getQueryData<FeedbackItem[]>(key);
  if (!previous) return;
  const remaining = previous.filter(record => !feedbackIds.has(record.feedbackId));
  if (remaining.length === previous.length) return;
  if (remaining.length) queryClient.setQueryData(key, remaining);
  else queryClient.removeQueries({ queryKey: key, exact: true });
}

/** Only reconcile against a fresh server response, never a cached page containing local submissions. */
export function reconcileSubmittedFeedback(
  queryClient: QueryClient,
  traceId: string,
  spanId: string | undefined,
  response: ListFeedbackResponse,
): ListFeedbackResponse {
  forgetSubmittedFeedback(queryClient, traceId, spanId, new Set(response.feedback.map(record => record.feedbackId)));
  return overlaySubmitted(response, queryClient.getQueryData<FeedbackItem[]>(submittedKey(traceId, spanId)) ?? []);
}
