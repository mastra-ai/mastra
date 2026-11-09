import { MastraNonRetryableError } from '@mastra/core/error';
import { NonRetriableError } from 'inngest';

/** Whether a step failure (an error, or a serialized failure record) asks not to be retried. */
export function isNonRetryableStepFailure(error: unknown): boolean {
  if (error instanceof MastraNonRetryableError || error instanceof NonRetriableError) {
    return true;
  }

  if (error instanceof Error && error.cause !== undefined && isNonRetryableStepFailure(error.cause)) {
    return true;
  }

  if (error && typeof error === 'object') {
    const record = error as {
      nonRetryable?: true;
      error?: unknown;
      name?: string;
      isNonRetryable?: boolean;
    };

    if (record.nonRetryable) {
      return true;
    }

    if (record.name === 'MastraNonRetryableError' || record.isNonRetryable) {
      return true;
    }

    if (record.error !== undefined && isNonRetryableStepFailure(record.error)) {
      return true;
    }
  }

  return false;
}
