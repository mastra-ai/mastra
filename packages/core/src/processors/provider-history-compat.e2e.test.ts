/**
 * E2E test: verify real Anthropic requests tolerate reasoning history from
 * another provider because ProviderHistoryCompat strips those parts at the
 * provider boundary.
 */
import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createGatewayMock } from '@internal/test-utils';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { config } from 'dotenv';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { ProviderHistoryCompat } from './provider-history-compat';

config();

const requestBodies: any[] = [];
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? 'test-openrouter-api-key',
});
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? 'test-anthropic-api-key',
  fetch: async (input, init) => {
    if (init?.body && String(input).includes('/messages')) {
      requestBodies.push(JSON.parse(String(init.body)));
    }
    return fetch(input, init);
  },
});
const reasoningModel = openrouter('minimax/minimax-m2.5', {
  reasoning: { effort: 'low', exclude: false },
});
const anthropicModel = anthropic('claude-haiku-4-5-20251001');
const mock = createGatewayMock({
  name: 'core-src-processors-provider-history-compat-native-anthropic-foreign-reasoning.e2e',
  exactMatch: true,
});

beforeAll(() => mock.start());
beforeEach(() => {
  requestBodies.length = 0;
});
afterAll(() => mock.saveAndStop());

describe('ProviderHistoryCompat Anthropic reasoning E2E', { timeout: 60_000 }, () => {
  it('strips real foreign reasoning history before a real native Anthropic request', async () => {
    const reasoningAgent = new Agent({
      id: 'minimax-reasoning-e2e-agent',
      name: 'MiniMax Reasoning E2E Agent',
      instructions: 'Answer briefly, but use reasoning if available.',
      model: reasoningModel,
    });
    const anthropicAgent = new Agent({
      id: 'anthropic-foreign-reasoning-e2e-agent',
      name: 'Anthropic Foreign Reasoning E2E Agent',
      instructions: 'Reply exactly as requested.',
      model: anthropicModel,
      inputProcessors: [new ProviderHistoryCompat()],
    });

    const firstUserMessage = { role: 'user' as const, content: 'What is 19 * 23? Reply with one sentence.' };
    const firstResult = await reasoningAgent.generate([firstUserMessage], {
      maxSteps: 1,
    });
    const responseMessages = firstResult.response.messages ?? [];
    const assistantMessage = responseMessages.find(message => message.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    expect(JSON.stringify(assistantMessage)).toContain('reasoning');

    const result = await anthropicAgent.generate(
      [firstUserMessage, assistantMessage!, { role: 'user' as const, content: 'Reply with only: OK' }],
      {
        maxSteps: 1,
      },
    );

    const anthropicRequest = requestBodies.find(body => body.model === 'claude-haiku-4-5-20251001');
    const anthropicAssistantMessage = anthropicRequest?.messages.find(
      (message: { role?: string }) => message.role === 'assistant',
    );
    expect(anthropicAssistantMessage).toEqual(
      expect.objectContaining({
        role: 'assistant',
        content: [{ type: 'text', text: firstResult.text }],
      }),
    );
    expect(anthropicAssistantMessage.content).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'thinking' })]),
    );
    expect(anthropicAssistantMessage).not.toHaveProperty('reasoning');
    expect(result.text.trim()).toBeTruthy();
  });

  it('retains real Anthropic reasoning history before a later native Anthropic request', async () => {
    const anthropicAgent = new Agent({
      id: 'anthropic-native-reasoning-e2e-agent',
      name: 'Anthropic Native Reasoning E2E Agent',
      instructions: 'Reply exactly as requested.',
      model: anthropicModel,
      inputProcessors: [new ProviderHistoryCompat()],
    });
    const providerOptions = {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 1024 },
        sendReasoning: true,
      },
    } as const;

    const firstUserMessage = { role: 'user' as const, content: 'What is 17 * 29? Reply with one sentence.' };
    const firstResult = await anthropicAgent.generate([firstUserMessage], {
      maxSteps: 1,
      modelSettings: { maxOutputTokens: 1200 },
      providerOptions,
    });
    const responseMessages = firstResult.response.messages ?? [];
    const assistantMessage = responseMessages.find(message => message.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    expect(JSON.stringify(assistantMessage)).toContain('reasoning');
    expect(JSON.stringify(assistantMessage)).toContain('anthropic');

    const result = await anthropicAgent.generate(
      [firstUserMessage, assistantMessage!, { role: 'user' as const, content: 'Reply with only: OK' }],
      {
        maxSteps: 1,
        modelSettings: { maxOutputTokens: 1200 },
        providerOptions,
      },
    );

    const anthropicRequests = requestBodies.filter(body => body.model === 'claude-haiku-4-5-20251001');
    const secondAnthropicRequest = anthropicRequests.at(-1);
    const retainedAssistantMessage = secondAnthropicRequest?.messages.find(
      (message: { role?: string }) => message.role === 'assistant',
    );
    expect(retainedAssistantMessage?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'thinking' }),
        expect.objectContaining({ type: 'text', text: firstResult.text }),
      ]),
    );
    expect(result.text.trim()).toBeTruthy();
  });
});
