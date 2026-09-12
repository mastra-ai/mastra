import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';

import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const PROVIDER = 'kimi-for-coding';
const PACK_NAME = 'rotation-kimi';
const MODEL_ID = 'kimi-for-coding/kimi-for-coding';
const PROMPT = 'Rotate to the next account when this one is rate limited.';
const RESPONSE_TEXT = 'Completed on the second account after rotation.';
const ACCOUNT_A_ACCESS = 'mc-rotation-a-access';
const ACCOUNT_B_ACCESS = 'mc-rotation-b-access';
const ACCOUNT_A_DEVICE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ACCOUNT_B_DEVICE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// Test-only handles wired by prepare/inProcessApp so run() can reach them.
let scenarioAppDataDir = '';
let outbound: Array<{ bearer: string; deviceId: string }> = [];
let restartApp: (() => Promise<void>) | undefined;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function requestHeaders(init: RequestInit | undefined): Headers {
  const headers = new Headers();
  if (init?.headers) {
    const source =
      init.headers instanceof Headers
        ? init.headers
        : Array.isArray(init.headers)
          ? new Headers(init.headers as Array<[string, string]>)
          : new Headers(init.headers as Record<string, string>);
    source.forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({
      type: 'error',
      error: { type: 'rate_limit_error', message: 'This account has exceeded its rate limit.' },
    }),
    { status: 429, headers: { 'content-type': 'application/json' } },
  );
}

function completionResponse(): Response {
  const events: Array<[string, object]> = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_mc_rotation',
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
    [
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: RESPONSE_TEXT } },
    ],
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

/**
 * A two-account Kimi For Coding OAuth pool where the active account is rate
 * limited: the account-rotation processor advances the registry, the retried
 * request completes on the second account (token AND device headers follow the
 * rotation), the switch renders as a transcript notice, and both the registry
 * state and the persisted notice survive an app restart.
 *
 * Kimi is used instead of Anthropic because the Anthropic OAuth provider has a
 * vitest-only test-mode shortcut (`apiKey: 'test-api-key'`) that bypasses the
 * OAuth fetch wrapper, while Kimi's wrapper runs unconditionally.
 */
export const accountRotationScenario: McE2eScenario = {
  name: 'account-rotation',
  description: 'Rotates to the next OAuth account on a 429 and shows the switch in the transcript.',
  testName: 'rotates a rate-limited OAuth account, renders the switch, and persists it across restart',
  prepare({ appDataDir }) {
    scenarioAppDataDir = appDataDir;
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
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

    // Seed the registry through the real storage so the on-disk shape is exact.
    const storage = new AuthStorage(join(appDataDir, 'auth.json'));
    storage.addAccount(
      PROVIDER,
      {
        access: ACCOUNT_A_ACCESS,
        refresh: 'mc-rotation-a-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: ACCOUNT_A_DEVICE,
      },
      { label: 'Kimi Account A' },
    );
    storage.addAccount(
      PROVIDER,
      {
        access: ACCOUNT_B_ACCESS,
        refresh: 'mc-rotation-b-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: ACCOUNT_B_DEVICE,
      },
      { label: 'Kimi Account B' },
    );
    const firstAccountId = storage.listAccounts(PROVIDER)[0]!.id;
    storage.activateAccount(PROVIDER, firstAccountId);
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
    outbound = [];
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (requestUrl(input).includes('api.kimi.com')) {
        const headers = requestHeaders(init);
        const bearer = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
        const deviceId = headers.get('x-msh-device-id') ?? '';
        outbound.push({ bearer, deviceId });
        return bearer === ACCOUNT_B_ACCESS ? completionResponse() : rateLimitResponse();
      }
      return originalFetch(input, init);
    });

    let currentStop: (() => Promise<void>) | undefined;
    const start = async () => {
      const app = await startMastraCodeApp();
      currentStop = async () => {
        await patches.stopApp(app.stop);
      };
    };
    restartApp = async () => {
      await start();
    };

    try {
      await start();
      return {
        stop: async () => {
          await currentStop?.();
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

    terminal.submit(PROMPT);

    // The switch notice renders mid-run, then the completion streams on account B.
    try {
      await runtime.waitForScreenText(
        /Switched Kimi account: Kimi Account A → Kimi Account B \(rate limit\)/i,
        terminal,
        30_000,
      );
    } catch (error) {
      const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as Record<string, unknown>;
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nAUTH_ON_DISK=${JSON.stringify(auth)}\nOUTBOUND=${JSON.stringify(outbound)}`,
        { cause: error },
      );
    }
    await runtime.waitForScreenText(new RegExp(RESPONSE_TEXT), terminal, 30_000);
    runtime.printScreen('after rotation', terminal);

    // Raw outbound requests: account A was tried first, account B served the
    // completion, and the device header followed the rotation with the token.
    if (outbound.length === 0 || outbound[0]!.bearer !== ACCOUNT_A_ACCESS) {
      throw new Error(`Expected the first Kimi request to use account A, saw: ${JSON.stringify(outbound)}`);
    }
    const lastSuccess = outbound[outbound.length - 1]!;
    if (lastSuccess.bearer !== ACCOUNT_B_ACCESS) {
      throw new Error(`Expected the last Kimi request to use account B, saw: ${JSON.stringify(outbound)}`);
    }
    if (lastSuccess.deviceId !== ACCOUNT_B_DEVICE) {
      throw new Error(
        `Expected the account B request to carry account B's device header, saw: ${JSON.stringify(outbound)}`,
      );
    }
    if (!outbound.some(request => request.bearer === ACCOUNT_A_ACCESS && request.deviceId === ACCOUNT_A_DEVICE)) {
      throw new Error(`Expected account A's requests to carry its device header, saw: ${JSON.stringify(outbound)}`);
    }

    // On disk: the isolated auth.json slot now holds account B's tokens.
    const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as Record<string, any>;
    if (auth[PROVIDER]?.access !== ACCOUNT_B_ACCESS || auth[PROVIDER]?.deviceId !== ACCOUNT_B_DEVICE) {
      throw new Error(`Expected the legacy slot to hold account B's tokens, saw: ${JSON.stringify(auth[PROVIDER])}`);
    }
    const registryEntries = Object.entries(auth).filter(([key]) => key.startsWith('accounts:kimi-for-coding:'));
    const activeEntries = registryEntries.filter(([, value]) => value?.active === true);
    if (registryEntries.length !== 2 || activeEntries.length !== 1 || activeEntries[0]![1].label !== 'Kimi Account B') {
      throw new Error(`Expected the registry to hold both accounts with B active, saw: ${JSON.stringify(auth)}`);
    }

    // Restart the app on the same app data and reload the thread: the persisted
    // notice must render from history.
    await runtime.stopApp?.();
    await restartApp?.();
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 30_000);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/Rotate|Completed|Threads/i, terminal, 10_000);
    await runtime.sleep(500);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to:/i, terminal, 10_000);
    await runtime.waitForScreenText(
      /Switched Kimi account: Kimi Account A → Kimi Account B \(rate limit\)/i,
      terminal,
      30_000,
    );
    runtime.printScreen('after restart history reload', terminal);

    terminal.keyCtrlC();
  },
};
