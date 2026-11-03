import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import type { GatewayLanguageModel } from '@mastra/core/llm';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AuthStorage } from '../auth/storage.js';
import { MastraCodeGateway } from './mastracode-gateway.js';

const { appDataDir } = vi.hoisted(() => {
  const directory = `${process.env.TMPDIR ?? '/tmp'}/mastracode-conversations-app-${process.pid}-${Date.now()}`;
  process.env.MASTRA_APP_DATA_DIR = directory;
  return { appDataDir: directory };
});

afterAll(() => rmSync(appDataDir, { recursive: true, force: true }));

const GATEWAY_URL = 'https://gateway.example.test';
const CUSTOM_PROVIDER_URL = 'https://custom.example.test';
const IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=';
const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  prompt_tokens: 10,
  completion_tokens: 5,
  promptTokenCount: 10,
  candidatesTokenCount: 5,
};

const tenantKey = { authorization: 'Bearer tenant-key' };
const tenantToken = { authorization: 'Bearer tenant-token' };
const tenantTokenThroughGateway = { ...tenantToken, 'x-memory-gateway-authorization': 'Bearer organization-key' };
const anthropicThinkingWithCachedSystem = {
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  system: expect.arrayContaining([
    expect.objectContaining({ cache_control: expect.objectContaining({ type: 'ephemeral' }) }),
  ]),
};
const openAIReasoningWithThreadCache = { reasoning: { effort: 'high' }, prompt_cache_key: 'picture-thread' };
const geminiThinkingWithTools = {
  generationConfig: { thinkingConfig: { thinkingLevel: 'high' } },
  tools: [
    {
      functionDeclarations: [
        {
          name: 'read_file',
          parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        },
      ],
    },
  ],
};

type Route = {
  name: string;
  providerId: string;
  modelId: string;
  credential: 'oauth' | 'api_key';
  viaGateway?: true;
  origin: string;
  headers: Record<string, string>;
  request: Record<string, unknown>;
  streamsUsage?: false;
  builtByCore?: true;
};

const claude = { providerId: 'anthropic', modelId: 'claude-sonnet-4-6' };
const gpt = { providerId: 'openai', modelId: 'gpt-5.5' };

const routes: Route[] = [
  {
    name: 'Anthropic API key',
    ...claude,
    credential: 'api_key',
    origin: 'https://api.anthropic.com',
    headers: { 'x-api-key': 'tenant-key' },
    request: anthropicThinkingWithCachedSystem,
  },
  {
    name: 'Claude Max OAuth',
    ...claude,
    credential: 'oauth',
    origin: 'https://api.anthropic.com',
    headers: tenantToken,
    request: anthropicThinkingWithCachedSystem,
  },
  {
    name: 'OpenAI API key',
    ...gpt,
    credential: 'api_key',
    origin: 'https://api.openai.com',
    headers: tenantKey,
    request: openAIReasoningWithThreadCache,
  },
  {
    name: 'Codex OAuth',
    ...gpt,
    credential: 'oauth',
    origin: 'https://chatgpt.com',
    headers: tenantToken,
    request: openAIReasoningWithThreadCache,
  },
  {
    name: 'Gemini thinking',
    providerId: 'google',
    modelId: 'gemini-3-flash-preview',
    credential: 'api_key',
    origin: 'https://generativelanguage.googleapis.com',
    headers: { 'x-goog-api-key': 'tenant-key' },
    request: geminiThinkingWithTools,
  },
  {
    name: 'custom endpoint',
    providerId: 'local',
    modelId: 'local-model',
    credential: 'api_key',
    origin: CUSTOM_PROVIDER_URL,
    headers: tenantKey,
    request: { model: 'local-model' },
    streamsUsage: false,
  },
  {
    name: 'xAI OAuth',
    providerId: 'xai',
    modelId: 'grok-4.6',
    credential: 'oauth',
    origin: 'https://api.x.ai',
    headers: tenantToken,
    request: { model: 'grok-4.6' },
    streamsUsage: false,
  },
  {
    name: 'Kimi OAuth',
    providerId: 'kimi-for-coding',
    modelId: 'k3',
    credential: 'oauth',
    origin: 'https://api.kimi.com',
    headers: tenantToken,
    request: { model: 'k3' },
  },
  {
    name: 'Copilot OAuth',
    providerId: 'github-copilot',
    modelId: 'gpt-4.1',
    credential: 'oauth',
    origin: 'https://api.githubcopilot.com',
    headers: tenantToken,
    request: { model: 'gpt-4.1' },
    streamsUsage: false,
  },
  {
    name: 'Factory organization key',
    ...gpt,
    credential: 'api_key',
    viaGateway: true,
    origin: GATEWAY_URL,
    headers: { authorization: 'Bearer organization-key' },
    request: { model: 'openai/gpt-5.5' },
    streamsUsage: false,
    builtByCore: true,
  },
  {
    name: 'Factory Claude OAuth',
    ...claude,
    credential: 'oauth',
    viaGateway: true,
    origin: GATEWAY_URL,
    headers: tenantTokenThroughGateway,
    request: anthropicThinkingWithCachedSystem,
  },
  {
    name: 'Factory Codex OAuth',
    ...gpt,
    credential: 'oauth',
    viaGateway: true,
    origin: GATEWAY_URL,
    headers: tenantTokenThroughGateway,
    request: openAIReasoningWithThreadCache,
  },
];

