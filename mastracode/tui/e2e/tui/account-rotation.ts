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
const RESPONSE_TEXT = 'Completed on the remaining account after preferred subscription failover.';
const FOLLOWUP_RESPONSE_TEXT = 'Sticky preferred subscription failover completed.';
const ACCOUNT_A_ACCESS = 'mc-rotation-a-access';
const ACCOUNT_B_ACCESS = 'mc-rotation-b-access';
const ACCOUNT_A_DEVICE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ACCOUNT_B_DEVICE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// Test-only handles wired by prepare/inProcessApp so run() can reach them.
let scenarioAppDataDir = '';
let outbound: Array<{ bearer: string; deviceId: string }> = [];
let restartApp: (() => Promise<void>) | undefined;

type AuthSnapshot = Record<
  string,
  { access?: unknown; deviceId?: unknown; label?: unknown; active?: unknown } | undefined
>;

function outboundSummary() {
  return outbound.map(request => ({
    account: request.bearer === ACCOUNT_A_ACCESS ? 'A' : request.bearer === ACCOUNT_B_ACCESS ? 'B' : 'unrecognized',
    device: request.deviceId === ACCOUNT_A_DEVICE ? 'A' : request.deviceId === ACCOUNT_B_DEVICE ? 'B' : 'unrecognized',
  }));
}

function authSummary(auth: AuthSnapshot) {
  const accounts = Object.entries(auth)
    .filter(([key]) => key.startsWith('accounts:kimi-for-coding:'))
    .map(([, value]) => ({ label: value?.label, active: value?.active }));
  return {
    accountCount: accounts.length,
    accounts,
    activeSlotLabel:
      auth[PROVIDER]?.access === ACCOUNT_A_ACCESS
        ? 'A'
        : auth[PROVIDER]?.access === ACCOUNT_B_ACCESS
          ? 'B'
          : 'unrecognized',
  };
}

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

