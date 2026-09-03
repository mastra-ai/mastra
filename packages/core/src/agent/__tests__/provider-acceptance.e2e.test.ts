/**
 * Provider acceptance suite.
 *
 * Each case pushes a "tricky" conversation shape through a real `Agent` and a real
 * provider, and pins two things:
 *
 *   1. the provider accepted the request (recorded response, replayed with exactMatch so
 *      any drift in the outbound body fails loudly instead of fuzzy-matching), and
 *   2. the wire body we sent has the shape we intend for that provider.
 *
 * Mock-model tests only prove what we *believe* a provider wants. These recordings are
 * the only artifact in the repo that encodes what the provider actually accepts.
 *
 * Recordings are split per provider so a provider without a recording is a visible skip
 * rather than a silent pass. To (re)record one provider:
 *
 *   LLM_TEST_MODE=record ANTHROPIC_API_KEY=... pnpm vitest run provider-acceptance --project e2e
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defaultNameGenerator, getLLMRecordingsDir, getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, hasRealApiKey, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../agent';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic', 'google']);

type ProviderKey = 'openai' | 'anthropic' | 'google';

const PROVIDERS: { key: ProviderKey; model: string; host: string }[] = [
  { key: 'openai', model: 'openai/gpt-4o-mini', host: 'api.openai.com' },
  { key: 'anthropic', model: 'anthropic/claude-haiku-4-5', host: 'api.anthropic.com' },
  { key: 'google', model: 'google/gemini-3.6-flash', host: 'generativelanguage.googleapis.com' },
];

/** Extract `[role, text]` pairs from a provider request body, normalising provider dialects. */
function wireTurns(provider: ProviderKey, body: any): [string, string][] {
  switch (provider) {
    case 'openai': {
      // Responses API: `input` is a list of {role, content}; content may be a string or parts.
      const items = body.input ?? body.messages ?? [];
      return items
        .filter((m: any) => m.role && m.role !== 'system' && m.role !== 'developer')
        .map((m: any) => {
          const text =
            typeof m.content === 'string'
              ? m.content
              : (m.content ?? []).map((p: any) => p.text ?? p.input_text ?? '').join('');
          return [m.role, text];
        });
    }
    case 'anthropic':
      return body.messages.map((m: any) => [
        m.role,
        typeof m.content === 'string' ? m.content : m.content.map((p: any) => p.text ?? '').join(''),
      ]);
    case 'google':
      return body.contents.map((c: any) => [
        c.role === 'model' ? 'assistant' : c.role,
        c.parts.map((p: any) => p.text ?? '').join(''),
      ]);
  }
}

for (const { key, model, host } of PROVIDERS) {
  const recordingsDir = join(getLLMRecordingsDir(__filename), defaultNameGenerator(__filename));
  const recordingName = `provider-acceptance-${key}`;
  const hasRecording = existsSync(join(recordingsDir, `${recordingName}.json`));
  const canRun = MODE === 'replay' || MODE === 'auto' ? hasRecording || hasRealApiKey(key) : hasRealApiKey(key);

  describe.skipIf(!canRun)(`provider acceptance › ${key}`, () => {
    let mock: ReturnType<typeof createGatewayMock>;
    let sent: any[] = [];
    let realFetch: typeof globalThis.fetch;

    beforeAll(async () => {
      mock = createGatewayMock({ name: recordingName, recordingsDir, exactMatch: true });
      await mock.start();
    });
    afterAll(() => mock.saveAndStop());

    beforeEach(() => {
      // Wrap fetch *after* the recorder has patched it so we observe the exact outbound body.
      realFetch = globalThis.fetch;
      sent = [];
      globalThis.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes(host) && init?.body && typeof init.body === 'string') {
          sent.push(JSON.parse(init.body));
        }
        return realFetch(input, init);
      };
    });

    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    const agent = () =>
      new Agent({
        id: 'acceptance',
        name: 'acceptance',
        instructions: 'Answer in at most five words.',
        model,
      });

    it('accepts a history whose first non-system turn is from the assistant', async () => {
      // Memory's `lastMessages` window regularly produces this shape.
      const result = await agent().generate([
        { role: 'assistant', content: 'Hello! How can I help you today?' },
        { role: 'user', content: 'Say the word "ready" and nothing else.' },
      ]);

      expect(result.text.toLowerCase()).toContain('ready');
      expect(sent).toHaveLength(1);
      const turns = wireTurns(key, sent[0]);
      if (key === 'google') {
        // Gemini rejects assistant-first histories, so we prepend a synthetic user turn.
        expect(turns[0]).toEqual(['user', '.']);
        expect(turns[1]?.[0]).toBe('assistant');
      } else {
        // Every other provider gets the history exactly as stored — no fabricated user turn.
        expect(turns[0]?.[0]).toBe('assistant');
        expect(turns.some(([, text]) => text === '.')).toBe(false);
      }
    });

    it('accepts two consecutive user turns', async () => {
      const result = await agent().generate([
        { role: 'user', content: 'I will ask a question next.' },
        { role: 'user', content: 'Say the word "ready" and nothing else.' },
      ]);

      expect(result.text.toLowerCase()).toContain('ready');
      expect(sent).toHaveLength(1);
      const turns = wireTurns(key, sent[0]);
      expect(turns.every(([role]) => role === 'user')).toBe(true);
    });

    it('accepts a normal alternating history (control)', async () => {
      const result = await agent().generate([
        { role: 'user', content: 'Hi.' },
        { role: 'assistant', content: 'Hello! How can I help you today?' },
        { role: 'user', content: 'Say the word "ready" and nothing else.' },
      ]);

      expect(result.text.toLowerCase()).toContain('ready');
      expect(sent).toHaveLength(1);
      expect(wireTurns(key, sent[0]).map(([role]) => role)).toEqual(['user', 'assistant', 'user']);
    });
  });
}
