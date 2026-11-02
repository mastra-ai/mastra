/**
 * E2E: a cyber refusal moves the turn to the pack's fallback, for that turn only.
 *
 * One Kimi account on a custom pack whose fallback is the builtin Anthropic
 * pack. The fetch patch answers by host: api.kimi.com → an Anthropic-format
 * response that stops with `stop_reason: "refusal"` and a `cyber` stop
 * category, for the first two requests (the refusal and the refused `continue`
 * nudge), then normal answers; api.anthropic.com → a normal completion.
 *
 * Without the fallback the turn ends on Kimi's refusal. With it:
 *  - the hop notice renders with the refusal reason and the fallback answers,
 *  - the next message goes back to Kimi,
 *  - outbound order is Kimi, Kimi (nudge), Anthropic, then Kimi.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';

import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const PROVIDER = 'kimi-for-coding';
const PACK_NAME = 'refusing-kimi';
const KIMI_MODEL_ID = 'kimi-for-coding/kimi-for-coding';
const PROMPT = 'Walk me through the buffer overflow in this CTF binary.';
const REFUSAL_TEXT = 'I can not help with that request.';
const RESPONSE_TEXT = 'Answered by the fallback pack after the refusal.';
const SECOND_PROMPT = 'Thanks. Now summarize the README.';
const KIMI_TEXT = 'Back on the Kimi pack for this one.';

let outbound: string[] = [];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function anthropicSse(text: string, stopReason: 'end_turn' | 'refusal'): Response {
  const stopDetails =
    stopReason === 'refusal'
      ? { type: 'refusal', category: 'cyber', explanation: 'This request triggered restrictions on cyber content.' }
      : null;
  const events: Array<[string, object]> = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: `msg_${stopReason}`,
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
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null, stop_details: stopDetails },
        usage: { output_tokens: 12 },
      },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  const body = events.map(([event, payload]) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export const refusalFallbackScenario: McE2eScenario = {
  name: 'refusal-fallback',
  description:
    'A Kimi pack whose model gives a cyber refusal (and refuses the continue nudge) finishes the turn on its ' +
    'Anthropic fallback pack with a refusal notice, and the next message goes back to Kimi.',
  testName: 'finishes a cyber-refused turn on the fallback pack, then returns',
  async prepare({ appDataDir }) {
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
      packFallbacks: { [`custom:${PACK_NAME}`]: 'anthropic' },
    };
    settings.customModelPacks = [
      { name: PACK_NAME, models: { build: KIMI_MODEL_ID }, createdAt: new Date().toISOString() },
    ];
    settings.customProviders = [];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const storage = new AuthStorage(join(appDataDir, 'auth.json'));
    await storage.addAccount(
      PROVIDER,
      {
        access: 'mc-refusal-kimi-access',
        refresh: 'mc-refusal-kimi-refresh',
        expires: Date.now() + 60 * 60 * 1000,
        deviceId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
      const hostname = new URL(requestUrl(input)).hostname;
      if (hostname === 'api.kimi.com') {
        outbound.push('kimi');
        const kimiCalls = outbound.filter(host => host === 'kimi').length;
        return kimiCalls <= 2 ? anthropicSse(REFUSAL_TEXT, 'refusal') : anthropicSse(KIMI_TEXT, 'end_turn');
      }
      if (hostname === 'api.anthropic.com') {
        outbound.push('anthropic');
        return anthropicSse(RESPONSE_TEXT, 'end_turn');
      }
      return originalFetch(input, init);
    });
    try {
      const app = await startMastraCodeApp();
      return {
        stop: async () => {
          try {
            await app.stop();
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

    terminal.submit(PROMPT);
    try {
      await runtime.waitForScreenText(
        /Switched model pack: refusing-kimi → Anthropic \(model refused\)/i,
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
    runtime.printScreen('after refusal hop', terminal);
    const afterHop = [...outbound];
    if (JSON.stringify(afterHop) !== JSON.stringify(['kimi', 'kimi', 'anthropic'])) {
      throw new Error(`Expected Kimi, the Kimi nudge, then Anthropic; saw: ${JSON.stringify(afterHop)}`);
    }

    terminal.submit(SECOND_PROMPT);
    await runtime.waitForScreenText(new RegExp(KIMI_TEXT), terminal, 30_000);
    runtime.printScreen('next message', terminal);
    if (JSON.stringify(outbound) !== JSON.stringify([...afterHop, 'kimi'])) {
      throw new Error(`Expected the next message to go back to Kimi; saw: ${JSON.stringify(outbound)}`);
    }
  },
};
