import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '../query/query-utils';

const FEEDBACK_REFETCH_INTERVAL_MS = 30_000;

// TODO: Feedback writes are eventually consistent on Mastra Platform (Pub/Sub -> ClickHouse writer batching), so a
// just-submitted comment is not queryable right away. While one is pending, the list polls quickly to pick up the
// stored record. Remove once the backend offers read-your-writes for feedback.
const PENDING_FEEDBACK_REFETCH_INTERVAL_MS = 3_000;

/**
 * Disables polling for unsupported or unavailable feedback storage. Otherwise polls every 30 seconds,
 * or every 3 seconds while the list shows a comment the server has not returned yet.
 */
export function getFeedbackRefetchInterval(query: { state: { error: unknown } }, hasPendingFeedback = false) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'feedback') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return hasPendingFeedback ? PENDING_FEEDBACK_REFETCH_INTERVAL_MS : FEEDBACK_REFETCH_INTERVAL_MS;
}
