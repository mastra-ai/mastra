/**
 * A replica that restarts orphaned evented runs keeps them while its workers
 * work through a backlog longer than one lease TTL, so a second replica that
 * boots meanwhile does not restart them again (#28712). Leases use a short TTL
 * here, read when core loads.
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
import { restartLeaseKey } from '../workflows/evented/leases';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../workflows/run-ownership';
import { Mastra } from './index';

const replicas: Mastra[] = [];
afterEach(async () => {
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

/**
 * A pubsub whose broker accepts `workflow.start` events at once but delivers them `delayMs` later,
 * or never when `delayMs` is `'never'` (the worker that took them crashed and nothing redelivers).
 */
function backloggedPubSub(delayMs: number | 'never'): PubSub {
  const inner = new EventEmitterPubSub();
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic !== 'workflows' || event.type !== 'workflow.start') return target.publish(topic, event, options);
          if (delayMs !== 'never') setTimeout(() => void target.publish(topic, event, options), delayMs);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** A replica whose `recovered-wf` step records `<replica>:<runId>`. */
async function startReplica(storage: InMemoryStore, name: string, executions: string[], pubsub?: PubSub) {
  const workflow = createWorkflow({ id: 'recovered-wf', inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(
      createStep({
        id: 'work',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ runId }) => {
          executions.push(`${name}:${runId}`);
          return {};
        },
      }),
    )
    .commit();
  const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { 'recovered-wf': workflow } });
  await mastra.startWorkers();
  replicas.push(mastra);
  return mastra;
}

/** Stores a `running` run of `recovered-wf` that stopped before its first step, as a crash leaves it. */
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

describe('boot-time recovery of evented runs behind a worker backlog (#28712)', () => {
  it('runs each step once, on the replica that restarted it, when a second replica boots during the backlog', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const runIds = ['orphaned-a', 'orphaned-b', 'orphaned-c', 'orphaned-d'];
    for (const runId of runIds) await persistActiveRun(storage, runId);
    const executions: string[] = [];
    // B's workers only get to the restarts three lease TTLs after B published them.
    const b = await startReplica(storage, 'B', executions, backloggedPubSub(WORKFLOW_RUN_LEASE_TTL_MS * 3));
    await b.restartAllActiveWorkflowRuns();

    // C boots once the `restart()` leases B took would have lapsed, before B's workers start.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS * 1.5);
    const c = await startReplica(storage, 'C', executions);
    await c.restartAllActiveWorkflowRuns();

    await vi.waitFor(
      async () => {
        const { runs } = await store.listWorkflowRuns({ workflowName: 'recovered-wf', status: 'success' });
        expect(runs).toHaveLength(runIds.length);
      },
      { timeout: 10_000 },
    );
    expect([...executions].sort()).toEqual(runIds.map(runId => `B:${runId}`).sort());
  }, 20_000);

  it('lets another replica recover a restart whose worker never started it, once the hold runs out', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    await persistActiveRun(storage, 'orphaned');
    const executions: string[] = [];
    const b = await startReplica(storage, 'B', executions, backloggedPubSub('never'));
    await b.restartAllActiveWorkflowRuns();
    const restartLease = async () => (await store.getRunOwnership({ runId: restartLeaseKey('orphaned') }))?.live;

    // B keeps its restart lease past one TTL while it waits for a worker.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS * 1.5);
    expect(await restartLease()).toBe(true);

    // No worker ever marks the run live, so B stops renewing and the lease lapses.
    await vi.waitFor(async () => expect(await restartLease()).toBe(false), { timeout: 10_000, interval: 100 });
    const c = await startReplica(storage, 'C', executions);
    await c.restartAllActiveWorkflowRuns();
    await vi.waitFor(() => expect(executions).toEqual(['C:orphaned']));
  }, 20_000);
});