const switchTargets = {
  anthropic: {
    ...claude,
    credentialId: 'anthropic',
    origin: 'https://api.anthropic.com',
    headers: { 'x-api-key': 'next-tenant-key' },
  },
  openai: {
    ...gpt,
    credentialId: 'openai-codex',
    origin: 'https://api.openai.com',
    headers: { authorization: 'Bearer next-tenant-key' },
  },
};

let mock: LLMock;
let directory: string;
let sent: Array<{ origin: string; body: Record<string, unknown>; headers: Headers }>;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'mastracode-conversations-'));
  sent = [];
  mock = new LLMock({ port: 0 });
  mock.on(
    { sequenceIndex: 0 },
    { toolCalls: [{ id: 'call_read', name: 'read_file', arguments: '{"path":"picture.png"}' }], usage: USAGE },
  );
  mock.on({ sequenceIndex: 1 }, { content: 'The file contains a picture.', usage: USAGE });
  mock.on({ sequenceIndex: 2 }, { content: 'I still have the picture.', usage: USAGE });
  await mock.start();

  // OAuth providers skip their real fetch when VITEST is set.
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VITEST', '');
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const original = new URL(request.url);
    sent.push({ origin: original.origin, body: await request.clone().json(), headers: request.headers });
    const path = original.pathname.endsWith('/messages')
      ? '/v1/messages'
      : original.pathname.includes('/codex/responses')
        ? '/v1/responses'
        : original.pathname;
    return realFetch(new Request(`${mock.url}${path}${original.search}`, request));
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await mock?.stop();
  rmSync(directory, { recursive: true, force: true });
});

