import type { ModelRouteFailure } from '@mastra/code-sdk/model-fallback';
import { describe, expect, it } from 'vitest';

import { providerLimit, rateLimitRetryAt } from './provider-limit.js';
import type { ProviderLimit } from './provider-limit.js';

const T = new Date('2030-01-01T00:00:00Z');
const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const at = (ms: number) => new Date(T.getTime() + ms);

function providerError(
  statusCode: number,
  message: string,
  fields: { responseHeaders?: Record<string, string>; responseBody?: string } = {},
) {
  return Object.assign(new Error(message), { name: 'AI_APICallError', statusCode, ...fields });
}

const RATE_LIMITED_120S = providerError(429, 'Rate limited', {
  responseHeaders: { 'retry-after': '120' },
  responseBody: '{"type":"error","error":{"type":"rate_limit_error","message":"Rate limited"}}',
});
const OPENAI_INSUFFICIENT_QUOTA = providerError(429, 'You exceeded your current quota', {
  responseBody:
    '{"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}',
});
const OPENAI_CREDITS_EXHAUSTED = providerError(429, 'Your credit balance is exhausted', {
  responseBody: '{"error":{"type":"invalid_request_error","code":"credit_balance_exhausted"}}',
});
const ANTHROPIC_CREDIT_BALANCE = providerError(
  400,
  'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
  {
    responseBody:
      '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
  },
);
const INTERNAL_SERVER_ERROR = providerError(500, 'Internal server error', {
  responseBody: '{"type":"error","error":{"type":"api_error","message":"Internal server error"}}',
});
const EMPTY_CONTENT_REJECTED = providerError(400, 'messages: text content blocks must be non-empty', {
  responseBody:
    '{"type":"error","error":{"type":"invalid_request_error","message":"messages: text content blocks must be non-empty"}}',
});
const RATE_LIMITED_HOP: ModelRouteFailure = { kind: 'rate_limited', retryAt: at(30 * SECOND).toISOString() };

describe('providerLimit', () => {
  it.each<[string, unknown, readonly ModelRouteFailure[], ProviderLimit | undefined]>([
    ['a 429 with retry-after', RATE_LIMITED_120S, [], { code: 'run_rate_limited', resumeAt: at(120 * SECOND) }],
    ['an OpenAI insufficient_quota 429', OPENAI_INSUFFICIENT_QUOTA, [], { code: 'run_quota_exhausted' }],
    ['an OpenAI credit_balance_exhausted 429', OPENAI_CREDITS_EXHAUSTED, [], { code: 'run_quota_exhausted' }],
    [
      'a rate-limited hop before a model out of credits',
      OPENAI_INSUFFICIENT_QUOTA,
      [RATE_LIMITED_HOP],
      { code: 'run_rate_limited', resumeAt: at(30 * SECOND) },
    ],
    ['an Anthropic credit-balance 400', ANTHROPIC_CREDIT_BALANCE, [], { code: 'run_quota_exhausted' }],
    ['a 500', INTERNAL_SERVER_ERROR, [], undefined],
    ['a rate-limited hop before a content-filter refusal', new Error('content filter'), [RATE_LIMITED_HOP], undefined],
    ['a rate-limited hop before a rejected request', EMPTY_CONTENT_REJECTED, [RATE_LIMITED_HOP], undefined],
  ])('classifies %s', (_case, terminal, hops, expected) => {
    expect(providerLimit(terminal, hops, T)).toEqual(expected);
  });

  it('resumes at the earliest time any rate-limited model named', () => {
    const hops: ModelRouteFailure[] = [
      { kind: 'rate_limited', retryAt: at(5 * MINUTE).toISOString() },
      { kind: 'quota' },
    ];
    expect(providerLimit(RATE_LIMITED_120S, hops, T)).toEqual({
      code: 'run_rate_limited',
      resumeAt: at(120 * SECOND),
    });
  });

  it('names no resume time when a rate-limited model gave none', () => {
    expect(providerLimit(RATE_LIMITED_120S, [{ kind: 'rate_limited' }], T)).toEqual({ code: 'run_rate_limited' });
  });

  it('reads a provider error the run wrapped as its cause', () => {
    const wrapped = new Error('Stream failed', { cause: RATE_LIMITED_120S });
    expect(providerLimit(wrapped, [], T)).toEqual({ code: 'run_rate_limited', resumeAt: at(120 * SECOND) });
  });

  it('leaves an error no provider returned to the run error rules', () => {
    expect(providerLimit(new Error('You exceeded your current quota'), [], T)).toBeUndefined();
  });
});

describe('rateLimitRetryAt', () => {
  it.each<[string, Date, Date | undefined, Date | undefined]>([
    ['the first limit, with no provider time', T, undefined, at(MINUTE)],
    ['the first limit, with a later provider time', T, at(5 * MINUTE), at(5 * MINUTE)],
    ['five minutes into the limit', at(5 * MINUTE), undefined, at(10 * MINUTE)],
    ['thirty minutes into the limit', at(30 * MINUTE), undefined, at(45 * MINUTE)],
    ['fifty-five minutes into the limit, at the end of the hour', at(55 * MINUTE), undefined, at(60 * MINUTE)],
    ['a provider time before the end of the hour', at(55 * MINUTE), at(58 * MINUTE), at(60 * MINUTE)],
    ['nothing once the hour has passed', at(60 * MINUTE), undefined, undefined],
    ['a provider time two hours away', T, at(120 * MINUTE), undefined],
    ['a provider time past the end of the hour', at(55 * MINUTE), at(61 * MINUTE), undefined],
  ])('schedules %s', (_case, failedAt, resumeAt, expected) => {
    expect(rateLimitRetryAt({ since: T, failedAt, resumeAt })).toEqual(expected);
  });
});
