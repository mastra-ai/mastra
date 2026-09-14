import {
  isObservabilityUnavailableError,
  isUnsupportedObservabilityOperationError,
} from '@mastra/playground-ui/utils/query-utils';

const FEEDBACK_REFETCH_INTERVAL_MS = 3000;

export function getFeedbackRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'feedback') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return FEEDBACK_REFETCH_INTERVAL_MS;
}
