/**
 * E2E: a selected subscription-routing account is a target, not a preference (A12).
 *
 * Two Kimi For Coding OAuth accounts. The custom pack pins a model to account B
 * while account A is the active subscription, and the pack's fallback is the
 * builtin Anthropic pack. Account B is rate limited; account A would answer
 * successfully if it were ever tried.
 *
 * The fetch patch answers by host: api.kimi.com → 429 for B (and a completion
 * with a distinct text for A, so a sibling fallback shows up as a wrong
 * account serving the turn), api.anthropic.com → SSE completion.
 *
 * Asserts:
 *  - the targeted account activates at request start and is announced,
 *  - its 429 exhausts the route and hops to the fallback pack instead of
 *    rotating onto the sibling subscription — the raw outbound log proves no
 *    request ever carried account A's bearer or device id,
 *  - stickiness: the session stays on the landed pack after a restart and on
 *    the next message, with no new Kimi request.
 *
 * Kimi is used instead of Anthropic for the pinned subscription because the
 * Anthropic OAuth provider has a vitest-only test-mode shortcut
 * (`apiKey: 'test-api-key'`) that bypasses the OAuth fetch wrapper, while
 * Kimi's wrapper runs unconditionally.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';

import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const PROVIDER = 'kimi-for-coding';
const PACK_NAME = 'target-kimi';
const MODEL_ID = 'kimi-for-coding/kimi-for-coding';
const PROMPT = 'Use only the pinned subscription for this model.';
const RESPONSE_TEXT = 'Completed on the fallback pack without touching the sibling subscription.';
const SIBLING_RESPONSE_TEXT = 'SIBLING-SUBSCRIPTION-SERVED-THE-TURN';
const FOLLOWUP_RESPONSE_TEXT = 'Targeted routing stayed on the landed fallback pack.';
const ACCOUNT_A_ACCESS = 'mc-target-a-access';
const ACCOUNT_B_ACCESS = 'mc-target-b-access';
const ACCOUNT_A_DEVICE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ACCOUNT_B_DEVICE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// Test-only handles wired by prepare/inProcessApp so run() can reach them.
let scenarioAppDataDir = '';
let outbound: Array<{ host: string; bearer: string; deviceId: string }> = [];
let restartApp: (() => Promise<void>) | undefined;

type AuthSnapshot = Record<
  string,
  { access?: unknown; deviceId?: unknown; label?: unknown; active?: unknown } | undefined
>;

function outboundSummary() {
  return outbound.map(request => ({
    host: request.host,
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

function completionResponse(text = RESPONSE_TEXT, model = 'kimi-for-coding'): Response {
  const events: Array<[string, object]> = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_mc_target',
          type: 'message',
          role: 'assistant',
          model,
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

export const accountRoutingTargetedScenario: McE2eScenario = {
  name: 'account-routing-targeted',
  description: 'Pins a model to one account and hops to the fallback pack instead of the sibling subscription.',
  testName: 'never uses a sibling subscription when a targeted route fails, and stays on the fallback pack',
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
      packFallbacks: { [`custom:${PACK_NAME}`]: 'anthropic' },
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
        refresh: 'mc-target-a-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: ACCOUNT_A_DEVICE,
      },
      { label: 'Kimi Account A' },
    );
    await storage.addAccount(
      PROVIDER,
      {
        access: ACCOUNT_B_ACCESS,
        refresh: 'mc-target-b-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: ACCOUNT_B_DEVICE,
      },
      { label: 'Kimi Account B' },
    );
    storage.activateAccount(PROVIDER, storage.listAccounts(PROVIDER)[0]!.id);
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
      const host = new URL(requestUrl(input)).hostname;
      if (host === 'api.kimi.com') {
        const headers = requestHeaders(init);
        const bearer = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
        const deviceId = headers.get('x-msh-device-id') ?? '';
        outbound.push({ host, bearer, deviceId });
        // Only the pinned account B answers the pinned model; A is a healthy
        // sibling the route must never reach for. Answering on A with a
        // distinct text keeps that mistake visible in the transcript as well as
        // in the raw outbound log.
        return bearer === ACCOUNT_A_ACCESS ? completionResponse(SIBLING_RESPONSE_TEXT) : rateLimitResponse();
      }
      if (host === 'api.anthropic.com') {
        outbound.push({ host, bearer: '', deviceId: '' });
        successfulCompletions += 1;
        return completionResponse(
          successfulCompletions === 1 ? RESPONSE_TEXT : FOLLOWUP_RESPONSE_TEXT,
          'claude-fable-5',
        );
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

    // Pin this pack/model to account B without making it globally active.
    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(new RegExp(PACK_NAME), terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(new RegExp(`Custom pack: ${PACK_NAME}`), terminal, 8_000);
    terminal.write('\x1b[B\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(new RegExp(`Subscription routing: ${PACK_NAME}`), terminal, 8_000);
    await runtime.waitForScreenText(/kimi-for-coding\/kimi-for-coding/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Subscription for kimi-for-coding\/kimi-for-coding/i, terminal, 8_000);
    await runtime.waitForScreenText(/Kimi Account A.*active/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    // A12 copy: a targeted route shows the single account it may use, never a
    // request-order list that implies sibling rotation.
    await runtime.waitForScreenText(
      /Uses only: Kimi Account B — on failure the pack fallback chain is used, not another account\./i,
      terminal,
      8_000,
    );
    terminal.write('\r');
    await runtime.waitForScreenText(new RegExp(`Subscription routing: ${PACK_NAME}`), terminal, 8_000);
    await runtime.waitForScreenText(/Kimi Account B \(only\)/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(new RegExp(`Custom pack: ${PACK_NAME}`), terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 8_000);

    const configured = readMutableSettingsFixture(join(scenarioAppDataDir, 'settings.json'));
    const targetedId = configured.models.packAccountPreferences?.[`custom:${PACK_NAME}`]?.[MODEL_ID];
    const accountBId = new AuthStorage(join(scenarioAppDataDir, 'auth.json')).listAccounts(PROVIDER)[1]!.id;
    if (targetedId !== accountBId) {
      throw new Error('Expected /models to persist account B as the pack/model target.');
    }

    terminal.submit(PROMPT);

    // The target activates first, then its 429 exhausts the route and the pack
    // hop takes over — no sibling activation is announced.
    try {
      await runtime.waitForScreenText(
        /Switched Kimi account: Kimi Account A → Kimi Account B \(subscription routing\)/i,
        terminal,
        30_000,
      );
      // A12 copy: the pinned account is reported, not the whole pool.
      await runtime.waitForScreenText(/Pinned Kimi account unavailable \(pool exhausted\)/i, terminal, 30_000);
      await runtime.waitForScreenText(
        new RegExp(`Switched model pack: ${PACK_NAME} → Anthropic \\(pool exhausted\\)`, 'i'),
        terminal,
        30_000,
      );
      await runtime.waitForScreenText(new RegExp(RESPONSE_TEXT), terminal, 30_000);
    } catch (error) {
      const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as AuthSnapshot;
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nAUTH_STATE=${JSON.stringify(authSummary(auth))}\nOUTBOUND=${JSON.stringify(outboundSummary())}`,
        { cause: error },
      );
    }
    runtime.printScreen('after targeted route hop', terminal);

    // The regression: account A is healthy and would answer, but the pinned
    // route must never send it a request. Bearer *and* device header are
    // asserted — a request can carry B's token with A's device id.
    if (outbound.some(request => request.bearer === ACCOUNT_A_ACCESS || request.deviceId === ACCOUNT_A_DEVICE)) {
      throw new Error(`Expected no request on the sibling subscription: ${JSON.stringify(outboundSummary())}`);
    }
    const firstKimi = outbound.findIndex(request => request.host === 'api.kimi.com');
    if (firstKimi === -1) {
      throw new Error(`Expected the pinned account to be tried: ${JSON.stringify(outboundSummary())}`);
    }
    const pinned = outbound[firstKimi]!;
    if (pinned.bearer !== ACCOUNT_B_ACCESS || pinned.deviceId !== ACCOUNT_B_DEVICE) {
      throw new Error(`Expected the pinned account B and its device header: ${JSON.stringify(outboundSummary())}`);
    }
    const firstAnthropic = outbound.findIndex(request => request.host === 'api.anthropic.com');
    if (firstAnthropic === -1 || firstAnthropic < firstKimi) {
      throw new Error(`Expected the hop to Anthropic after the pinned account: ${JSON.stringify(outboundSummary())}`);
    }
    if (outbound.slice(firstAnthropic).some(request => request.host === 'api.kimi.com')) {
      throw new Error(`Expected no Kimi request after the hop: ${JSON.stringify(outboundSummary())}`);
    }

    // On disk: the pin activated B, and the failed route did not consume A.
    const auth = JSON.parse(readFileSync(join(scenarioAppDataDir, 'auth.json'), 'utf-8')) as AuthSnapshot;
    if (auth[PROVIDER]?.access !== ACCOUNT_B_ACCESS || auth[PROVIDER]?.deviceId !== ACCOUNT_B_DEVICE) {
      throw new Error(`Expected the legacy slot to hold account B's credentials: ${JSON.stringify(authSummary(auth))}`);
    }
    const registryEntries = Object.entries(auth).filter(([key]) => key.startsWith('accounts:kimi-for-coding:'));
    const activeEntries = registryEntries.filter(([, value]) => value?.active === true);
    if (registryEntries.length !== 2 || activeEntries.length !== 1 || activeEntries[0]![1].label !== 'Kimi Account B') {
      throw new Error(`Expected both accounts with B active: ${JSON.stringify(authSummary(auth))}`);
    }

    // Restart the app on the same app data and reload the thread: the persisted
    // notices must render from history.
    await restartApp?.();
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 30_000);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/pinned subscription|Completed|Threads/i, terminal, 10_000);
    await runtime.sleep(500);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to:/i, terminal, 10_000);
    await runtime.waitForScreenText(/Pinned Kimi account unavailable \(pool exhausted\)/i, terminal, 30_000);
    await runtime.waitForScreenText(
      new RegExp(`Switched model pack: ${PACK_NAME} → Anthropic \\(pool exhausted\\)`, 'i'),
      terminal,
      30_000,
    );
    await runtime.waitForScreenText(/Using fallback Anthropic \(target-kimi failed\)/i, terminal, 10_000);
    runtime.printScreen('after restart history reload', terminal);

    const requestsBeforeFollowup = outbound.length;
    terminal.submit('Confirm the pinned route stays on the fallback pack.');
    await runtime.waitForScreenText(new RegExp(FOLLOWUP_RESPONSE_TEXT), terminal, 30_000);
    const followupRequests = outbound.slice(requestsBeforeFollowup);
    if (followupRequests.some(request => request.host === 'api.kimi.com')) {
      throw new Error(`Expected stickiness to skip the failed pack: ${JSON.stringify(outboundSummary())}`);
    }
    if (!followupRequests.some(request => request.host === 'api.anthropic.com')) {
      throw new Error(`Expected the follow-up on the landed pack: ${JSON.stringify(outboundSummary())}`);
    }
    await runtime.waitForScreenText(/Using fallback Anthropic \(target-kimi failed\)/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
};
