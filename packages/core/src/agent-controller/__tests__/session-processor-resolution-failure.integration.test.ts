import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import type { AgentControllerEvent } from '../types';

describe.each(['ordinary', 'durable', 'evented'] as const)('required processor resolution (%s)', execution => {
  it.each(['inputProcessors', 'outputProcessors', 'errorProcessors'] as const)(
    'fails before the model when %s cannot load and accepts a later healthy turn',
    async responsibility => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
      let broken = true;
      let resolutions = 0;
      let modelCalls = 0;
      const base = new Agent({
        id: randomUUID(),
        name: 'Required processors',
        instructions: 'Answer once.',
        [responsibility]: async () => {
          resolutions++;
          if (broken) throw new Error(`Required ${responsibility} unavailable`);
          return [];
        },
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            modelCalls++;
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'text-start', id: 'answer' });
                  controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'Healthy answer.' });
                  controller.enqueue({ type: 'text-end', id: 'answer' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  controller.close();
                },
              }),
            };
          },
        }),
      });
      const agent =
        execution === 'ordinary'
          ? base
          : execution === 'durable'
            ? createDurableAgent({ agent: base })
            : createEventedAgent({ agent: base });
      const storage = new InMemoryStore();
      const controller = new AgentController({
        id: randomUUID(),
        storage,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
      });
      const mastra = new Mastra({
        agents: { agent },
        agentControllers: { controller },
        storage,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      try {
        await controller.init();
        const session = await controller.createSession({ resourceId: randomUUID(), threadId: randomUUID() });
        const events: AgentControllerEvent[] = [];
        session.subscribe(event => events.push(event));
        let failure: unknown;
        await session.sendMessage({ content: 'Run the task.' }).catch(error => {
          failure = error;
        });
        expect(resolutions).toBeGreaterThan(0);
        expect(modelCalls).toBe(0);
        expect(session.run.isRunning()).toBe(false);
        expect(events.filter(event => event.type === 'agent_end').map(event => event.reason)).toEqual(['error']);
        expect(Boolean(failure) || events.some(event => event.type === 'error')).toBe(true);
        broken = false;
        events.length = 0;
        await session.sendMessage({ content: 'Run after the required checks are available.' });
        expect(modelCalls).toBe(1);
        expect(session.run.isRunning()).toBe(false);
        expect(events.filter(event => event.type === 'agent_end').map(event => event.reason)).toEqual(['complete']);
        expect(events.filter(event => event.type === 'error')).toHaveLength(0);
        expect(network).not.toHaveBeenCalled();
      } finally {
        await controller.destroy();
        await mastra.shutdown();
        network.mockRestore();
      }
    },
    15_000,
  );
});
