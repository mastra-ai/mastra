import { modelRouteFailureFromError } from '@mastra/code-sdk/model-fallback';
import type { ModelRouteFailure } from '@mastra/code-sdk/model-fallback';
import { PROVIDER_CALL_ERROR_NAME } from '@mastra/core/error';

export const PROVIDER_LIMIT_FAILURE_CODES = ['run_rate_limited', 'run_quota_exhausted'] as const;

export interface ProviderLimit {
  code: (typeof PROVIDER_LIMIT_FAILURE_CODES)[number];
  resumeAt?: Date;
}

const RATE_LIMIT_MIN_WAIT_MS = 60_000;
const RATE_LIMIT_MAX_WAIT_MS = 900_000;
const RATE_LIMIT_WINDOW_MS = 3_600_000;

export function causeOf(error: unknown): unknown {
  return error && typeof error === 'object' && 'cause' in error ? error.cause : undefined;
}

export function isProviderCallError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('name' in error && typeof error.name === 'string' && PROVIDER_CALL_ERROR_NAME.test(error.name)) return true;
  return 'statusCode' in error || 'responseBody' in error;
}

function rateLimitResumeAt(rateLimited: readonly ModelRouteFailure[]): Date | undefined {
  const times = rateLimited.map(failure => (failure.retryAt ? Date.parse(failure.retryAt) : Number.NaN));
  return times.every(Number.isFinite) ? new Date(Math.min(...times)) : undefined;
}

export function providerLimit(
  terminal: unknown,
  hops: readonly ModelRouteFailure[],
  now: Date,
): ProviderLimit | undefined {
  const last =
    isProviderCallError(terminal) || isProviderCallError(causeOf(terminal))
      ? modelRouteFailureFromError(terminal, now.getTime())
      : undefined;
  if (last?.kind !== 'rate_limited' && last?.kind !== 'quota') return undefined;
  const rateLimited = [...hops, last].filter(failure => failure.kind === 'rate_limited');
  if (rateLimited.length > 0) return { code: 'run_rate_limited', resumeAt: rateLimitResumeAt(rateLimited) };
  return { code: 'run_quota_exhausted' };
}

export function rateLimitRetryAt({
  since,
  failedAt,
  resumeAt,
}: {
  since: Date;
  failedAt: Date;
  resumeAt?: Date;
}): Date | undefined {
  const windowEndMs = since.getTime() + RATE_LIMIT_WINDOW_MS;
  const resumeAtMs = resumeAt?.getTime() ?? 0;
  if (failedAt.getTime() >= windowEndMs || resumeAtMs > windowEndMs) return undefined;
  const limitedMs = failedAt.getTime() - since.getTime();
  const waitMs = Math.min(Math.max(limitedMs, RATE_LIMIT_MIN_WAIT_MS), RATE_LIMIT_MAX_WAIT_MS);
  return new Date(Math.min(Math.max(failedAt.getTime() + waitMs, resumeAtMs), windowEndMs));
}
