import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStorage } from '../../auth/storage.js';
import { buildAnthropicOAuthFetch } from '../claude-max.js';
import { buildGitHubCopilotOAuthFetch } from '../github-copilot.js';
import { buildKimiCodingOAuthFetch } from '../kimi-coding.js';
import { buildOpenAICodexOAuthFetch } from '../openai-codex.js';
import { buildXAIOAuthFetch } from '../xai.js';

const SUBSCRIPTIONS = [
  {
    name: 'Anthropic',
    id: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    buildFetch: (storage: AuthStorage) => buildAnthropicOAuthFetch({ authStorage: storage }),
  },
  {
    name: 'OpenAI Codex',
    id: 'openai-codex',
    url: 'https://chatgpt.com/backend-api/codex/responses',
    buildFetch: (storage: AuthStorage) => buildOpenAICodexOAuthFetch({ authStorage: storage }),
  },
  {
    name: 'GitHub Copilot',
    id: 'github-copilot',
    url: 'https://api.individual.githubcopilot.com/chat/completions',
    buildFetch: (storage: AuthStorage) => buildGitHubCopilotOAuthFetch({ authStorage: storage }),
  },
  {
    name: 'xAI',
    id: 'xai',
    url: 'https://api.x.ai/v1/chat/completions',
    buildFetch: (storage: AuthStorage) => buildXAIOAuthFetch({ authStorage: storage }),
  },
  {
    name: 'Kimi For Coding',
    id: 'kimi-for-coding',
    url: 'https://api.kimi.com/coding/v1/chat/completions',
    buildFetch: (storage: AuthStorage) => buildKimiCodingOAuthFetch({ credentialStore: storage }),
  },
];

const server = setupServer();
let dir: string;
let storage: AuthStorage;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'subscription-sign-in-'));
  storage = new AuthStorage(join(dir, 'auth.json'));
});
afterEach(() => {
  server.resetHandlers();
  rmSync(dir, { recursive: true, force: true });
});
afterAll(() => server.close());

describe.each(SUBSCRIPTIONS)('$name subscription requests', ({ name, id, url, buildFetch }) => {
  it('ask to sign in when no sign-in is saved', async () => {
    await expect(buildFetch(storage)(url)).rejects.toMatchObject({
      name: 'ProviderAuthRequiredError',
      message: `Not logged in to ${name}.`,
    });
  });

  it('say the sign-in expired when the provider refuses to renew it', async () => {
    storage.set(id, {
      type: 'oauth',
      access: 'expired',
      refresh: 'revoked',
      expires: 0,
      deviceId: 'a'.repeat(32),
    });
    server.use(http.all('*', () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })));

    await expect(buildFetch(storage)(url)).rejects.toMatchObject({
      name: 'ProviderAuthRequiredError',
      message: `${name} sign-in expired.`,
    });
  });
});

// On a flaky connection (plane wifi) the token endpoint can't be reached, errors,
// or answers with a captive-portal page. The saved sign-in is still good, so the
// request must say the provider is unreachable instead of asking to sign in again.
describe.each(
  SUBSCRIPTIONS.flatMap(subscription =>
    [
      { label: 'is unreachable', response: () => HttpResponse.error(), detail: /fetch/i },
      { label: 'is down', response: () => new HttpResponse('upstream down', { status: 503 }), detail: /503/ },
      {
        label: 'answers with a captive-portal page',
        response: () =>
          new HttpResponse('<html>Sign in to the wifi</html>', { headers: { 'content-type': 'text/html' } }),
        detail: /unreadable/,
      },
    ].map(failure => ({ ...subscription, ...failure })),
  ),
)('$name subscription requests when the sign-in server $label', ({ name, id, url, buildFetch, response, detail }) => {
  it('say the provider could not be reached and keep the saved sign-in', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    storage.set(id, {
      type: 'oauth',
      access: 'expired',
      refresh: 'still-valid',
      expires: 0,
      deviceId: 'a'.repeat(32),
    });
    server.use(http.all('*', response));

    // Kimi retries transient failures with backoff; skip the waits.
    const pending = buildFetch(storage)(url).catch((caught: unknown) => caught as Error);
    await vi.runAllTimersAsync();
    const error = await pending;
    vi.useRealTimers();

    expect(error.name).not.toBe('ProviderAuthRequiredError');
    expect(error.message).toMatch(new RegExp(`^Couldn't reach ${name} to renew the sign-in`));
    expect(error.message).toMatch(detail);
    expect(storage.get(id)).toMatchObject({ type: 'oauth', refresh: 'still-valid' });
  });
});
