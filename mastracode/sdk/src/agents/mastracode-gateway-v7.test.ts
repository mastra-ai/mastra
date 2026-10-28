import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AuthStorage } from '../auth/storage.js';
import { MastraCodeGateway } from './mastracode-gateway.js';

const { appDataDir } = vi.hoisted(() => {
  const directory = `${process.env.TMPDIR ?? '/tmp'}/mastracode-v7-app-${process.pid}-${Date.now()}`;
  process.env.MASTRA_APP_DATA_DIR = directory;
  return { appDataDir: directory };
});

afterAll(() => rmSync(appDataDir, { recursive: true, force: true }));

const IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=';
const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  prompt_tokens: 10,
  completion_tokens: 5,
  promptTokenCount: 10,
  candidatesTokenCount: 5,
};

const routes: Array<{ name: string; providerId: string; modelId: string; oauth?: boolean; gateway?: boolean }> = [
  { name: 'Anthropic API key', providerId: 'anthropic', modelId: 'claude-sonnet-4-6' },
  { name: 'Claude Max OAuth', providerId: 'anthropic', modelId: 'claude-sonnet-4-6', oauth: true },
  { name: 'OpenAI API key', providerId: 'openai', modelId: 'gpt-5.5' },
  { name: 'Codex OAuth', providerId: 'openai', modelId: 'gpt-5.5', oauth: true },
  { name: 'Gemini thinking', providerId: 'google', modelId: 'gemini-3-flash-preview' },
  { name: 'custom endpoint', providerId: 'local', modelId: 'local-model' },
  { name: 'xAI OAuth', providerId: 'xai', modelId: 'grok-4.6', oauth: true },
  { name: 'Kimi OAuth', providerId: 'kimi-for-coding', modelId: 'k3', oauth: true },
  { name: 'Copilot OAuth', providerId: 'github-copilot', modelId: 'gpt-4.1', oauth: true },
  { name: 'Factory organization key', providerId: 'openai', modelId: 'gpt-5.5', gateway: true },
  { name: 'Factory Claude OAuth', providerId: 'anthropic', modelId: 'claude-sonnet-4-6', oauth: true, gateway: true },
  { name: 'Factory Codex OAuth', providerId: 'openai', modelId: 'gpt-5.5', oauth: true, gateway: true },
];

