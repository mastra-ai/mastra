/**
 * Resolver-level tests: the session thinking level must reach the wire body for
 * Google, custom OpenAI-compatible, and OpenAI API-key models, and must leave
 * requests untouched when thinking is off or unset.
 */

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

function createGateway(thinkingLevel: ThinkingLevelSetting | undefined) {
  return new MastraCodeGateway({
    mastraGatewayBaseUrl: 'https://gateway.example.com',
    routeThroughMastraGateway: false,
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
});
