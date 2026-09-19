import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { AgentController } from '../../../agent-controller';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

describe('Stop with native background tasks', () => {
  it.each([
    { enabled: false, resume: false },
    { enabled: true, resume: false },
    { enabled: true, resume: true },
  ])(
    'releases the stopped thread before its next message ($enabled, resumed: $resume)',
    async ({ enabled, resume }) => {
      const storage = new InMemoryStore();
      const memory = new MockMemory({ storage });
      const cache = new InMemoryServerCache();
      const pubsub = new EventEmitterPubSub();
      let calls = 0;
      let executions = 0;
      const partialIndex = resume ? 1 : 0;
      const model = new MockLanguageModelV2({
        doStream: async () => {
          const index = calls++;
          return {
            stream: new ReadableStream({
              start(c) {
                if (resume && index === 0) {
                  c.enqueue({ type: 'tool-call', toolCallId: 'approval-call', toolName: 'approved', input: '{}' });
                  c.enqueue({
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  c.close();
                  return;
                }
                c.enqueue({ type: 'text-start', id: 'reply' });
                c.enqueue({
                  type: 'text-delta',
                  id: 'reply',
                  delta: index === partialIndex ? 'Saved partial reply' : 'Fresh answer',
                });
                if (index > partialIndex) {
                  c.enqueue({ type: 'text-end', id: 'reply' });
                  c.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  c.close();
                }
              },
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          };
        },
      });
      const approved = createTool({
        id: 'approved',
        description: 'Approval test',
        inputSchema: z.object({}),
        execute: async () => {
          executions++;
          return 'Approved once';
        },
      });
      const agent = createDurableAgent({
        agent: new Agent({
          id: 'background-stop',
          name: 'Stop test',
          instructions: 'Reply.',
          model,
          memory,
          ...(resume ? { tools: { approved } } : {}),
        }),
        cache,
        pubsub,
      });
      const controller = new AgentController({
        id: 'controller',
        agent,
        storage,
        memory,
        pubsub,
        modes: [{ id: 'web', name: 'Web', default: true }],
      });
      const mastra = new Mastra({
        agents: { agent },
        agentControllers: { controller },
        storage,
        cache,
        pubsub,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
        backgroundTasks: { enabled },
      });
      const events: any[] = [];
      let unsubscribe: (() => void) | undefined;
      try {
        await controller.init();
        const resourceId = randomUUID(),
          threadId = randomUUID();
        const session = await controller.createSession({ resourceId, ownerId: resourceId, threadId });
        unsubscribe = session.subscribe(event => events.push(event));
        const first = session.sendMessage({ content: 'First instruction' });
        void first.catch(() => {});
        if (resume) {
          await expect.poll(() => session.displayState.get().pendingApproval?.toolCallId).toBe('approval-call');
          session.respondToToolApproval({ decision: 'approve' });
        }
        await expect
          .poll(() =>
            events.some(e => e.type === 'message_update' && JSON.stringify(e).includes('Saved partial reply')),
          )
          .toBe(true);
        session.abort();
        await first;
        await expect.poll(() => session.run.isRunning()).toBe(false);
        await expect
          .poll(() => controller.listActiveThreadRuns().filter(run => run.threadId === threadId), { timeout: 1500 })
          .toEqual([]);
        const saved = await session.thread.listActiveMessages({ limit: 100 });
        expect(JSON.stringify(saved)).toContain('Saved partial reply');
        unsubscribe();
        unsubscribe = session.subscribe(event => events.push(event));
        const second = session.sendMessage({ content: 'Next instruction' });
        void second.catch(() => {});
        await expect.poll(() => calls).toBe(partialIndex + 2);
        await second;
        await expect.poll(() => session.run.isRunning()).toBe(false);
        expect(controller.listActiveThreadRuns().filter(run => run.threadId === threadId)).toEqual([]);
        const finalMessages = await session.thread.listActiveMessages({ limit: 100 });
        for (const text of ['First instruction', 'Next instruction']) {
          expect(
            finalMessages.filter(message =>
              message.content.parts.some(part => part.type === 'text' && part.text === text),
            ),
          ).toHaveLength(1);
        }
        expect(JSON.stringify(finalMessages)).toContain('Fresh answer');
        expect(calls).toBe(partialIndex + 2);
        expect(executions).toBe(resume ? 1 : 0);
        expect(events.filter(e => e.type === 'agent_end').map(e => e.reason)).toEqual(['aborted', 'complete']);
      } finally {
        unsubscribe?.();
        await controller.destroy();
        await mastra.stopWorkers();
        await pubsub.close();
      }
    },
    15_000,
  );
});
