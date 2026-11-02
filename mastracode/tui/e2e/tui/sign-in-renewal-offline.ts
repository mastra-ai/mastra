import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';

import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const PROVIDER = 'kimi-for-coding';
const PACK_NAME = 'renewal-kimi';
const MODEL_ID = 'kimi-for-coding/kimi-for-coding';
const SAVED_REFRESH = 'mc-renewal-refresh';
const RENEWED_ACCESS = 'mc-renewal-new-access';
const RESPONSE_TEXT = 'Completed after the connection came back.';

let scenarioAppDataDir = '';
let online = false;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function completionResponse(text: string): Response {
  const events: Array<[string, object]> = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_mc_renewal',
          type: 'message',
          role: 'assistant',
          model: 'kimi-for-coding',
          content: [],
          stop_reason: null,
          usage: { input_tokens: 12, output_tokens: 1 },
        },
      },
    ],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 12 } },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  const body = events.map(([event, payload]) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function savedRefreshToken(): unknown {
  const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as Record<
    string,
    { refresh?: unknown } | undefined
  >;
  return auth[PROVIDER]?.refresh;
}

/**
 * An expired OAuth access token while the sign-in server can't be reached
 * (plane wifi): the request reports a network error instead of "sign-in
 * expired", the saved sign-in survives, and once the connection is back the
 * next message renews the token and completes without signing in again.
 *
 * Kimi stands in for every OAuth provider: they all renew through the same
 * helper, and the Anthropic provider skips its OAuth fetch under vitest.
 */
export const signInRenewalOfflineScenario: McE2eScenario = {
  name: 'sign-in-renewal-offline',
  description: 'Keeps an OAuth sign-in and reports a network error when renewing it fails offline.',
  testName: 'reports a network error instead of an expired sign-in while offline, then recovers without signing in',
  async prepare({ appDataDir }) {
    scenarioAppDataDir = appDataDir;
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
    };
    settings.models = {
      ...settings.models,
      activeModelPackId: `custom:${PACK_NAME}`,
      modeDefaults: {},
      subagentModels: {},
    };
    settings.customModelPacks = [{ name: PACK_NAME, models: { build: MODEL_ID }, createdAt: new Date().toISOString() }];
    settings.customProviders = [];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const storage = new AuthStorage(join(appDataDir, 'auth.json'));
    await storage.addAccount(
      PROVIDER,
      { access: 'mc-renewal-expired-access', refresh: SAVED_REFRESH, expires: 0, deviceId: 'c'.repeat(32) },
      { label: 'Kimi Account' },
    );
  },
  env() {
    return {
      KIMI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      MASTRA_GATEWAY_API_KEY: '',
      GOOGLE_GENERATIVE_AI_API_KEY: '',
      GOOGLE_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      CEREBRAS_API_KEY: '',
    };
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    online = false;
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const { hostname } = new URL(requestUrl(input));
      if (hostname === 'auth.kimi.com') {
        if (!online) throw new TypeError('fetch failed');
        return new Response(
          JSON.stringify({ access_token: RENEWED_ACCESS, refresh_token: SAVED_REFRESH, expires_in: 3600 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (hostname === 'api.kimi.com') {
        if (!online) throw new TypeError('fetch failed');
        // Only the token from the renewal is accepted, so recovery proves it was used.
        const bearer = new Headers(init?.headers).get('authorization');
        if (bearer !== `Bearer ${RENEWED_ACCESS}`) return new Response('{"error":"unauthorized"}', { status: 401 });
        return completionResponse(RESPONSE_TEXT);
      }
      return originalFetch(input, init);
    });

    try {
      const app = await startMastraCodeApp();
      return {
        stop: async () => {
          await patches.stopApp(app.stop);
          patches.restore();
        },
      };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('Answer while the wifi is down.');
    // Renewal retries with backoff before giving up, so allow for it.
    await runtime.waitForScreenText(/Network error while contacting/i, terminal, 45_000);
    // The whole scrollback, so an expired notice anywhere in the turn fails the test.
    const offlineOutput = terminal.serializeHistory?.().output ?? '';
    if (/sign-in expired/i.test(offlineOutput)) {
      throw new Error('Expected a network error, but the offline turn reported an expired sign-in');
    }
    runtime.printScreen('offline', terminal);
    if (savedRefreshToken() !== SAVED_REFRESH) {
      throw new Error(`Expected the saved sign-in to survive, saw refresh token: ${String(savedRefreshToken())}`);
    }

    online = true;
    terminal.submit('Answer now that the wifi is back.');
    await runtime.waitForScreenText(new RegExp(RESPONSE_TEXT), terminal, 30_000);
    runtime.printScreen('back online', terminal);
  },
};
