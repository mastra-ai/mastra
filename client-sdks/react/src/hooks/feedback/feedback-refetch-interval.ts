import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '../query/query-utils';

// TODO: The 3s poll is a temporary mitigation. Feedback writes (create, review-status, delete) are eventually
// consistent on Mastra Platform (Pub/Sub -> ClickHouse writer batching), so the refetch fired by the mutation's
// onSuccess invalidation often runs before the row is queryable. This does not scale (every open feedback panel
// polls every 3s) and should be removed once the backend offers read-your-writes for feedback.
const FEEDBACK_REFETCH_INTERVAL_MS = 3_000;

/** Disables polling for unsupported or unavailable feedback storage; otherwise retries every three seconds. */
export function getFeedbackRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'feedback') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return FEEDBACK_REFETCH_INTERVAL_MS;
}