describe.each(routes)('conversations through $name', route => {
  it.each(['generate', 'stream'] as const)(
    '%s preserves tool images, usage and tenant authentication across a provider switch',
    async method => {
      const credentials = Object.assign(new AuthStorage(join(directory, 'auth.json')), {
        allowEnvironmentFallback: false,
      });
      credentials.set(
        route.providerId === 'openai' ? 'openai-codex' : route.providerId,
        route.credential === 'oauth'
          ? {
              type: 'oauth',
              access: 'tenant-token',
              refresh: 'tenant-refresh',
              expires: Date.now() + 3_600_000,
              accountId: 'tenant-account',
              deviceId: '0123456789abcdef0123456789abcdef',
            }
          : { type: 'api_key', key: 'tenant-key' },
      );
      const gateway = new MastraCodeGateway({
        mastraGatewayBaseUrl: GATEWAY_URL,
        routeThroughMastraGateway: route.viaGateway ?? false,
        thinkingLevel: 'high',
        credentialStore: credentials,
        customProviders: [{ name: 'Local', url: `${CUSTOM_PROVIDER_URL}/v1`, models: ['local-model'] }],
      });
      const createAgent = (model: GatewayLanguageModel) =>
        new Agent({
          id: 'provider-conversation',
          name: 'Picture reader',
          instructions: 'Read the file and describe its picture.',
          model,
          tools: {
            read_file: createTool({
              id: 'read_file',
              description: 'Read the picture file',
              inputSchema: z.strictObject({ path: z.string() }),
              execute: async ({ path }) => {
                expect(path).toBe('picture.png');
                return 'picture file';
              },
              toModelOutput: () => ({
                type: 'content',
                value: [
                  { type: 'text', text: 'picture file' },
                  { type: 'media', data: IMAGE, mediaType: 'image/png' },
                ],
              }),
            }),
          },
        });
      const model = gateway.resolveLanguageModel({
        providerId: route.providerId,
        modelId: route.modelId,
        apiKey: route.viaGateway ? 'organization-key' : 'tenant-key',
        headers: { 'x-thread-id': 'picture-thread' },
      });
      expect(model.specificationVersion).toBe(route.builtByCore ? 'v3' : 'v4');
      const agent = createAgent(model);
      const run = async (messages: Parameters<typeof agent.generate>[0], target = agent) =>
        method === 'generate'
          ? target.generate(messages, { maxSteps: 3 })
          : (await target.stream(messages, { maxSteps: 3 })).getFullOutput();
      const prompt = [{ role: 'user' as const, content: 'Read the picture file.' }];
      const result = await run(prompt);

      expect(result.text).toBe('The file contains a picture.');
      expect(result.finishReason).toBe('stop');
      if (method === 'generate' || route.streamsUsage !== false) {
        expect(result.totalUsage).toMatchObject({ inputTokens: 20, outputTokens: 10, totalTokens: 30 });
      }
      expect(sent).toHaveLength(2);
      const [first, toolResult] = sent;
      expect(first!.origin).toBe(route.origin);
      expect(Object.fromEntries(first!.headers)).toMatchObject(route.headers);
      expect(first!.body).toMatchObject(route.request);
      expect(toolResult!.origin).toBe(route.origin);
      expect(JSON.stringify(toolResult!.body)).toContain('picture file');
      expect(JSON.stringify(toolResult!.body)).toContain(IMAGE);

      const next = route.providerId === 'anthropic' ? switchTargets.openai : switchTargets.anthropic;
      credentials.set(next.credentialId, { type: 'api_key', key: 'next-tenant-key' });
      const nextGateway = new MastraCodeGateway({
        mastraGatewayBaseUrl: GATEWAY_URL,
        routeThroughMastraGateway: false,
        credentialStore: credentials,
        customProviders: [],
      });
      const followUp = await run(
        [...prompt, ...result.response.messages, { role: 'user', content: 'Describe the same picture again.' }],
        createAgent(
          nextGateway.resolveLanguageModel({
            providerId: next.providerId,
            modelId: next.modelId,
            apiKey: 'next-tenant-key',
          }),
        ),
      );

      expect(followUp.text).toBe('I still have the picture.');
      expect(followUp.totalUsage).toMatchObject({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
      expect(sent[2]!.origin).toBe(next.origin);
      expect(Object.fromEntries(sent[2]!.headers)).toMatchObject(next.headers);
      expect(JSON.stringify(sent[2]!.body)).toContain(IMAGE);
    },
  );
});

describe('Gemini structured output', () => {
  it.each(['generate', 'stream'] as const)('%s returns validated output with thinking enabled', async method => {
    const answer = { selection: 'C', reason: 'Reliability matters most.' };
    mock.reset().on({ sequenceIndex: 0 }, { content: JSON.stringify(answer), usage: USAGE });
    const gateway = new MastraCodeGateway({
      mastraGatewayBaseUrl: GATEWAY_URL,
      routeThroughMastraGateway: false,
      thinkingLevel: 'high',
      credentialStore: new AuthStorage(join(directory, 'auth.json')),
      customProviders: [],
    });
    const agent = new Agent({
      id: 'gemini-structured-choice',
      name: 'Option selector',
      instructions: 'Choose the option that best meets the user priorities.',
      model: gateway.resolveLanguageModel({
        providerId: 'google',
        modelId: 'gemini-3-flash-preview',
        apiKey: 'tenant-key',
      }),
    });
    const prompt = [
      {
        role: 'user' as const,
        content: 'Choose A for speed, B for price, or C for reliability. Reliability is my priority.',
      },
      { role: 'assistant' as const, content: 'I will select the most reliable option.' },
    ];
    const options = {
      structuredOutput: { schema: z.strictObject({ selection: z.enum(['A', 'B', 'C']), reason: z.string() }) },
    };
    const result =
      method === 'generate'
        ? await agent.generate(prompt, options)
        : await (await agent.stream(prompt, options)).getFullOutput();

    expect(result.object).toEqual(answer);
    expect(result.error).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.origin).toBe('https://generativelanguage.googleapis.com');
    expect(sent[0]!.headers.get('x-goog-api-key')).toBe('tenant-key');
    expect(sent[0]!.body).toMatchObject({
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: { selection: { type: 'string', enum: ['A', 'B', 'C'] }, reason: { type: 'string' } },
          required: ['selection', 'reason'],
        },
        thinkingConfig: { thinkingLevel: 'high' },
      },
    });
    expect(JSON.stringify(sent[0]!.body.contents)).toContain('I will select the most reliable option.');
  });
});
