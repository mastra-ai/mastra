/**
 * End-to-end proof for #30391.
 *
 * The bug report configures a local `Memory({ observationalMemory: true })` on an
 * agent whose model is `mastra/<provider>/<model>`, sends two turns on one thread,
 * and ends up with nothing in storage and an agent that forgets the first turn.
 *
 * These tests reproduce that setup with the real pieces: a real
 * `ModelRouterLanguageModel` routed through a real gateway auth resolution, a real
 * `Memory` with the real Observational Memory processor chain, and real in-memory
 * persistence. Only the model call itself is stubbed.
 *
 * The gateway serves Observational Memory for a Gateway project key, so neither the
 * local storage nor the gateway may double up. A Gateway organization key is served
 * by a gateway without the memory API, so memory has to stay local.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraModelGatewayInterface, ProviderConfig } from '@mastra/core/llm';
import { ModelRouterLanguageModel } from '@mastra/core/llm';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from './index';

const threadId = 'gateway-thread';
const resourceId = 'gateway-resource';

/** The stub model, plus every prompt the agent sent it. */
function createActorModel() {
  const prompts: unknown[][] = [];
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(prompt as unknown[]);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: 'text' as const, text: 'ok' }],
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

/** A `mastra` gateway that authenticates with the given key and serves every model from the stub. */
function createMastraGateway(apiKey: string, model: MockLanguageModelV2): MastraModelGatewayInterface {
  return {
    id: 'mastra',
    name: 'Gateway',
    fetchProviders: async (): Promise<Record<string, ProviderConfig>> => ({}),
    buildUrl: () => undefined,
    getApiKey: async () => apiKey,
    resolveLanguageModel: () => model,
  };
}

function createGatewayAgent(apiKey: string, model: MockLanguageModelV2) {
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        model: 'test-model',
        // High enough that neither turn triggers an observation run.
        observation: { messageTokens: 100_000 },
        reflection: { observationTokens: 100_000 },
      },
    },
  });

  const agent = new Agent({
    id: 'gateway-memory-agent',
    name: 'Gateway memory agent',
    instructions: 'Answer the question.',
    model: new ModelRouterLanguageModel('mastra/openai/gpt-4o', [createMastraGateway(apiKey, model)]),
    memory,
  });

  return { agent, memory };
}

describe('local memory for a gateway model (#30391)', () => {
  it('persists and recalls a turn when the gateway has no memory API', async () => {
    const { model, prompts } = createActorModel();
    const { agent, memory } = createGatewayAgent('mskv2_current', model);
    const gateway = new ModelRouterLanguageModel('mastra/openai/gpt-4o', [createMastraGateway('mskv2_current', model)]);

    // The real router resolves the real credential for the model the agent runs.
    expect(gateway.gatewayId).toBe('mastra');
    expect(await gateway.isGatewayMemoryManaged()).toBe(false);

    await agent.generate('Remember the word PELICAN', { memory: { thread: threadId, resource: resourceId } });

    const store = await memory.storage.getStore('memory');
    const stored = await store!.listMessages({ threadId, resourceId, perPage: false });
    expect(stored.messages.map(message => JSON.stringify(message.content))).toEqual(
      expect.arrayContaining([expect.stringContaining('PELICAN')]),
    );

    // Both halves of the turn are stored: the user message and the model's reply. A
    // regression that saves only one side of the pair fails on these assertions.
    const assistantMessages = stored.messages.filter(message => message.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(JSON.stringify(assistantMessages[0]!.content)).toContain('ok');

    const recalled = await memory.recall({ threadId, resourceId, perPage: false });
    expect(recalled.messages.map(message => JSON.stringify(message.content))).toEqual(
      expect.arrayContaining([expect.stringContaining('PELICAN')]),
    );

    await agent.generate('What word did I ask you to remember?', {
      memory: { thread: threadId, resource: resourceId },
    });

    // The second turn is sent with the first turn in context, which is what the
    // report was missing: the agent forgot every earlier turn.
    expect(JSON.stringify(prompts.at(-1))).toContain('PELICAN');
  });

  it('leaves memory on the gateway, with no local write, for a project key', async () => {
    const { model } = createActorModel();
    const { agent, memory } = createGatewayAgent('msk_live_project_key', model);

    await agent.generate('Remember the word PELICAN', { memory: { thread: threadId, resource: resourceId } });

    const store = await memory.storage.getStore('memory');
    const stored = await store!.listMessages({ threadId, resourceId, perPage: false });
    expect(stored.messages).toHaveLength(0);
  });
});
