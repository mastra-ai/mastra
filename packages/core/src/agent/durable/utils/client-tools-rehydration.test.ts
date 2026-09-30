import { openai } from '@ai-sdk/openai-v6';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra, resolveRuntimeDependencies } from './resolve-runtime';
import { serializeToolMetadata } from './serialize-state';

describe('call-time client tools on a fresh durable worker', () => {
  const pubsub = new EventEmitterPubSub();

  afterAll(async () => {
    await pubsub.close();
  });

  afterEach(() => {
    globalRunRegistry.clear();
  });

  it.each(['llm', 'tool-call'] as const)(
    'rehydrates tools for the %s step from JSON without caller registry state',
    async step => {
      const execute = vi.fn();
      const agent = new Agent({
        id: 'client-tools-worker',
        name: 'Client tools worker',
        model: new MockLanguageModelV2(),
        tools: {
          registered: createTool({
            id: 'registered',
            description: 'A registered tool',
            inputSchema: z.object({}),
            execute: async () => 'registered',
          }),
        },
      });
      const mastra = new Mastra({ agents: { agent } });
      const durable = createDurableAgent({ agent, pubsub });
      const prepared = await durable.prepare('Look up the weather', {
        clientTools: {
          provider_search: openai.tools.webSearch({ searchContextSize: 'low' }),
          lookup_weather: createTool({
            id: 'weather-tool',
            description: 'Look up weather on the client',
            inputSchema: z.object({ city: z.string() }),
            outputSchema: z.object({ temperature: z.number() }),
            execute,
          }),
        },
      });

      // A separate process receives only JSON; it cannot access the caller's tools.
      const input = JSON.parse(JSON.stringify(prepared.workflowInput));
      globalRunRegistry.clear();
      const rebuilt =
        step === 'llm'
          ? await resolveRuntimeDependencies({ mastra, runId: prepared.runId, agentId: agent.id, input })
          : await rebuildRunToolsFromMastra({
              mastra,
              runId: prepared.runId,
              agentId: agent.id,
              state: input.state,
              options: input.options,
            });

      expect(rebuilt?.tools.registered).toBeDefined();
      expect(rebuilt?.tools.provider_search).toMatchObject({
        type: 'provider-defined',
        id: 'openai.web_search',
      });
      const clientTool = rebuilt?.tools.lookup_weather;
      expect(clientTool).toBeDefined();
      expect(serializeToolMetadata('lookup_weather', clientTool!).inputSchema).toMatchObject({
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      });
      expect(clientTool?.description).toBe('Look up weather on the client');
      expect(clientTool?.execute).toBeUndefined();
      expect(input.options.clientTools.lookup_weather.outputSchema).toMatchObject({
        properties: { temperature: { type: 'number' } },
        required: ['temperature'],
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
