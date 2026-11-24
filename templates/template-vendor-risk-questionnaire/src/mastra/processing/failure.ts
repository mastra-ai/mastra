import { isStorageFailure } from '../persistence/client.ts';
import type { Reason } from '../contracts/answer.ts';
import type { ProcessingDiagnostic } from '../contracts/processing-diagnostic.ts';

export class ProcessingFailure extends Error {
  readonly code: Reason;
  readonly transient: boolean;
  constructor(code: Reason, transient = false) {
    super(code);
    this.stack = code;
    this.code = code;
    this.transient = transient;
  }
}
export class OutputValidationFailure extends ProcessingFailure {
  readonly schemaIssues?: Pick<ProcessingDiagnostic, 'schemaInvariants' | 'schemaIssueCount'>;
  readonly category: Extract<
    ProcessingDiagnostic['category'],
    'CALLBACK_SCHEMA' | 'BATCH_IDENTITY' | 'REQUEST_GROUNDING'
  >;
  constructor(
    category: Extract<ProcessingDiagnostic['category'], 'CALLBACK_SCHEMA' | 'BATCH_IDENTITY' | 'REQUEST_GROUNDING'>,
    schemaIssues?: Pick<ProcessingDiagnostic, 'schemaInvariants' | 'schemaIssueCount'>,
  ) {
    super('INVALID_MODEL_OUTPUT');
    this.category = category;
    this.schemaIssues = schemaIssues;
  }
}
export function providerFailure(error: unknown): ProcessingFailure {
  if (error instanceof ProcessingFailure) return error;
  if (isStorageFailure(error)) return new ProcessingFailure('STORAGE_FAILURE');
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
];
