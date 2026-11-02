/**
 * E2E: pack fallback hop on a safety refusal.
 *
 * One Kimi account on a custom pack whose fallback is the builtin Anthropic
 * pack. The fetch patch answers by host: api.kimi.com → a successful
 * Anthropic-format response that stops with `stop_reason: "refusal"` (the
 * shape of a classifier refusal); api.anthropic.com → a normal completion.
 *
 * Without the refusal fallback the turn ends on Kimi's refusal. With it:
 *  - the hop notice renders with the refusal reason,
 *  - the fallback's answer renders and the status line names the fallback,
 *  - outbound order is Kimi then Anthropic, with no Kimi request after.
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

let outbound: string[] = [];

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function anthropicSse(text: string, stopReason: 'end_turn' | 'refusal'): Response {
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
      { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 12 } },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
  const body = events.map(([event, payload]) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export const refusalFallbackScenario: McE2eScenario = {
  name: 'refusal-fallback',
  description:
    'A Kimi pack whose model refuses the request (stop_reason refusal) hops to its Anthropic fallback pack, ' +
    'renders the refusal hop notice and the fallback answer, and never asks Kimi again.',
  testName: 'hops to the fallback pack when the model refuses',
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
        return anthropicSse(REFUSAL_TEXT, 'refusal');
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
    await runtime.waitForScreenText(/Using fallback Anthropic \(refusing-kimi failed\)/i, terminal, 10_000);

    if (outbound[0] !== 'kimi') {
      throw new Error(`Expected the first request to hit Kimi, saw: ${JSON.stringify(outbound)}`);
    }
    const firstAnthropic = outbound.indexOf('anthropic');
    if (firstAnthropic === -1 || outbound.slice(firstAnthropic).includes('kimi')) {
      throw new Error(`Expected no Kimi request after the hop, saw: ${JSON.stringify(outbound)}`);
    }
  },
};
