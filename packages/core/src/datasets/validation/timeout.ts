import { ErrorCategory, ErrorDomain, MastraError } from '../../error';

export const MAX_EXPERIMENT_ITEM_TIMEOUT_MS = 30 * 60 * 1_000;

export function validateExperimentTimeout(timeout: number | undefined, path: string): void {
  if (timeout === undefined) return;

  if (
    typeof timeout !== 'number' ||
    !Number.isInteger(timeout) ||
    timeout <= 0 ||
    timeout > MAX_EXPERIMENT_ITEM_TIMEOUT_MS
  ) {
    throw new MastraError({
      id: 'EXPERIMENT_TIMEOUT_INVALID',
      text: `${path} must be a positive integer no greater than ${MAX_EXPERIMENT_ITEM_TIMEOUT_MS} milliseconds (30 minutes).`,
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      details: {
        path,
        value: String(timeout),
        maxTimeoutMs: MAX_EXPERIMENT_ITEM_TIMEOUT_MS,
      },
    });
  }
}
