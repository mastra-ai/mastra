import type { Reason } from '../contracts/answer.ts';

export class ProcessingFailure extends Error {
  readonly code: Reason;
  readonly transient: boolean;
  constructor(code: Reason, transient = false) {
    super(code);
    this.code = code;
    this.transient = transient;
  }
}
export function providerFailure(error: unknown): ProcessingFailure {
  if (error instanceof ProcessingFailure) return error;
  const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 0;
  if (status === 401 || status === 403) return new ProcessingFailure('AUTHENTICATION_FAILURE');
  if (status === 400 || status === 404 || status === 422) return new ProcessingFailure('MODEL_UNAVAILABLE');
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return new ProcessingFailure(
    'PROVIDER_FAILURE',
    status === 429 || status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(String(code)),
  );
}
export const globalFailures: readonly Reason[] = [
  'AUTHENTICATION_FAILURE',
  'MODEL_UNAVAILABLE',
  'STORAGE_FAILURE',
  'BUDGET_EXHAUSTED',
  'TIME_LIMIT',
  'TOKEN_LIMIT',
];
