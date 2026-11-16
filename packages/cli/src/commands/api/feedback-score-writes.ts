import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { requestApi } from './client.js';
import type { ApiRequestOptions } from './client.js';
import { ApiCliError } from './errors.js';
import type { ApiCommandDescriptor } from './types.js';

export function isFeedbackScoreWrite(descriptor: ApiCommandDescriptor): boolean {
  return ['scoreCreate', 'feedbackCreate', 'feedbackReplace'].includes(descriptor.key);
}

/** Prepare once per invocation, outside transport retries and credential fallback. */
export function prepareFeedbackScoreInput(
  descriptor: ApiCommandDescriptor,
  input: Record<string, unknown> | undefined,
  pathParams: Record<string, string>,
): Record<string, unknown> | undefined {
  if (descriptor.key === 'feedbackReview-status') {
    if (!input || Object.keys(input).some(key => key !== 'reviewStatus')) {
      throw new ApiCliError('INVALID_INPUT', 'Review-status input must contain only reviewStatus');
    }
    return input;
  }
  if (!isFeedbackScoreWrite(descriptor)) return input;
  const kind = descriptor.key === 'scoreCreate' ? 'score' : 'feedback';
  const value = input?.[kind];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiCliError('INVALID_INPUT', `Input must contain a wrapped ${kind} object`);
  }
  const record = value as Record<string, unknown>;
  requireString(record, 'traceId');
  if (descriptor.key === 'feedbackReplace') {
    requireString(record, 'feedbackId');
    requireString(record, 'timestamp');
    if (record.feedbackId !== pathParams.feedbackId) {
      throw new ApiCliError('INVALID_INPUT', 'feedback.feedbackId must match the feedbackId argument');
    }
    return input;
  }
  return {
    ...input,
    [kind]: {
      ...record,
      [`${kind}Id`]: record[`${kind}Id`] ?? randomUUID(),
      timestamp: record.timestamp ?? new Date().toISOString(),
    },
  };
}

function requireString(record: Record<string, unknown>, key: string): void {
  if (typeof record[key] !== 'string' || !record[key].trim()) {
    throw new ApiCliError('INVALID_INPUT', `${key} must be a nonblank string`);
  }
}

/** POST/PUT only. PATCH must report missing stored feedback immediately. */
export async function requestFeedbackScoreWrite(
  options: ApiRequestOptions,
  fallbackHeaders?: Record<string, string>,
): Promise<unknown> {
  // Take a JSON snapshot so every attempt sends exactly the same record, including caller-supplied dates.
  const input = options.input ? JSON.parse(JSON.stringify(options.input)) : undefined;
  const deadline = Date.now() + Math.min(options.timeoutMs, 30_000);
  let headers = options.headers;
  let fallback = fallbackHeaders;
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestApi({ ...options, input, headers, timeoutMs: Math.max(1, deadline - Date.now()) });
    } catch (error) {
      if (!(error instanceof ApiCliError)) throw error;
      if (error.details.status === 401 && fallback && attempt < 5 && Date.now() < deadline) {
        headers = fallback;
        fallback = undefined;
        continue;
      }
      const delay = Math.min(500 * 2 ** attempt, 4000);
      if (attempt >= 5 || Date.now() + delay >= deadline || !isRetryable(error)) throw error;
      await sleep(delay);
    }
  }
}

function isRetryable(error: ApiCliError): boolean {
  if (error.code === 'SERVER_UNREACHABLE') return true;
  if (error.code !== 'HTTP_ERROR') return false;
  const status = error.details.status;
  if (status === 404) {
    const body = error.details.body as { code?: unknown } | undefined;
    return body?.code === 'TRACE_NOT_FOUND' || body?.code === 'SPAN_NOT_FOUND';
  }
  // Retry transient HTTP failures only; 501/unsupported remains terminal.
  return [408, 429, 500, 502, 503, 504].includes(Number(status));
}
