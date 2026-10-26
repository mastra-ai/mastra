import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthStorage } from '../../auth/storage.js';
import { buildAnthropicOAuthFetch } from '../claude-max.js';

const ANTHROPIC_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

const server = setupServer();
let dir: string;
let storage: AuthStorage;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'claude-max-sign-in-'));
  storage = new AuthStorage(join(dir, 'auth.json'));
});
afterEach(() => {
  server.resetHandlers();
  rmSync(dir, { recursive: true, force: true });
});
afterAll(() => server.close());

describe('Anthropic subscription requests', () => {
  it('ask to sign in when no Anthropic sign-in is saved', async () => {
    await expect(buildAnthropicOAuthFetch({ authStorage: storage })(MESSAGES_URL)).rejects.toMatchObject({
      name: 'ProviderAuthRequiredError',
      message: 'Not logged in to Anthropic.',
    });
  });

  it('say the token refresh failed when Anthropic refuses to renew a saved sign-in', async () => {
    storage.set('anthropic', { type: 'oauth', access: 'expired', refresh: 'revoked', expires: 0 });
    server.use(http.post(ANTHROPIC_TOKEN_URL, () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })));

    await expect(buildAnthropicOAuthFetch({ authStorage: storage })(MESSAGES_URL)).rejects.toMatchObject({
      name: 'ProviderAuthRequiredError',
      message: 'Failed to refresh the Anthropic token.',
    });
  });
});
