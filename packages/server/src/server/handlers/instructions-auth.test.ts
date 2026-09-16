import { openai } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { LanguageModel, MastraModelGatewayInterface } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENHANCE_INSTRUCTIONS_ROUTE } from './agents';
import { createTestServerContext } from './test-utils';

const oauthGateway: MastraModelGatewayInterface = {
  id: 'oauth',
  name: 'OAuth',
  handlesModel: modelId => modelId.startsWith('openai/'),
  resolveAuth: () => ({ bearerToken: 'oauth-token' }),
  fetchProviders: async () => ({}),
  buildUrl: () => undefined,
  getApiKey: async () => '',
  resolveLanguageModel: () => openai('gpt-4.1'),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('instructions enhancer authentication', () => {
  it('skips an SDK instance without its own key and preserves the authenticated fallback', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    const agent = new Agent({
      id: 'agent',
      name: 'Agent',
      instructions: 'Help the user.',
      model: [{ model: openai('gpt-4.1') }, { model: 'anthropic/claude-sonnet-4-5' }],
    });
    const mastra = new Mastra({ agents: { agent }, gateways: { oauth: oauthGateway }, logger: false });
    let selectedModel: LanguageModel | undefined;
    vi.spyOn(Agent.prototype, 'generate').mockImplementation(async function (this: Agent) {
      selectedModel = await this.getModel();
      throw new Error('Generation intercepted');
    });

    await expect(
      ENHANCE_INSTRUCTIONS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'agent',
        instructions: 'Help the user.',
      }),
    ).rejects.toThrow('Generation intercepted');
    expect(selectedModel?.provider).toBe('anthropic');
  });

  it('keeps the router instance that owns gateway authentication', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const model = new ModelRouterLanguageModel('openai/gpt-4.1', [oauthGateway]);
    const agent = new Agent({ id: 'agent', name: 'Agent', instructions: 'Help the user.', model });
    const mastra = new Mastra({ agents: { agent }, gateways: { oauth: oauthGateway }, logger: false });
    let selectedModel: LanguageModel | undefined;
    vi.spyOn(Agent.prototype, 'generate').mockImplementation(async function (this: Agent) {
      selectedModel = await this.getModel();
      throw new Error('Generation intercepted');
    });

    await expect(
      ENHANCE_INSTRUCTIONS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'agent',
        instructions: 'Help the user.',
      }),
    ).rejects.toThrow('Generation intercepted');
    expect(selectedModel).toBe(model);
  });
});
