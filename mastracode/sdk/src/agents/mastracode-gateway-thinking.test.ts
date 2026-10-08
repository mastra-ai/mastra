import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
    mastraGatewayApiKey: 'gateway-key',
    routeThroughMastraGateway,
    thinkingLevel,
    customProviders: [{ name: 'My Local', url: 'https://custom.example.com/v1', models: ['local-model'] }] as any,
    settingsPath: join(tmpdir(), 'nonexistent-settings.json'),
  });
}

let bodies: Array<Record<string, any>>;

async function requestBody(model: any): Promise<Record<string, any>> {
  bodies = [];
  await model
    .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
    .catch(() => undefined);
  expect(bodies).toHaveLength(1);
  return bodies[0]!;
}

describe('MastraCodeGateway thinking level forwarding', () => {
  const prevOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
    writeFileSync(join(appDataDir, 'auth.json'), '{}', 'utf8');
    reloadAuthStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response('{}', { status: 500 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('turns DeepSeek thinking off, which DeepSeek leaves on by default', async () => {
    const body = await requestBody(resolve('off', 'deepseek', 'deepseek-v4-pro'));
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('leaves a DeepSeek request untouched when no thinking level is set', async () => {
    const body = await requestBody(resolve(undefined, 'deepseek', 'deepseek-v4-pro'));
    expect(body).not.toHaveProperty('thinking');
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('caps the effort at what the provider package accepts, so the request is not rejected', async () => {
    expect((await requestBody(resolve('max', 'mistral', 'zai-glm-5-2'))).reasoning_effort).toBe('high');
    expect((await requestBody(resolve('xhigh', 'xai', 'grok-4.7'))).reasoning).toEqual({ effort: 'high' });
  });

  it('runs off as the lowest effort on models that cannot turn thinking off, as the picker shows', async () => {
    expect((await requestBody(resolve('off', 'groq', 'qwen/qwen3.8-27b'))).reasoning_effort).toBe('none');
    expect((await requestBody(resolve('off', 'groq', 'openai/gpt-oss-20b'))).reasoning_effort).toBe('low');
  });

  it('passes the listed effort to OpenAI-compatible providers and Perplexity', async () => {
    expect((await requestBody(resolve('max', 'togetherai', 'deepseek-ai/DeepSeek-V4-Pro-0813'))).reasoning_effort).toBe(
      'max',
    );
    expect((await requestBody(resolve('max', 'perplexity', 'sonar-reasoning-pro'))).reasoning_effort).toBe('high');
  });

  it('sends no effort to a model that only switches thinking on or off through an OpenAI-compatible provider', async () => {
    expect(await requestBody(resolve('high', 'togetherai', 'Qwen/Qwen3.5-9B'))).not.toHaveProperty('reasoning_effort');
  });

  it('switches Alibaba thinking on and off', async () => {
    expect((await requestBody(resolve('off', 'alibaba', 'qwen-flash'))).enable_thinking).toBe(false);
    expect((await requestBody(resolve('high', 'alibaba', 'qwen-flash'))).enable_thinking).toBe(true);
  });

  it("sends OpenRouter's reasoning setting", async () => {
    expect((await requestBody(resolve('max', 'openrouter', 'deepseek/deepseek-v4-pro'))).reasoning).toEqual({
      effort: 'xhigh',
    });
    expect((await requestBody(resolve('off', 'openrouter', 'deepseek/deepseek-v4-pro'))).reasoning).toEqual({
      enabled: false,
    });
    expect((await requestBody(resolve('high', 'openrouter', 'bytedance-seed/seed-1.6-flash'))).reasoning).toEqual({
      enabled: true,
    });
  });

  it("sends OpenRouter's reasoning setting for models routed through the Mastra gateway", async () => {
    const model = createGateway('max', { routeThroughMastraGateway: true }).resolveLanguageModel({
      providerId: 'deepseek',
      modelId: 'deepseek-v4-pro',
      apiKey: 'gateway-key',
    });
    expect((await requestBody(model)).reasoning).toEqual({ effort: 'max' });
  });

  it.each([undefined, 'off'] as const)('leaves every path untouched when thinking is %s', async level => {
    expect(await requestBody(resolve(level, 'my-local', 'local-model'))).not.toHaveProperty('reasoning_effort');
    expect(await requestBody(resolve(level, 'openai', 'gpt-5.5'))).not.toHaveProperty('reasoning');
    const google = await requestBody(resolve(level, 'google', 'gemini-3-flash-preview'));
    expect(google.generationConfig?.thinkingConfig).toBeUndefined();
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

    expect((await requestBody(resolve('xhigh', 'xai', 'grok-4.7'))).reasoning_effort).toBe('high');
  });
});
