import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

describe('session signal context at run completion', () => {
  it.each(['user', 'notification'] as const)(
    'preserves controller and caller context when an active %s send reaches an idle runtime',
    async kind => {
      let finishFirst!: () => void;
      const firstFinished = new Promise<void>(resolve => {
        finishFirst = resolve;
      });
      let calls = 0;
      const contexts: RequestContext[] = [];
      const model = new MastraLanguageModelV2Mock({
        doStream: async () => ({
          stream: new ReadableStream({
            async start(controller) {
              const call = ++calls;
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text' });
              controller.enqueue({ type: 'text-delta', id: 'text', delta: 'done' });
              if (call === 1) await firstFinished;
              controller.enqueue({ type: 'text-end', id: 'text' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        }),
      });
      const agent = new Agent({
        id: 'context-race',
        name: 'Context race',
        instructions: 'Respond briefly.',
        model: ({ requestContext }) => {
          contexts.push(requestContext);
          if (!requestContext.get('controller')) throw new Error('No controller session context');
          return model;
        },
      });
      const storage = new InMemoryStore();
      new Mastra({ agents: { agent }, storage, logger: false });
      const controller = new AgentController({
        id: 'context-controller',
        workspace: createMockWorkspace(),
        storage,
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
      });
      await controller.init();
      const session = await controller.createSession({ id: 'context-session', ownerId: 'owner' });
      const first = session.sendMessage({ content: 'first' });
      try {
        await vi.waitFor(() => expect(calls).toBe(1));
        if (kind === 'user') {
          const ensureSubscription = session.thread.ensureSubscription.bind(session.thread);
          vi.spyOn(session.thread, 'ensureSubscription').mockImplementationOnce(async threadId => {
            finishFirst();
            await first;
            await ensureSubscription(threadId);
          });
        } else {
          const sendNotificationSignal = agent.sendNotificationSignal.bind(agent);
          vi.spyOn(agent, 'sendNotificationSignal').mockImplementationOnce(async (...args) => {
            finishFirst();
            await first;
            return sendNotificationSignal(...args);
          });
        }
        contexts.length = 0;
        const requestContext = new RequestContext();
        requestContext.set('caller', 'factory');
        if (kind === 'user') {
          await session.sendSignal({ content: 'second' }, { requestContext, requireDelivery: true }).accepted;
        } else {
          await session.sendNotificationSignal(
            { source: 'factory', kind: 'manual', priority: 'high', summary: 'second' },
            { requestContext },
          );
        }
        await vi.waitFor(() => expect(calls).toBe(2));
        await vi.waitFor(() => expect(session.run.isRunning()).toBe(false));
        const threadId = session.thread.requireId();
        await session.sendMessage({ content: 'third', requestContext });
        expect(calls).toBe(3);
        expect(session.thread.requireId()).toBe(threadId);
        expect(contexts.length).toBeGreaterThan(0);
        for (const context of contexts) {
          expect(context.get('controller')).toBeDefined();
          expect(context.get('caller')).toBe('factory');
        }
      } finally {
        finishFirst();
        await first;
        session.stream.detach();
      }
    },
    15_000,
  );
});
