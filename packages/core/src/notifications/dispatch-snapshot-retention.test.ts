/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/20254
 *
 * `__mastra_notification_dispatcher` runs once a minute and is never resumed,
 * so its snapshot has no consumer. Before this fix every tick left a row in
 * `mastra_workflow_snapshot` forever (a user reported 41,127 dead rows).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { NOTIFICATION_DISPATCH_WORKFLOW_ID, createNotificationDispatchWorkflow } from './workflow';

const activeInstances: Mastra[] = [];
function track(mastra: Mastra): Mastra {
  activeInstances.push(mastra);
  return mastra;
}
afterEach(async () => {
  const instances = activeInstances.splice(0, activeInstances.length);
  await Promise.all(instances.map(m => m.shutdown().catch(() => {})));
});

async function countDispatcherSnapshots(storage: InMemoryStore): Promise<number> {
  const workflowsStore = (await storage.getStore('workflows'))!;
  const { total } = await workflowsStore.listWorkflowRuns({ workflowName: NOTIFICATION_DISPATCH_WORKFLOW_ID });
  return total;
}

describe('notification dispatcher snapshot retention (#20254)', () => {
  it('leaves no snapshot row behind after a successful dispatcher run', async () => {
    const storage = new InMemoryStore();
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        pubsub: new EventEmitterPubSub(),
      }),
    );
    await mastra.startWorkers();

    // Mastra auto-registers the dispatcher workflow (hidden from getWorkflows()).
    const workflow = mastra.getWorkflow(NOTIFICATION_DISPATCH_WORKFLOW_ID as never) as ReturnType<
      typeof createNotificationDispatchWorkflow
    >;

    // Simulate several scheduler ticks.
    for (let i = 0; i < 5; i++) {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { limit: 10 } });
      expect(result.status).toBe('success');
    }

    // Snapshot cardinality must stay bounded — the reported bug grew it by one
    // row per tick, indefinitely.
    expect(await countDispatcherSnapshots(storage)).toBe(0);
  }, 30_000);

  it('leaves no snapshot row behind after a failed dispatcher run', async () => {
    const storage = new InMemoryStore();
    const mastra = track(
      new Mastra({
        logger: false,
        storage,
        pubsub: new EventEmitterPubSub(),
      }),
    );
    await mastra.startWorkers();

    const workflow = mastra.getWorkflow(NOTIFICATION_DISPATCH_WORKFLOW_ID as never) as ReturnType<
      typeof createNotificationDispatchWorkflow
    >;

    // An unparseable `now` makes the dispatch step throw, failing the run.
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { now: 'not-a-date', limit: 10 } });
    expect(result.status).toBe('failed');

    // A failed tick is no more resumable than a successful one, so it must not
    // leave a row behind either.
    expect(await countDispatcherSnapshots(storage)).toBe(0);
  }, 30_000);
});
