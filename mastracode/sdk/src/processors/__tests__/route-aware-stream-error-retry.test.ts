import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import type { CredentialStore, OAuthAccountRecord } from '../../auth/types.js';
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

function subscriptions(...ids: string[]): CredentialStore {
  const accounts = ids.map(
    (id, index): OAuthAccountRecord => ({
      type: 'oauth-account',
      id,
      label: id,
      addedAt: '2026-11-01T00:00:00.000Z',
      active: index === 0,
      access: `access-${id}`,
      refresh: `refresh-${id}`,
      expires: Date.now() + 3_600_000,
    }),
  );
  return {
    reload: () => {},
    get: () => undefined,
    getStoredApiKey: () => undefined,
    getApiKey: async () => undefined,
    listAccounts: () => accounts,
    getActiveAccount: () => accounts[0],
  };
}

const retrying = (credentialStore: CredentialStore) =>
  new RouteAwareStreamErrorRetryProcessor({ credentialStore, matchers: [{ match: () => true, maxRetries: 1 }] });

const processor = retrying(subscriptions());

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

  it('switches to another Claude subscription instead of waiting on the limited one', async () => {
    const args = rateLimitedRequest('anthropic/claude-fable-5', {});

    expect(await retrying(subscriptions('work', 'home')).processAPIError(args as never)).toBeUndefined();
  });

  it('waits out the limit once on the only subscription', async () => {
    const args = rateLimitedRequest('anthropic/claude-fable-5', {});

    expect(await retrying(subscriptions('work')).processAPIError(args as never)).toEqual({ retry: true });
  });

  it('waits out the limit once when the route pins one subscription', async () => {
    const args = rateLimitedRequest('anthropic/claude-fable-5', {
      modelRoute: {
        entries: [{ id: 'pinned', label: 'Work', modelId: 'anthropic/claude-fable-5', accountId: 'work' }],
      },
    });

    expect(await retrying(subscriptions('work', 'home')).processAPIError(args as never)).toEqual({ retry: true });
  });
});
