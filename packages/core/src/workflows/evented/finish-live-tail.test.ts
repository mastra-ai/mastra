/**
 * Persistent pubsubs (redis-streams, valkey-streams) replay retained events to a
 * subscriber that starts from `'earliest'`. The evented engine waits for a run's
 * result on `workflows-finish`, so it must live-tail that topic: otherwise
 * `resume()` reads the run's own earlier `workflow.suspend` event and resolves
 * with the stale suspended result. See issue #26247.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event, EventCallback, SubscribeOptions } from '../../events/types';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

/** EventEmitterPubSub that replays retained history unless `startFrom: 'latest'`. */
class ReplayingPubSub extends EventEmitterPubSub {
  history = new Map<string, Event[]>();

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    const list = this.history.get(topic) ?? [];
    list.push({ ...event, id: `${topic}-${list.length}`, createdAt: new Date() } as Event);
    this.history.set(topic, list);
    return super.publish(topic, event, options);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
    if (options?.startFrom !== 'latest') {
      for (const event of [...(this.history.get(topic) ?? [])]) {
        await cb(event);
      }
    }
    return super.subscribe(topic, cb, options);
  }
}

describe('evented workflows-finish subscription', () => {
  it('resume() returns the resumed result when the pubsub retains finish events', async () => {
    const approval = createStep({
      id: 'approval',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), approvedBy: z.string() }),
      resumeSchema: z.object({ approvedBy: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({});
          return { item: inputData.item, approvedBy: '' };
        }
        return { item: inputData.item, approvedBy: resumeData.approvedBy };
      },
    });

    const workflow = createWorkflow({
      id: 'finish-live-tail',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), approvedBy: z.string() }),
    })
      .then(approval)
      .commit();

    const pubsub = new ReplayingPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub,
      workflows: { [workflow.id]: workflow },
    });
    await mastra.startWorkers();

    try {
      const run = await workflow.createRun();
      const started = await run.start({ inputData: { item: 'widget' } });
      expect(started.status).toBe('suspended');

      const resumed = await run.resume({ step: approval, resumeData: { approvedBy: 'reviewer' } });
      expect(resumed.status).toBe('success');
      expect((resumed as any).result).toEqual({ item: 'widget', approvedBy: 'reviewer' });
    } finally {
      await mastra.stopWorkers();
    }
  });
});