function completionResponse(text = RESPONSE_TEXT): Response {
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

/**
 * A two-account Kimi For Coding OAuth pool where /models prefers account B.
 * B is rate limited, so the account-rotation processor advances to A, pairs
 * token and device metadata, persists B's exhaustion for this pack/model, and
 * skips B on the next message after an app restart.
 *
 * Kimi is used instead of Anthropic because the Anthropic OAuth provider has a
 * vitest-only test-mode shortcut (`apiKey: 'test-api-key'`) that bypasses the
 * OAuth fetch wrapper, while Kimi's wrapper runs unconditionally.
 */
export const accountRotationScenario: McE2eScenario = {
  name: 'account-rotation',
  description:
    'Configures a pack/model preferred subscription, fails over on 429, and keeps the exhausted preference sticky.',
  testName: 'routes through a preferred subscription and keeps failover sticky across restart',
  async prepare({ appDataDir }) {
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
    await storage.addAccount(
      PROVIDER,
      {
        access: ACCOUNT_A_ACCESS,
        refresh: 'mc-rotation-a-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: ACCOUNT_A_DEVICE,
      },
      { label: 'Kimi Account A' },
    );
    await storage.addAccount(
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
    let successfulCompletions = 0;
    const originalFetch = globalThis.fetch.bind(globalThis);
    const mockedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(requestUrl(input)).hostname === 'api.kimi.com') {
        const headers = requestHeaders(init);
        const bearer = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
        const deviceId = headers.get('x-msh-device-id') ?? '';
        outbound.push({ bearer, deviceId });
        if (bearer === ACCOUNT_B_ACCESS) return rateLimitResponse();
        successfulCompletions += 1;
        return completionResponse(successfulCompletions === 1 ? RESPONSE_TEXT : FOLLOWUP_RESPONSE_TEXT);
      }
      return originalFetch(input, init);
    };
    patches.setProperty(globalThis, 'fetch', mockedFetch);

    let stopCurrentApp: (() => Promise<void>) | undefined;
    let currentStop: (() => Promise<void>) | undefined;
    const start = async () => {
      const app = await startMastraCodeApp();
      // Re-assert the fetch mock: a previous app's stop may have restored it.
      globalThis.fetch = mockedFetch;
      // Raw stop, deliberately not `patches.stopApp`: that wrapper restores the
      // fetch patch, and the restarted app needs it. Restarting must still stop
      // the previous app — two live TUIs share the same app data otherwise.
      stopCurrentApp = app.stop;
      currentStop = async () => {
        await patches.stopApp(app.stop);
      };
    };
    restartApp = async () => {
      await stopCurrentApp?.();
      await start();
    };

    try {
      await start();
      return {
        stop: async () => {
          try {
            await currentStop?.();
          } finally {
            patches.restore();
          }
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

    // Configure this pack/model to prefer account B without making it globally active.
    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/rotation-kimi/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: rotation-kimi/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Subscription routing: rotation-kimi/i, terminal, 8_000);
    await runtime.waitForScreenText(/kimi-for-coding\/kimi-for-coding/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Preferred subscription for kimi-for-coding\/kimi-for-coding/i, terminal, 8_000);
    await runtime.waitForScreenText(/Kimi Account A.*active/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    await runtime.waitForScreenText(/Request order: Kimi Account B → Kimi Account A \(active\)/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Subscription routing: rotation-kimi/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Custom pack: rotation-kimi/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 8_000);

    const configured = readMutableSettingsFixture(join(scenarioAppDataDir, 'settings.json'));
    const preferredId = configured.models.packAccountPreferences?.[`custom:${PACK_NAME}`]?.[MODEL_ID];
    const accountBId = new AuthStorage(join(scenarioAppDataDir, 'auth.json')).listAccounts(PROVIDER)[1]!.id;
    if (preferredId !== accountBId) {
      throw new Error('Expected /models to persist account B as the pack/model preference.');
    }

    terminal.submit(PROMPT);

    // Preferred B activates first, then its 429 rotates to A and records B as
    // exhausted for this pack/model.
    try {
      await runtime.waitForScreenText(
        /Switched Kimi account: Kimi Account A → Kimi Account B \(subscription routing\)/i,
        terminal,
        30_000,
      );
      await runtime.waitForScreenText(
        /Switched Kimi account: Kimi Account B → Kimi Account A \(rate limit\)/i,
        terminal,
        30_000,
      );
    } catch (error) {
      const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as AuthSnapshot;
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nAUTH_STATE=${JSON.stringify(authSummary(auth))}\nOUTBOUND=${JSON.stringify(outboundSummary())}`,
        { cause: error },
      );
    }
    await runtime.waitForScreenText(new RegExp(RESPONSE_TEXT), terminal, 30_000);
    runtime.printScreen('after preferred routing failover', terminal);

    if (outbound.length === 0 || outbound[0]!.bearer !== ACCOUNT_B_ACCESS) {
      throw new Error(
        `Expected the first Kimi request to use preferred account B: ${JSON.stringify(outboundSummary())}`,
      );
    }
    const lastSuccess = outbound[outbound.length - 1]!;
    if (lastSuccess.bearer !== ACCOUNT_A_ACCESS || lastSuccess.deviceId !== ACCOUNT_A_DEVICE) {
      throw new Error(`Expected account A and its device header to complete: ${JSON.stringify(outboundSummary())}`);
    }
    const firstA = outbound.findIndex(request => request.bearer === ACCOUNT_A_ACCESS);
    if (firstA === -1 || outbound.slice(firstA).some(request => request.bearer === ACCOUNT_B_ACCESS)) {
      throw new Error(`Expected no account B request after failover: ${JSON.stringify(outboundSummary())}`);
    }

    const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as AuthSnapshot;
    if (auth[PROVIDER]?.access !== ACCOUNT_A_ACCESS || auth[PROVIDER]?.deviceId !== ACCOUNT_A_DEVICE) {
      throw new Error(`Expected the legacy slot to hold account A's credentials: ${JSON.stringify(authSummary(auth))}`);
    }
    const registryEntries = Object.entries(auth).filter(([key]) => key.startsWith('accounts:kimi-for-coding:'));
    const activeEntries = registryEntries.filter(([, value]) => value?.active === true);
    if (registryEntries.length !== 2 || activeEntries.length !== 1 || activeEntries[0]![1].label !== 'Kimi Account A') {
      throw new Error(`Expected both accounts with A active: ${JSON.stringify(authSummary(auth))}`);
    }

    // Restart the app on the same app data and reload the thread: the persisted
    // notice must render from history.
    await restartApp?.();
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 30_000);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/Rotate|Completed|Threads/i, terminal, 10_000);
    await runtime.sleep(500);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to:/i, terminal, 10_000);
    await runtime.waitForScreenText(
      /Switched Kimi account: Kimi Account B → Kimi Account A \(rate limit\)/i,
      terminal,
      30_000,
    );
    runtime.printScreen('after restart history reload', terminal);

    const requestsBeforeFollowup = outbound.length;
    terminal.submit('Confirm sticky routing on the next message.');
    await runtime.waitForScreenText(new RegExp(FOLLOWUP_RESPONSE_TEXT), terminal, 30_000);
    const followupRequests = outbound.slice(requestsBeforeFollowup);
    if (followupRequests.length === 0 || followupRequests.some(request => request.bearer !== ACCOUNT_A_ACCESS)) {
      throw new Error(`Expected sticky routing to skip exhausted preferred B: ${JSON.stringify(outboundSummary())}`);
    }

    terminal.keyCtrlC();
  },
};
