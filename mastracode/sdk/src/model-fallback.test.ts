import { APICallError } from '@ai-sdk/provider';
import { describe, expect, it } from 'vitest';

import { fallbackModelIdsToTry, modelRouteFailureFromError, pendingModelFallbackForThread } from './model-fallback.js';

const NOW = Date.parse('2026-11-23T10:00:00.000Z');

function rateLimit(retryAfter: string) {
  return new APICallError({
    message: 'Rate limited',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 429,
    responseHeaders: { 'retry-after': retryAfter },
    responseBody: JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'Rate limited' } }),
  });
}

describe('modelRouteFailureFromError', () => {
  it.each([
    ['120', { kind: 'rate_limited', retryAt: '2026-11-23T10:02:00.000Z' }],
    ['9000000000000', { kind: 'rate_limited' }],
  ])('records Retry-After %s as %o', (retryAfter, failure) => {
    expect(modelRouteFailureFromError(rateLimit(retryAfter), NOW)).toEqual(failure);
  });
});

describe('fallbackModelIdsToTry', () => {
  it('stops checking credentials once the route has room for no more fallbacks', () => {
    const checked: string[] = [];
    const canUse = (modelId: string) => {
      checked.push(modelId);
      return modelId !== 'google/gemini-3.8-flash';
    };

    expect(
      fallbackModelIdsToTry(
        'anthropic/claude-opus-5.5',
        [
          'google/gemini-3.8-flash',
          'openai/gpt-5.6-sol',
          'anthropic/claude-opus-5.5',
          'openai/gpt-5.6-sol',
          'xai/grok-5',
          'openai/gpt-5.5',
        ],
        canUse,
        2,
      ),
    ).toEqual(['openai/gpt-5.6-sol', 'xai/grok-5']);
    expect(checked).toEqual(['google/gemini-3.8-flash', 'openai/gpt-5.6-sol', 'xai/grok-5']);
  });
});

describe('pendingModelFallbackForThread', () => {
  const threadless = {
    fromEntryId: 'anthropic',
    toEntryId: 'openai',
    toModelId: 'openai/gpt-5.6-sol',
    reason: 'pool-exhausted',
    at: '2026-11-23T10:00:00.000Z',
  };
  const marker = { ...threadless, threadId: 'thread-1' };

  it('returns a marker captured for this thread', () => {
    expect(pendingModelFallbackForThread(marker, 'thread-1')).toEqual(marker);
  });

  it('returns a marker without a thread for any thread', () => {
    expect(pendingModelFallbackForThread(threadless, 'thread-2')).toEqual(threadless);
  });

  it('ignores a marker captured for another thread', () => {
    expect(pendingModelFallbackForThread(marker, 'thread-2')).toBeNull();
  });

  it('ignores a marker that does not match the schema', () => {
    expect(pendingModelFallbackForThread({ toEntryId: 'openai', threadId: 'thread-1' }, 'thread-1')).toBeNull();
  });
});
