/**
 * E2E: pack fallback hop on pool exhaustion.
 *
 * One Kimi account (always 429) on a custom pack whose fallback is the
 * builtin Anthropic pack (vitest Anthropic shortcut posts to
 * api.anthropic.com with a test key). The fetch patch answers by host:
 * api.kimi.com → 429 forever; api.anthropic.com → SSE completion.
 *
 * Asserts:
 *  - both notices render live (pool exhausted + pack hop),
 *  - raw outbound request order is Kimi then Anthropic, with no Kimi
 *    request after the first Anthropic one,
 *  - stickiness: the session switches to the landed pack live (status line)
 *    and stays on it after an app restart + thread reload, with both
 *    notices re-rendered from persisted parts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';

import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const PROVIDER = 'kimi-for-coding';
const PACK_NAME = 'hop-kimi';
const KIMI_MODEL_ID = 'kimi-for-coding/kimi-for-coding';
const ANTHROPIC_BUILD_MODEL_ID = 'anthropic/claude-fable-5';
const PROMPT = 'Hop to the fallback pack when this one is exhausted.';
const RESPONSE_TEXT = 'Completed on the fallback pack.';
const ACCOUNT_ACCESS = 'mc-hop-kimi-access';
const ACCOUNT_DEVICE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

// Test-only handles wired by prepare/inProcessApp so run() can reach them.
let outbound: Array<{ host: string; bearer: string }> = [];
let restartApp: (() => Promise<void>) | undefined;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
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
          id: 'msg_proof',
          type: 'message',
          role: 'assistant',
          model: 'claude-fable-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
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

export const packFallbackScenario: McE2eScenario = {
  name: 'pack-fallback',
  description:
    'Exhausts a single-account Kimi pack and asserts the turn hops to the Anthropic fallback pack, ' +
    'renders both notices, and the thread sticks to the landed pack across restart.',
  testName: 'hops to the fallback pack on pool exhaustion and sticks to it across restart',
  prepare({ appDataDir }) {
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
    settings.customModelPacks = [
      { name: PACK_NAME, models: { build: KIMI_MODEL_ID }, createdAt: new Date().toISOString() },
    ];
    settings.customProviders = [];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // One Kimi account — the pool exhausts on the first 429.
    const storage = new AuthStorage(join(appDataDir, 'auth.json'));
    storage.addAccount(
      PROVIDER,
      {
        access: ACCOUNT_ACCESS,
        refresh: 'mc-hop-kimi-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: ACCOUNT_DEVICE,
      },
      { label: 'Kimi Account A' },
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
    outbound = [];
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes('api.kimi.com')) {
        outbound.push({ host: 'kimi', bearer: '' });
        return rateLimitResponse();
      }
      if (url.includes('api.anthropic.com')) {
        outbound.push({ host: 'anthropic', bearer: '' });
        return completionResponse();
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

    // Both notices render live: the pool exhaustion, then the pack hop.
    try {
      await runtime.waitForScreenText(/All Kimi accounts unavailable \(pool exhausted\)/i, terminal, 30_000);
      await runtime.waitForScreenText(
        /Switched model pack: hop-kimi → Anthropic \(pool exhausted\)/i,
        terminal,
        30_000,
      );
      await runtime.waitForScreenText(new RegExp(RESPONSE_TEXT), terminal, 30_000);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nOUTBOUND=${JSON.stringify(outbound)}`,
        { cause: error },
      );
    }
    runtime.printScreen('after hop', terminal);

    // Stickiness: the live session now shows the landed pack's model.
    await runtime.waitForScreenText(/claude-fable-5/i, terminal, 10_000);

    // Raw outbound order: Kimi was tried first, Anthropic served the
    // completion, and no Kimi request follows the first Anthropic one.
    if (outbound.length === 0 || outbound[0]!.host !== 'kimi') {
      throw new Error(`Expected the first request to hit Kimi, saw: ${JSON.stringify(outbound)}`);
    }
    const firstAnthropic = outbound.findIndex(request => request.host === 'anthropic');
    if (firstAnthropic === -1 || outbound.slice(firstAnthropic).some(request => request.host === 'kimi')) {
      throw new Error(`Expected no Kimi request after the hop, saw: ${JSON.stringify(outbound)}`);
    }

    // Restart on the same app data and reload the thread: stickiness holds
    // and both notices re-render from persisted parts.
    await runtime.stopApp?.();
    await restartApp?.();
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 30_000);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/Hop|Completed|Threads/i, terminal, 10_000);
    await runtime.sleep(500);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to:/i, terminal, 10_000);
    await runtime.waitForScreenText(/All Kimi accounts unavailable \(pool exhausted\)/i, terminal, 30_000);
    await runtime.waitForScreenText(/Switched model pack: hop-kimi → Anthropic \(pool exhausted\)/i, terminal, 30_000);
    await runtime.waitForScreenText(/claude-fable-5/i, terminal, 10_000);
    runtime.printScreen('after restart history reload', terminal);
  },
};
