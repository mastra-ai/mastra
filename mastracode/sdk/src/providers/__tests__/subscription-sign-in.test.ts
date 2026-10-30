import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