// Exercise the same shared SDK boundary used by Factory and the TUI, with real
// adapters, credentials and agent tool loops. Only the paid API is replaced by
// an HTTP server; the fetch wrapper below forwards the real request to it.
describe.each(routes)('AI SDK v7 conversations through $name', route => {
  let mock: LLMock;
  let directory: string;
  let sent: Array<{ body: Record<string, unknown>; headers: Headers }>;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'mastracode-v7-'));
    sent = [];
    mock = new LLMock({ port: 0 });
    mock.on(
      { sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_read', name: 'read_file', arguments: '{}' }], usage: USAGE },
    );
    mock.on({ sequenceIndex: 1 }, { content: 'The file contains a picture.', usage: USAGE });
    mock.on({ sequenceIndex: 2 }, { content: 'I still have the picture.', usage: USAGE });
    await mock.start();

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITEST', '');
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const original = new URL(request.url);
      sent.push({ body: await request.clone().json(), headers: request.headers });
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

  it.each(['generate', 'stream'] as const)(
    '%s preserves tool images, usage and tenant authentication across a provider switch',
    async method => {
      const credentials = Object.assign(new AuthStorage(join(directory, 'auth.json')), {
        allowEnvironmentFallback: false,
      });
      const credentialId = route.providerId === 'openai' ? 'openai-codex' : route.providerId;
      credentials.set(
        credentialId,
        route.oauth
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
        mastraGatewayBaseUrl: mock.url,
        routeThroughMastraGateway: route.gateway ?? false,
        thinkingLevel: 'high',
        credentialStore: credentials,
        customProviders: [{ name: 'Local', url: `${mock.url}/v1`, models: ['local-model'] }],
      });
      const model = gateway.resolveLanguageModel({
        providerId: route.providerId,
        modelId: route.modelId,
        apiKey: route.gateway ? 'organization-key' : 'tenant-key',
        headers: { 'x-thread-id': 'picture-thread' },
      });
      const createAgent = (model: ReturnType<MastraCodeGateway['resolveLanguageModel']>) =>
        new Agent({
          id: 'v7-provider-conversation',
          name: 'Picture reader',
          instructions: 'Read the file and describe its picture.',
          model,
          tools: {
            read_file: createTool({
              id: 'read_file',
              description: 'Read the picture file',
              inputSchema: z.object({}),
              execute: async () => 'picture file',
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
      const agent = createAgent(model);
      const run = async (messages: Parameters<typeof agent.generate>[0], target = agent) =>
        method === 'generate'
          ? target.generate(messages, { maxSteps: 3 })
          : (await target.stream(messages, { maxSteps: 3 })).getFullOutput();
      const prompt = [{ role: 'user' as const, content: 'Read the picture file.' }];
      const result = await run(prompt);

      expect(result.text).toBe('The file contains a picture.');
      expect(result.finishReason).toBe('stop');
      // These OpenAI-compatible routes do not request streaming usage; retain
      // unknown counters rather than inventing token counts when none are sent.
      const hasUsage =
        method === 'generate' ||
        (!['local', 'xai', 'github-copilot'].includes(route.providerId) && !(route.gateway && !route.oauth));
      expect(result.totalUsage).toMatchObject(
        hasUsage
          ? { inputTokens: 20, outputTokens: 10, totalTokens: 30 }
          : { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      );
      const requests = sent;
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requests[1]!.body)).toContain('picture file');
      expect(JSON.stringify(requests[1]!.body)).toContain(IMAGE);

      const nextProviderId = route.providerId === 'anthropic' ? 'openai' : 'anthropic';
      credentials.set(nextProviderId === 'openai' ? 'openai-codex' : nextProviderId, {
        type: 'api_key',
        key: 'next-tenant-key',
      });
      const nextGateway = new MastraCodeGateway({
        mastraGatewayBaseUrl: mock.url,
        routeThroughMastraGateway: false,
        credentialStore: credentials,
        customProviders: [],
      });
      const nextAgent = createAgent(
        nextGateway.resolveLanguageModel({
          providerId: nextProviderId,
          modelId: nextProviderId === 'openai' ? 'gpt-5.5' : 'claude-sonnet-4-6',
          apiKey: 'next-tenant-key',
        }),
      );
      const followUp = await run(
        [...prompt, ...result.response.messages, { role: 'user', content: 'Describe the same picture again.' }],
        nextAgent,
      );
      expect(followUp.text).toBe('I still have the picture.');
      expect(followUp.totalUsage).toMatchObject({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
      expect(JSON.stringify(sent[2]!.body)).toContain(IMAGE);
      expect(sent[2]!.headers.get(nextProviderId === 'anthropic' ? 'x-api-key' : 'authorization')).toBe(
        nextProviderId === 'anthropic' ? 'next-tenant-key' : 'Bearer next-tenant-key',
      );

      const headers = requests[0]!.headers;
      if (route.oauth) expect(headers.get('authorization')).toBe('Bearer tenant-token');
      else if (route.providerId === 'anthropic') expect(headers.get('x-api-key')).toBe('tenant-key');
      else if (route.providerId === 'google') expect(headers.get('x-goog-api-key')).toBe('tenant-key');
      else expect(headers.get('authorization')).toBe(`Bearer ${route.gateway ? 'organization-key' : 'tenant-key'}`);

      const body = requests[0]!.body;
      if (route.providerId === 'anthropic') {
        expect(body).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'high' } });
        expect(JSON.stringify(body)).toContain('"cache_control"');
      }
      if (route.providerId === 'openai' && (!route.gateway || route.oauth)) {
        expect(body).toMatchObject({ reasoning: { effort: 'high' }, prompt_cache_key: 'picture-thread' });
      }
      if (route.providerId === 'google') {
        expect(body).toMatchObject({ generationConfig: { thinkingConfig: { thinkingLevel: 'high' } } });
      }
    },
  );
});
