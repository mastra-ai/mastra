import { isValidationError } from '../tools/validation';

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

/** Classify the raw result before display transforms replace its content. */
export function isToolResultError(payload: {
  isError?: unknown;
  result?: unknown;
  providerMetadata?: unknown;
}): boolean {
  const providerMetadata = getRecord(payload.providerMetadata);
  const mastra = getRecord(providerMetadata?.mastra);
  const modelOutput = getRecord(mastra?.modelOutput);
  return (
    payload.isError === true ||
    isValidationError(payload.result) ||
    modelOutput?.type === 'error-json' ||
    modelOutput?.type === 'error-text'
  );
}
