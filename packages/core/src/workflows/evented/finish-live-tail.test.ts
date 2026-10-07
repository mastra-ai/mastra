/**
 * The evented engine awaits a run's result on the `workflows-finish` topic.
 * On a persistent transport (e.g. `@mastra/redis-streams`) a subscription
 * created with the default `startFrom: 'earliest'` replays every retained
 * finish event first, so each awaited run re-reads the whole finish stream and
 * a resume can resolve with the run's own earlier `workflow.suspend` event.
 *
 * `FinishHistoryPubSub` retains `workflows-finish` events and replays them to
 * ungrouped subscribers that don't ask for `startFrom: 'latest'`, the way a
 * persistent transport does.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Event, EventCallback, SubscribeOptions } from '../../events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

class FinishHistoryPubSub extends EventEmitterPubSub {
  readonly finishHistory: Event[] = [];
  replayed = 0;

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic === 'workflows-finish') {
      this.finishHistory.push({ ...event, id: crypto.randomUUID(), createdAt: new Date() } as Event);
    }
    await super.publish(topic, event, options);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
    await super.subscribe(topic, cb, options);
    if (topic !== 'workflows-finish' || options?.group || options?.startFrom === 'latest') return;
    for (const event of [...this.finishHistory]) {
      this.replayed += 1;
      await cb(event, async () => {});
    }
  }
}

function createApprovalWorkflow() {
  const pubsub = new FinishHistoryPubSub();

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
    id: 'evented-finish-live-tail',
    inputSchema: z.object({ item: z.string() }),
    outputSchema: z.object({ item: z.string(), approvedBy: z.string() }),
    steps: [approval],
  })
    .then(approval)
    .commit();

  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    pubsub,
    workflows: { [workflow.id]: workflow },
  });

  return { approval, mastra, pubsub, workflow };
}

describe('evented workflows-finish subscription', () => {
  it('does not replay finish events published before the run subscribed', async () => {
    const { mastra, pubsub, workflow } = createApprovalWorkflow();

    for (let i = 0; i < 200; i++) {
      await pubsub.publish('workflows-finish', {
        type: 'workflow.end',
        runId: `old-run-${i}`,
        data: { workflowId: workflow.id, runId: `old-run-${i}`, stepResults: {} },
      });
    }

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { item: 'widget' } });

      expect(result.status).toBe('suspended');
      expect(pubsub.replayed).toBe(0);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('resolves resume() with the resumed result, not the earlier suspend', async () => {
    const { approval, mastra, workflow } = createApprovalWorkflow();

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const startResult = await run.start({ inputData: { item: 'widget' } });
      expect(startResult.status).toBe('suspended');

      const resumeResult = await run.resume({ step: approval, resumeData: { approvedBy: 'reviewer' } });

      expect(resumeResult.status).toBe('success');
      expect((resumeResult as any).result).toEqual({ item: 'widget', approvedBy: 'reviewer' });
    } finally {
      await mastra.stopWorkers();
    }
  });
});
