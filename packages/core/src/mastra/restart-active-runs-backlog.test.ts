/**
 * Recovery of evented runs whose restart sits in a worker backlog longer than
 * the run's liveness and grace period, so a second replica restarts the run
 * as well (#28712). Each step still runs once, and each run ends once. Leases
 * use a short TTL here, read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import type { Event } from '../events/types';
import { InMemoryStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { createStep, createWorkflow } from '../workflows/evented';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../workflows/run-ownership';
import { Mastra } from './index';

// Shorter than the backlog below, so the second replica finds the restarted runs stopped.
const GRACE_MS = 300;

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

/**
 * A pubsub whose broker accepts `workflow.start` events at once but delivers them `delayMs` later,
 * or never when `delayMs` is `'never'` (the worker that took them crashed and nothing redelivers).
 * Every run end it publishes is recorded in `ends`, and every late delivery in `delivered`, which
 * settles once the event was handed to the subscribers.
 */
function backloggedPubSub(delayMs: number | 'never', ends: string[]) {
  const inner = new EventEmitterPubSub();
  const delivered: Promise<void>[] = [];
  const pubsub: PubSub = new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic === 'workflows-finish' && event.type === 'workflow.end') {
            ends.push(event.runId);
          }

          if (topic !== 'workflows' || event.type !== 'workflow.start' || delayMs === 0) {
            return target.publish(topic, event, options);
          }

          if (delayMs !== 'never') {
            // The in-process emitter's publish does not reject, so the late delivery needs no handler.
            delivered.push(
              new Promise<void>(resolve => {
                setTimeout(() => resolve(target.publish(topic, event, options)), delayMs);
              }),
            );
          }
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { pubsub, delivered };
}

/** A replica whose `recovered-wf` steps record `<replica>:<step>:<runId>`. */
async function startReplica(storage: InMemoryStore, name: string, executions: string[], pubsub: PubSub) {
  const step = (id: string) =>
    createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ runId }) => {
        executions.push(`${name}:${id}:${runId}`);
        return {};
      },
    });
  const workflow = createWorkflow({ id: 'recovered-wf', inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(step('first'))
    .then(step('second'))
    .commit();
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    workflows: { 'recovered-wf': workflow },
    recovery: { workflowGraceMs: GRACE_MS },
  });
  await mastra.startWorkers();
  replicas.push(mastra);
  return mastra;
}

/** Stores a `running` run of `recovered-wf` that stopped before its first step, as a crash long ago leaves it. */
async function persistActiveRun(storage: InMemoryStore, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({
    workflowName: 'recovered-wf',
    runId,
    snapshot: {
      ...createEmptyWorkflowSnapshot(runId),
      status: 'running',
      activePaths: [],
      context: { input: {} } as any,
    },
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('recovery of evented runs behind a worker backlog (#28712)', () => {
  it('runs each step once and ends each run once when a second replica restarts the runs during the backlog', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const runIds = ['orphaned-a', 'orphaned-b', 'orphaned-c'];
    for (const runId of runIds) {
      await persistActiveRun(storage, runId);
    }

    // The runs stopped longer ago than the grace period.
    await sleep(GRACE_MS);
    const executions: string[] = [];
    const ends: string[] = [];
    // B's workers only get to the restarts three lease TTLs after B published them.
    const backlog = backloggedPubSub(WORKFLOW_RUN_LEASE_TTL_MS * 3, ends);
    const b = await startReplica(storage, 'B', executions, backlog.pubsub);
    await b.restartAllActiveWorkflowRuns();

    // C boots once the liveness B wrote at its restarts lapsed and the grace period passed, before B's workers start.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + GRACE_MS * 1.5);
    const c = await startReplica(storage, 'C', executions, backloggedPubSub(0, ends).pubsub);
    const restarted = vi.spyOn(c.getWorkflow('recovered-wf'), 'createRun');
    await c.restartAllActiveWorkflowRuns();
    expect(restarted).toHaveBeenCalledTimes(runIds.length);

    await vi.waitFor(
      async () => {
        const { runs } = await store.listWorkflowRuns({ workflowName: 'recovered-wf', status: 'success' });
        expect(runs).toHaveLength(runIds.length);
      },
      { timeout: 10_000 },
    );
    // B's queued restarts arrive after C finished the runs. Stopping B's workers waits for their handlers. If the
    // step leases or the finished-step check regress, a queued restart runs the steps a second time.
    expect(backlog.delivered).toHaveLength(runIds.length);
    await Promise.all(backlog.delivered);
    await backlog.pubsub.flush();
    await b.stopWorkers();

    for (const runId of runIds) {
      const steps = executions.filter(execution => execution.endsWith(`:${runId}`)).map(e => e.split(':')[1]);
      expect(steps).toEqual(['first', 'second']);
    }
    expect([...ends].sort()).toEqual([...runIds].sort());
  }, 20_000);

  it('restarts a run again once the liveness its lost restart wrote lapsed and the grace period passed', async () => {
    const storage = new InMemoryStore();
    await persistActiveRun(storage, 'orphaned');
    await sleep(GRACE_MS);
    const executions: string[] = [];
    // B's restart never reaches a worker.
    const b = await startReplica(storage, 'B', executions, backloggedPubSub('never', []).pubsub);
    await b.restartAllActiveWorkflowRuns();

    // Until then the restart counts as live, so C leaves the run alone.
    const c = await startReplica(storage, 'C', executions, backloggedPubSub(0, []).pubsub);
    await c.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + GRACE_MS * 1.5);
    await c.restartAllActiveWorkflowRuns();
    await vi.waitFor(() => expect(executions).toEqual(['C:first:orphaned', 'C:second:orphaned']));
  }, 20_000);
});
