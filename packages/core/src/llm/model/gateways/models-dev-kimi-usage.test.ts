/**
 * r325: Kimi steps must record their real token counts.
 *
 * The fixtures below are two REAL streamed replies from Kimi's OpenAI-compatible endpoint
 * (api.kimi.ai/coding/v1/chat/completions, model k3.1-pro, "Say hi in one word.", max_tokens 32),
 * captured 2026-10-25 ~23:45Z. When the request does not ask for usage, Kimi nests it inside
 * choices[0], which @ai-sdk/openai-compatible never reads (it only reads top-level `usage`), so the
 * step's usage comes back all-undefined and Director's usage recorder has to mark every metric
 * missing. When the request sets stream_options.include_usage, Kimi sends standard top-level usage.
 * The stubbed fetch here answers exactly the way the real endpoint did.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ModelsDevGateway } from './models-dev.js';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
const WITHOUT_INCLUDE = 'kimi-stream-without-include-usage.sse';
const WITH_INCLUDE = 'kimi-stream-with-include-usage.sse';

// Numbers the endpoint really returned; asserted literally, never derived from the code under test.
const REAL = { input: 91, output: 32, cacheRead: 91, reasoning: 29 };

async function runKimiStream() {
  const requests: string[] = [];
  const fetchStub = vi.fn(async (_input: unknown, init?: { body?: string }) => {
    const body = String(init?.body ?? '');
    requests.push(body);
    const asked = /"stream_options"\s*:\s*\{\s*"include_usage"\s*:\s*true\s*\}/.test(body);
    const fixtureName = asked ? WITH_INCLUDE : WITHOUT_INCLUDE;
    return new Response(fixture(fixtureName), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  });
  vi.stubGlobal('fetch', fetchStub);

  const gateway = new ModelsDevGateway({
    'kimi-code-plan-global': {
      apiKeyEnvVar: 'KIMI_API_KEY',
      name: 'Kimi For Coding (kimi.ai)',
      models: ['k3.1-pro'],
      gateway: 'models.dev',
      url: 'https://api.kimi.ai/coding/v1',
    },
  });
  const model = await gateway.resolveLanguageModel({
    providerId: 'kimi-code-plan-global',
    modelId: 'k3.1-pro',
    apiKey: 'sk-test',
  });
  const result = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hi in one word.' }] }],
    maxOutputTokens: 32,
    providerOptions: {},
  });
  const reader = result.stream.getReader();
  let finish: any;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === 'finish') finish = value;
    if (value.type === 'error') throw new Error(`stream error: ${JSON.stringify(value)}`);
  }
  return { finish, requests };
}

describe('kimi-code-plan-global streaming usage (r325)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for usage and reads the real token counts out of the stream', async () => {
    const { finish, requests } = await runKimiStream();
    expect(finish, 'the stream finishes').toBeDefined();
    expect(
      requests.some(body => body.includes('"include_usage":true')),
      'the request asks Kimi for usage (stream_options.include_usage)',
    ).toBe(true);
    expect(finish.usage.inputTokens.total, 'input tokens the provider reported').toBe(REAL.input);
    expect(finish.usage.outputTokens.total, 'output tokens the provider reported').toBe(REAL.output);
    expect(finish.usage.inputTokens.cacheRead, 'cached input tokens the provider reported').toBe(REAL.cacheRead);
    expect(finish.usage.outputTokens.reasoning, 'reasoning tokens the provider reported').toBe(REAL.reasoning);
  });
});
