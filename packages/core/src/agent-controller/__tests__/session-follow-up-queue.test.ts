import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import type { AgentControllerEvent } from '../types';

/** A model whose runs stay open until the test closes their stream. */
function makeHeldRuns(id: string) {
  const prompts: unknown[] = [];
  const sources: ReadableStreamDefaultController<any>[] = [];
  const agent = new Agent({
    id,
    name: 'Follow-up queue test',
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
  const finish = (index: number) => {
    sources[index]!.enqueue({ type: 'text-end', id: `text-${index}` });
    sources[index]!.enqueue({
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
    sources[index]!.close();
  };
  return { agent, prompts, finish };
}

describe('Session follow-up queue items', () => {
  it('lists queued follow-ups with ids, removes one by id, and drains the rest in order', async () => {
    const { agent, prompts, finish } = makeHeldRuns('follow-up-queue-items');
    const controller = new AgentController({
      id: 'follow-up-queue-items-controller',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    try {
      await controller.init();
      const session = await controller.createSession({ resourceId: 'owner-queue' });
      const events: AgentControllerEvent[] = [];
      session.subscribe(event => events.push(event));

      const first = session.sendMessage({ content: 'Hold the first instruction.' });
      void first.catch(() => {});
      await vi.waitFor(() => {
        expect(prompts).toHaveLength(1);
        expect(session.displayState.get().isRunning).toBe(true);
      });

      await session.followUp({ content: 'Then check the tests.' });
      await session.followUp({ content: 'Then write the summary.' });
      const queued = session.displayState.get();
      expect(queued.queuedFollowUps).toBe(2);
      expect(queued.queuedFollowUpItems.map(item => item.content)).toEqual([
        'Then check the tests.',
        'Then write the summary.',
      ]);
      const [firstItem, secondItem] = queued.queuedFollowUpItems;
      expect(firstItem!.id).toBeTruthy();
      expect(secondItem!.id).not.toBe(firstItem!.id);

      // Remove one by id: the count and the items move together, once.
      expect(session.removeFollowUp({ id: firstItem!.id })).toBe(true);
      expect(session.removeFollowUp({ id: firstItem!.id })).toBe(false);
      const afterRemove = session.displayState.get();
      expect(afterRemove.queuedFollowUps).toBe(1);
      expect(afterRemove.queuedFollowUpItems).toEqual([secondItem]);
      const queuedEvents = events.filter(event => event.type === 'follow_up_queued');
      expect(queuedEvents.at(-1)).toMatchObject({ count: 1, items: [secondItem] });

      // The run ends: the remaining follow-up drains into the next run and leaves the list.
      finish(0);
      await first;
      await vi.waitFor(() => expect(prompts).toHaveLength(2));
      expect(JSON.stringify(prompts[1])).toContain('Then write the summary.');
      await vi.waitFor(() => {
        const drained = session.displayState.get();
        expect(drained.queuedFollowUps).toBe(0);
        expect(drained.queuedFollowUpItems).toEqual([]);
      });

      finish(1);
      await vi.waitFor(() => {
        expect(session.displayState.get().isRunning).toBe(false);
        expect(controller.listActiveThreadRuns()).toHaveLength(0);
      });
    } finally {
      await controller.destroy();
    }
  }, 15_000);

  it('steer drops every queued follow-up and reports an empty list', async () => {
    const { agent, prompts, finish } = makeHeldRuns('follow-up-queue-steer');
    const controller = new AgentController({
      id: 'follow-up-queue-steer-controller',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    try {
      await controller.init();
      const session = await controller.createSession({ resourceId: 'owner-steer' });
      const first = session.sendMessage({ content: 'Hold the first instruction.' });
      void first.catch(() => {});
      await vi.waitFor(() => expect(session.displayState.get().isRunning).toBe(true));
      await session.followUp({ content: 'Queued behind the run.' });
      expect(session.displayState.get().queuedFollowUpItems).toHaveLength(1);

      const steered = session.steer({ content: 'Change course now.' });
      void steered.catch(() => {});
      await vi.waitFor(() => expect(prompts).toHaveLength(2));
      expect(session.displayState.get().queuedFollowUps).toBe(0);
      expect(session.displayState.get().queuedFollowUpItems).toEqual([]);

      finish(1);
      await Promise.all([first, steered]);
      await vi.waitFor(() => expect(session.displayState.get().isRunning).toBe(false));
    } finally {
      await controller.destroy();
    }
  }, 15_000);
});
