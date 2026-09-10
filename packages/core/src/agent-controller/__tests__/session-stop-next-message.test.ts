import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import type { AgentControllerEvent } from '../types';

describe('Session next message during abort teardown', () => {
  it.each(['sendMessage', 'steer', 'followUp', 'sendMessage-with-mode-switch'] as const)(
    'keeps the next %s run observable and returns to idle',
    async method => {
      const prompts: unknown[] = [];
      const sources: ReadableStreamDefaultController<any>[] = [];
      const events: AgentControllerEvent[] = [];
      const agent = new Agent({
        id: `stop-next-${method}`,
        name: 'Stop next message test',
        instructions: 'Reply briefly.',
        model: new MockLanguageModelV2({
          doStream: async ({ prompt }) => {
            const index = prompts.length;
            prompts.push(prompt);
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: new ReadableStream({
                start(source) {
                  sources[index] = source;
                  source.enqueue({ type: 'stream-start', warnings: [] });
                  source.enqueue({ type: 'text-start', id: `text-${index}` });
                  source.enqueue({ type: 'text-delta', id: `text-${index}`, delta: `Run ${index} waiting` });
                },
              }),
            };
          },
        }),
      });
      const controller = new AgentController({
        id: `stop-next-controller-${method}`,
        storage: new InMemoryStore(),
        modes: [
          { id: 'default', name: 'Default', default: true, agent },
          {
            id: 'other',
            name: 'Other',
            agent: new Agent({
              id: `other-${method}`,
              name: 'Other mode',
              instructions: 'Other mode.',
              model: new MockLanguageModelV2({
                doStream: async () => {
                  throw new Error('The already submitted message belongs to the original agent');
                },
              }),
            }),
          },
        ],
      });
      const subscribeOriginalAgent = vi.spyOn(agent, 'subscribeToThread');
      try {
        await controller.init();
        const session = await controller.createSession({ resourceId: `owner-${method}` });
        let modeSwitch: Promise<void> | undefined;
        session.subscribe(event => events.push(event));
        if (method === 'sendMessage-with-mode-switch') {
          // Control only scheduling at the awaited teardown boundary; keep the
          // real teardown, native mode switch, subscription and dispatch.
          const waitingSession = session as unknown as { waitForStreamIdle(): Promise<void> };
          const waitForIdle = waitingSession.waitForStreamIdle.bind(session);
          vi.spyOn(waitingSession, 'waitForStreamIdle').mockImplementation(async () => {
            await waitForIdle();
            modeSwitch = session.mode.switch({ modeId: 'other' });
            await modeSwitch;
          });
        }
        const first = session.sendMessage({ content: 'Hold the first instruction.' });
        void first.catch(() => {});
        await vi.waitFor(() => {
          expect(prompts).toHaveLength(1);
          expect(session.displayState.get().isRunning).toBe(true);
        });

        if (method !== 'steer') session.abort();
        const next = session[method === 'sendMessage-with-mode-switch' ? 'sendMessage' : method]({
          content: 'Handle the replacement instruction.',
        });
        void next.catch(() => {});
        await vi.waitFor(() => expect(prompts).toHaveLength(2));
        expect(JSON.stringify(prompts[1])).toContain('Handle the replacement instruction.');
        await vi.waitFor(() => {
          expect(events.filter(event => event.type === 'agent_start')).toHaveLength(2);
          expect(session.stream.activeRunId()).not.toBeNull();
          expect(session.displayState.get().isRunning).toBe(true);
        });

        sources[1]!.enqueue({ type: 'text-end', id: 'text-1' });
        sources[1]!.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
        sources[1]!.close();
        await Promise.all([first, next]);
        await vi.waitFor(() => {
          expect(events.filter(event => event.type === 'agent_end').map(event => event.reason)).toEqual([
            'aborted',
            'complete',
          ]);
          expect(session.run.isRunning()).toBe(false);
          expect(session.displayState.get().isRunning).toBe(false);
          expect(session.stream.activeRunId()).toBeNull();
          expect(controller.listActiveThreadRuns()).toHaveLength(0);
        });
        expect(prompts).toHaveLength(2);
        if (method === 'sendMessage-with-mode-switch') {
          await modeSwitch;
          expect(session.mode.get()).toBe('other');
          expect(subscribeOriginalAgent).toHaveBeenCalledTimes(2);
        }
      } finally {
        await controller.destroy();
      }
    },
    15_000,
  );
});
