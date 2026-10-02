import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '@mastra/react/hooks';

const FEEDBACK_REFETCH_INTERVAL_MS = 30_000;

/** Disables polling for unsupported or unavailable feedback storage; otherwise retries every thirty seconds. */
export function getFeedbackRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'feedback') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return FEEDBACK_REFETCH_INTERVAL_MS;
}
