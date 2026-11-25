import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { MODEL_FALLBACK_STATE_KEY } from '../../model-fallback.js';
import { RouteAwareStreamErrorRetryProcessor } from '../route-aware-stream-error-retry.js';

const route = [
  { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' },
  { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol' },
];

function rateLimitedRequest(sessionModelId: string, state: Record<string, unknown>) {
  const requestContext = new RequestContext();
  requestContext.set('controller', {
    session: { modelId: sessionModelId },
    threadId: 'thread-1',
    getState: () => state,
  });
  return { error: Object.assign(new Error('Rate limited'), { statusCode: 429 }), retryCount: 0, requestContext };
}

const processor = new RouteAwareStreamErrorRetryProcessor({ matchers: [{ match: () => true, maxRetries: 1 }] });

describe('RouteAwareStreamErrorRetryProcessor on a rate limit', () => {
  it('leaves the error to the next model in the route', async () => {
    const args = rateLimitedRequest('anthropic/claude-fable-5', { modelRoute: { entries: route } });

    expect(await processor.processAPIError(args as never)).toBeUndefined();
  });

  it('retries once when a pending hop already reached the last model', async () => {
    const args = rateLimitedRequest('anthropic/claude-fable-5', {
      modelRoute: { entries: route },
      [MODEL_FALLBACK_STATE_KEY]: {
        fromEntryId: 'anthropic',
        toEntryId: 'openai',
        toModelId: 'openai/gpt-5.6-sol',
        threadId: 'thread-1',
        reason: 'pool-exhausted',
        at: '2026-10-05T00:00:00.000Z',
      },
    });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: true });
  });

  it('retries once when the session model is the last in the route', async () => {
    const args = rateLimitedRequest('openai/gpt-5.6-sol', { modelRoute: { entries: route } });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: true });
  });
});
