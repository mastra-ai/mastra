/**
 * Recovery of an evented run whose restart never reaches a worker (#28712):
 * another replica restarts it once the liveness the lost restart wrote lapsed
 * and the grace period passed. Leases use a short TTL here, read when core loads.
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

const GRACE_MS = 300;

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

/**
 * A pubsub whose broker accepts `workflow.start` events and never delivers them, as when the
 * worker that took them crashed and nothing redelivers.
 */
function lostStartsPubSub(): PubSub {
  return new Proxy(new EventEmitterPubSub(), {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic !== 'workflows' || event.type !== 'workflow.start') {
            return target.publish(topic, event, options);
          }
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
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

describe('recovery of an evented run whose restart is lost (#28712)', () => {
  it('restarts a run again once the liveness its lost restart wrote lapsed and the grace period passed', async () => {
    const storage = new InMemoryStore();
    await persistActiveRun(storage, 'orphaned');
    await sleep(GRACE_MS);
    const executions: string[] = [];
    // B's restart never reaches a worker.
    const b = await startReplica(storage, 'B', executions, lostStartsPubSub());
    await b.restartAllActiveWorkflowRuns();

    // Until then the restart counts as live, so C leaves the run alone.
    const c = await startReplica(storage, 'C', executions, new EventEmitterPubSub());
    await c.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + GRACE_MS * 1.5);
    await c.restartAllActiveWorkflowRuns();
    await vi.waitFor(() => expect(executions).toEqual(['C:first:orphaned', 'C:second:orphaned']));
  }, 20_000);
});
