import { once } from 'node:events';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { appDataDir } = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/mastracode-gateway-thinking-${process.pid}-${Date.now()}`;
  process.env.MASTRA_APP_DATA_DIR = dir;
  return { appDataDir: dir };
});

import type { ThinkingLevelSetting } from '../thinking.js';
import { MastraCodeGateway, reloadAuthStorage } from './mastracode-gateway.js';

mkdirSync(appDataDir, { recursive: true });

function createGateway(thinkingLevel: ThinkingLevelSetting | undefined, { routeThroughMastraGateway = false } = {}) {
  return new MastraCodeGateway({
    mastraGatewayBaseUrl: 'https://gateway.example.com',
    routeThroughMastraGateway,
    thinkingLevel,
    customProviders: [{ name: 'My Local', url: 'https://custom.example.com/v1', models: ['local-model'] }] as any,
    settingsPath: join(tmpdir(), 'nonexistent-settings.json'),
  });
}

let bodies: Array<Record<string, any>>;

async function requestBody(model: any, providerOptions?: Record<string, Record<string, unknown>>) {
  bodies = [];
  await model
    .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], providerOptions })
    .catch(() => undefined);
  expect(bodies).toHaveLength(1);
  return bodies[0]!;
}

describe('MastraCodeGateway thinking level forwarding', () => {
  const prevOpenAIKey = process.env.OPENAI_API_KEY;
  let server: Server;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    writeFileSync(join(appDataDir, 'auth.json'), '{}', 'utf8');
    reloadAuthStorage();
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Request captured by the provider fixture' } }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      return realFetch(new Request(`${baseURL}${url.pathname}${url.search}`, request));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
    if (prevOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevOpenAIKey;
  });

  afterAll(() => rmSync(appDataDir, { recursive: true, force: true }));

  const resolve = (level: ThinkingLevelSetting | undefined, providerId: string, modelId: string) =>
    createGateway(level).resolveLanguageModel({ providerId, modelId, apiKey: 'k' });

  it('sends reasoning_effort to custom OpenAI-compatible providers', async () => {
    expect((await requestBody(resolve('high', 'my-local', 'local-model'))).reasoning_effort).toBe('high');
    expect((await requestBody(resolve('xhigh', 'my-local', 'local-model'))).reasoning_effort).toBe('xhigh');
  });

  it('sends reasoning effort on the OpenAI API-key path', async () => {
    expect((await requestBody(resolve('low', 'openai', 'gpt-5.5'))).reasoning).toMatchObject({ effort: 'low' });
  });

  it('sends thinkingLevel to Gemini 3 and thinkingBudget to Gemini 2.5', async () => {
    const g3 = await requestBody(resolve('medium', 'google', 'gemini-3-flash-preview'));
    expect(g3.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'medium' });
    const g25 = await requestBody(resolve('low', 'google', 'gemini-2.5-flash'));
    expect(g25.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 1024 });
  });

  it('sends DeepSeek the reasoning effort the model runs', async () => {
    expect((await requestBody(resolve('max', 'deepseek', 'deepseek-v4-pro'))).reasoning_effort).toBe('max');
    expect((await requestBody(resolve('xhigh', 'deepseek', 'deepseek-v4-pro'))).reasoning_effort).toBe('high');
  });

  it('caps the effort at what the provider package accepts, so the request is not rejected', async () => {
    expect((await requestBody(resolve('max', 'mistral', 'zai-glm-5-2'))).reasoning_effort).toBe('high');
  });

  it.each(['low', 'max'] as const)('sends Mistral GLM-5.3 the selected %s effort', async level => {
    expect((await requestBody(resolve(level, 'mistral', 'zai-glm-5-3'))).reasoning_effort).toBe(level);
  });

  it.each(['grok-4.5', 'grok-4.6'])('sends Extra high to xAI %s, which lists it', async modelId => {
    expect((await requestBody(resolve('max', 'xai', modelId))).reasoning).toEqual({ effort: 'xhigh' });
  });

  it('leaves xAI models without reasoning controls untouched', async () => {
    expect(await requestBody(resolve('xhigh', 'xai', 'grok-4.20-0309-reasoning'))).not.toHaveProperty('reasoning');
  });

  it('passes Cerebras the closest listed effort', async () => {
    expect((await requestBody(resolve('max', 'cerebras', 'gpt-oss-120b'))).reasoning_effort).toBe('high');
  });

  it.each(['perplexity', 'perplexity-agent'])('sends %s thinking through the Agent API options', async providerId => {
    const body = await requestBody(resolve('max', providerId, 'openai/gpt-5.5'));
    expect(body.reasoning).toEqual({ effort: 'xhigh' });
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it.each(['perplexity', 'perplexity-agent'])(
    "preserves the caller's legacy %s reasoning setting over the session level",
    async providerId => {
      const body = await requestBody(resolve('high', providerId, 'openai/gpt-5.5'), {
        perplexity: { reasoning_effort: 'low' },
      });
      expect(body.reasoning).toEqual({ effort: 'low' });
    },
  );

  it.each(['perplexity', 'perplexity-agent'])(
    "preserves the caller's native %s reasoning setting over the session level",
    async providerId => {
      const body = await requestBody(resolve('high', providerId, 'openai/gpt-5.5'), {
        perplexity: { reasoning: { effort: 'low' } },
      });
      expect(body.reasoning).toEqual({ effort: 'low' });
    },
  );

  it.each([
    ['togetherai', 'Qwen/Qwen3.5-9B'],
    ['deepinfra', 'XiaomiMiMo/MiMo-V2.6-Pro'],
  ])('switches thinking on for %s models that only toggle it', async (providerId, modelId) => {
    const on = await requestBody(resolve('high', providerId, modelId));
    expect(on.reasoning).toEqual({ enabled: true });
    expect(on).not.toHaveProperty('reasoning_effort');
  });

  it.each([
    ['deepinfra', 'deepseek-ai/DeepSeek-V4.1-Flash'],
    ['togetherai', 'thinkingmachines/Inkling'],
  ])("caps %s's effort at the levels its API documents", async (providerId, modelId) => {
    expect((await requestBody(resolve('max', providerId, modelId))).reasoning_effort).toBe('high');
  });

  it('switches Alibaba thinking on', async () => {
    expect((await requestBody(resolve('high', 'alibaba', 'qwen-flash'))).enable_thinking).toBe(true);
  });

  it("sends OpenRouter's reasoning setting", async () => {
    expect((await requestBody(resolve('max', 'openrouter', 'deepseek/deepseek-v4-pro'))).reasoning).toEqual({
      effort: 'xhigh',
    });
    expect((await requestBody(resolve('high', 'openrouter', 'bytedance-seed/seed-1.6-flash'))).reasoning).toEqual({
      enabled: true,
    });
  });

  const resolveThroughGateway = (level: ThinkingLevelSetting, providerId: string, modelId: string) =>
    createGateway(level, { routeThroughMastraGateway: true }).resolveLanguageModel({
      providerId,
      modelId,
      apiKey: 'gateway-key',
    });

  it.each([
    ['anthropic', 'claude-opus-4-7'],
    ['openai', 'gpt-5.5'],
    ['google', 'gemini-3-pro-preview'],
    ['deepseek', 'deepseek-v4-pro'],
  ])(
    'sends %s through the Mastra gateway no thinking field, since the gateway forwards the body as is to an org key',
    async (providerId, modelId) => {
      for (const level of ['high', 'max'] as const) {
        const body = await requestBody(resolveThroughGateway(level, providerId, modelId));
        for (const thinkingField of ['thinking', 'reasoning_effort', 'reasoning', 'enable_thinking']) {
          expect(body).not.toHaveProperty(thinkingField);
        }
      }
    },
  );

  it("keeps the caller's own DeepSeek effort over the level", async () => {
    const body = await requestBody(resolve('low', 'deepseek', 'deepseek-v4-pro'), {
      deepseek: { reasoningEffort: 'max' },
    });
    expect(body.reasoning_effort).toBe('max');
  });

  it.each([undefined, 'off'] as const)('leaves every path untouched when thinking is %s', async level => {
    expect(await requestBody(resolve(level, 'my-local', 'local-model'))).not.toHaveProperty('reasoning_effort');
    expect(await requestBody(resolve(level, 'openai', 'gpt-5.5'))).not.toHaveProperty('reasoning');
    const google = await requestBody(resolve(level, 'google', 'gemini-3-flash-preview'));
    expect(google.generationConfig?.thinkingConfig).toBeUndefined();
    for (const [providerId, modelId] of [
      ['deepseek', 'deepseek-v4-pro'],
      ['groq', 'qwen/qwen3.8-27b'],
      ['togetherai', 'Qwen/Qwen3.5-9B'],
      ['alibaba', 'qwen-flash'],
      ['openrouter', 'deepseek/deepseek-v4-pro'],
      ['perplexity', 'openai/gpt-5.5'],
      ['perplexity-agent', 'openai/gpt-5.5'],
    ] as const) {
      const body = await requestBody(resolve(level, providerId, modelId));
      for (const thinkingField of ['thinking', 'reasoning_effort', 'reasoning', 'enable_thinking']) {
        expect(body).not.toHaveProperty(thinkingField);
      }
    }
  });

  it('leaves Gemini models without thinking support untouched', async () => {
    const body = await requestBody(resolve('high', 'google', 'gemini-2.0-flash'));
    expect(body.generationConfig?.thinkingConfig).toBeUndefined();
  });

  it('fits the Codex OAuth effort to the model the user picked, not its codex variant', async () => {
    writeFileSync(
      join(appDataDir, 'auth.json'),
      JSON.stringify({ 'openai-codex': { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 } }),
      'utf8',
    );
    reloadAuthStorage();

    expect((await requestBody(resolve('xhigh', 'openai', 'gpt-5'))).reasoning).toMatchObject({ effort: 'high' });
  });

  it('sends the xAI OAuth path the same effort as the xAI API-key path', async () => {
    writeFileSync(
      join(appDataDir, 'auth.json'),
      JSON.stringify({ xai: { type: 'oauth', access: 'a', refresh: 'r', expires: Date.now() + 1_000_000 } }),
      'utf8',
    );
    reloadAuthStorage();

    expect((await requestBody(resolve('max', 'xai', 'grok-4.6'))).reasoning_effort).toBe('xhigh');
  });
});
