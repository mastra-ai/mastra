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

describe('Session follow-ups behind parked and starting runs', () => {
  async function createIdleSession(id: string) {
    const { agent } = makeHeldRuns(id);
    // The drain dispatches through the agent's runtime queue when the thread
    // stream is open; the direct send path serves the first message only.
    const queueMessage = vi.spyOn(agent, 'queueMessage').mockImplementation(((message: any) => ({
      signal: { id: 'queued', type: 'user-message', contents: message.content },
      accepted: Promise.resolve({ action: 'deliver' as const, runId: 'queued-run' }),
    })) as any);
    const controller = new AgentController({
      id: `${id}-controller`,
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await controller.init();
    const session = await controller.createSession({ resourceId: `owner-${id}` });
    return { controller, session, queueMessage };
  }

  it('queues follow-ups while a tool suspension keeps the run parked, and drains only once it ends', async () => {
    const { controller, session, queueMessage } = await createIdleSession('follow-up-parked-suspension');
    try {
      const events: AgentControllerEvent[] = [];
      session.subscribe(event => events.push(event));
      const sendMessage = vi.spyOn(session, 'sendMessage').mockResolvedValue(undefined);
      session.emit({
        type: 'tool_suspended',
        toolCallId: 'call-generate',
        toolName: 'generate_image',
        args: {},
        suspendPayload: { prompt: 'a cat' },
      });
      expect(session.run.isRunning()).toBe(false);

      await session.followUp({ content: 'Then make it blue.' });
      await session.followUp({ content: 'Then add a hat.' });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(queueMessage).not.toHaveBeenCalled();
      expect(session.followUps.list().map(item => item.content)).toEqual(['Then make it blue.', 'Then add a hat.']);
      expect(events.filter(event => event.type === 'follow_up_queued')).toHaveLength(2);

      // The parked run is not over: nothing drains into it.
      await expect(session.drainFollowUpQueue()).resolves.toBe(false);
      expect(session.followUps.count()).toBe(2);

      // Once the suspension clears, the queue drains one message at a time.
      session.emit({ type: 'tool_suspension_cancelled', toolCallId: 'call-generate' });
      await expect(session.drainFollowUpQueue()).resolves.toBe(true);
      const dispatched = [...sendMessage.mock.calls, ...queueMessage.mock.calls].map(call => JSON.stringify(call[0]));
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toContain('Then make it blue.');
      expect(session.followUps.list().map(item => item.content)).toEqual(['Then add a hat.']);
    } finally {
      await controller.destroy();
    }
  });

  it('queues the second of two follow-ups sent to an idle session before the first has become a run', async () => {
    const { controller, session } = await createIdleSession('follow-up-rapid-idle');
    try {
      let releaseFirst!: () => void;
      const sendMessage = vi
        .spyOn(session, 'sendMessage')
        .mockImplementation(() => new Promise<void>(resolve => (releaseFirst = resolve)));

      const first = session.followUp({ content: 'First while idle.' });
      await session.followUp({ content: 'Second, right behind it.' });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'First while idle.' }));
      expect(session.followUps.list().map(item => item.content)).toEqual(['Second, right behind it.']);

      releaseFirst();
      await first;
      // With the first dispatch settled and nothing parked, an idle follow-up sends again.
      void session.followUp({ content: 'Third, after the first settled.' });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ content: 'Third, after the first settled.' }),
      );
      expect(session.followUps.list().map(item => item.content)).toEqual(['Second, right behind it.']);
    } finally {
      await controller.destroy();
    }
  });
});
