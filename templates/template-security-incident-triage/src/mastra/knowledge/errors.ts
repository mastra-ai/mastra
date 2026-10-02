export type RunbookErrorCode =
  | 'RUNBOOK_ACTION_NOT_ALLOWLISTED'
  | 'RUNBOOK_AMBIGUOUS'
  | 'RUNBOOK_BACKEND_UNAVAILABLE'
  | 'RUNBOOK_INELIGIBLE'
  | 'RUNBOOK_INTEGRITY_FAILED'
  | 'RUNBOOK_MISSING'
  | 'RUNBOOK_QUERY_EMPTY'
  | 'RUNBOOK_SCORE_INSUFFICIENT'
  | 'RUNBOOK_VALIDATION_FAILED';

export class RunbookError extends Error {
  constructor(
    readonly code: RunbookErrorCode,
    readonly retryable = false,
  ) {
    super('Runbook retrieval could not be completed safely.');
    this.name = 'RunbookError';
  }
}
