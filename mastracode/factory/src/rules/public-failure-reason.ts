import { classifyProviderError, PROVIDER_CALL_ERROR_NAME } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';

import type { FactoryDispatchFailureCode } from '../storage/domains/work-items/base.js';
import { factoryDispatchFailureMetadata } from './dispatch-errors.js';

export function causeOf(error: unknown): unknown {
  return error && typeof error === 'object' && 'cause' in error ? error.cause : undefined;
}

export function isProviderCallError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('name' in error && typeof error.name === 'string' && PROVIDER_CALL_ERROR_NAME.test(error.name)) return true;
  return 'statusCode' in error || 'responseBody' in error;
}

// Fixed wording only: a public pull request must never see provider or internal error text.
const PROVIDER_FAILURE_DETAIL: Record<Exclude<ProviderFailureKind, 'unknown'>, string> = {
  auth: 'the model provider rejected the credentials',
  quota: 'the model provider quota is exhausted',
  rate_limited: 'the model provider rate-limited the run',
  context_overflow: 'the conversation exceeded the model context window',
  model_rejected: 'the model provider rejected the model',
  tool_history_rejected: 'the model provider rejected the tool-call history',
  timeout: 'the model provider timed out',
  unavailable: 'the model provider was unavailable',
  invalid_request: 'the model provider rejected the request',
};

// Built-in error names say what kind of fault it was without saying anything about where.
const PUBLIC_ERROR_NAMES = new Set([
  'AbortError',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TimeoutError',
  'TypeError',
  'URIError',
]);

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('name' in error)) return undefined;
  return typeof error.name === 'string' && PUBLIC_ERROR_NAMES.has(error.name) ? error.name : undefined;
}

const MAX_CAUSE_DEPTH = 8;

function causeChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  for (let current = error; current && chain.length < MAX_CAUSE_DEPTH; current = causeOf(current)) {
    if (chain.includes(current)) break;
    chain.push(current);
  }
  return chain;
}

function publicDetail(error: unknown): string | undefined {
  const chain = causeChain(error);
  for (const candidate of chain) {
    if (!isProviderCallError(candidate)) continue;
    const kind = classifyProviderError(candidate);
    if (kind !== 'unknown') return PROVIDER_FAILURE_DETAIL[kind];
  }
  for (const candidate of chain) {
    const name = errorName(candidate);
    if (name) return name;
  }
  return undefined;
}

/**
 * Why a run failed, safe to show on a public pull request: the failure code's label,
 * plus a detail drawn from a fixed vocabulary when the error can be classified.
 * Error messages are never included; operators read those from the decision's stored error.
 */
export function publicFailureReason(code: FactoryDispatchFailureCode, error: unknown): string {
  const label = factoryDispatchFailureMetadata(code).label;
  const detail = publicDetail(error);
  return detail ? `${label} (${detail})` : label;
}
