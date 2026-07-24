import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';

/**
 * Regression coverage for #19885: an Agent's model-call retry used p-retry's fixed
 * exponential backoff and ignored the provider's `Retry-After` response header, so a
 * provider asking for 5s was retried after 1s, inside the still-throttled window.
 */
function createRateLimitedModel(headers: Record<string, string>, isRetryable = true) {
  let callCount = 0;

  const throwRateLimited = async () => {
    callCount++;
    throw new APICallError({
      message: 'rate limited',
      url: 'https://api.example.com',
      requestBodyValues: {},
      statusCode: isRetryable ? 429 : 401,
      isRetryable,
      responseHeaders: headers,
    });
  };

  return {
    model: new MockLanguageModelV2({ doGenerate: throwRateLimited, doStream: throwRateLimited }),
    getCallCount: () => callCount,
  };
}

function createAgent(model: MockLanguageModelV2, maxRetries: number) {
  return new Agent({
    id: 'model-retry-after',
    name: 'model-retry-after',
    instructions: 'You are a test agent',
    model,
    maxRetries,
  });
}

describe('agent model-call retry honors Retry-After', () => {
  beforeAll(async () => {
    // execute() lazily `await import('p-retry')`. Fake timers cannot advance a real
    // module load, so warm it up once here to keep the assertions below deterministic.
    const warmup = createRateLimitedModel({});
    await createAgent(warmup.model, 0)
      .generate('warmup')
      .catch(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for a numeric Retry-After instead of the shorter exponential backoff', async () => {
    vi.useFakeTimers();
    const provider = createRateLimitedModel({ 'retry-after': '5' });
    const settled = createAgent(provider.model, 1)
      .generate('hi')
      .catch(() => {
        /* expected: retries exhausted against an always-429 model */
      });

    // Let the agent's async setup reach the first model call.
    await vi.advanceTimersByTimeAsync(100);
    expect(provider.getCallCount()).toBe(1);

    // p-retry's own backoff for the first retry is 1s. Before this fix the retry
    // fired here, ignoring the provider's 5s request.
    await vi.advanceTimersByTimeAsync(1_500);
    expect(provider.getCallCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(provider.getCallCount()).toBe(2);

    await settled;
  });

  it('caps a Retry-After that exceeds the default maximum', async () => {
    vi.useFakeTimers();
    // 10 minutes: honored only up to the 30s cap, so a hostile value cannot wedge the run.
    const provider = createRateLimitedModel({ 'retry-after': '600' });
    const settled = createAgent(provider.model, 1)
      .generate('hi')
      .catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    expect(provider.getCallCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(29_000);
    expect(provider.getCallCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(provider.getCallCount()).toBe(2);

    await settled;
  });

  it('honors Retry-After-Ms', async () => {
    vi.useFakeTimers();
    const provider = createRateLimitedModel({ 'retry-after-ms': '4000' });
    const settled = createAgent(provider.model, 1)
      .generate('hi')
      .catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    expect(provider.getCallCount()).toBe(1);

    // Past p-retry's 1s backoff, still inside the 4s the provider asked for.
    await vi.advanceTimersByTimeAsync(1_500);
    expect(provider.getCallCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(provider.getCallCount()).toBe(2);

    await settled;
  });

  it('prefers Retry-After-Ms over Retry-After when both are sent', async () => {
    vi.useFakeTimers();
    const provider = createRateLimitedModel({ 'retry-after': '20', 'retry-after-ms': '3000' });
    const settled = createAgent(provider.model, 1)
      .generate('hi')
      .catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    expect(provider.getCallCount()).toBe(1);

    // The 3s millisecond value wins; the 20s value would still be pending here.
    await vi.advanceTimersByTimeAsync(3_500);
    expect(provider.getCallCount()).toBe(2);

    await settled;
  });

  it('does not wait for Retry-After on an error that will not be retried', async () => {
    vi.useFakeTimers();
    // onFailedAttempt runs before shouldRetry, so a terminal error carrying a large
    // Retry-After must not stall before failing.
    const provider = createRateLimitedModel({ 'retry-after': '30' }, false);
    const settled = createAgent(provider.model, 2)
      .generate('hi')
      .catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    // Settles without advancing through the 30s the header requested.
    await settled;
    expect(provider.getCallCount()).toBe(1);
  });

  it('keeps exponential backoff when the provider sends no Retry-After', async () => {
    vi.useFakeTimers();
    const provider = createRateLimitedModel({});
    const settled = createAgent(provider.model, 1)
      .generate('hi')
      .catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    expect(provider.getCallCount()).toBe(1);

    // Still inside p-retry's 1s backoff for the first retry.
    await vi.advanceTimersByTimeAsync(800);
    expect(provider.getCallCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(400);
    expect(provider.getCallCount()).toBe(2);

    await settled;
  });
});
