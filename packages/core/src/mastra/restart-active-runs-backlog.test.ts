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
import { InMemoryStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows/evented';
import { interceptStarts, persistActiveRun } from './test-utils/active-runs';
import { Mastra } from './index';

const GRACE_MS = 300;

const replicas: Mastra[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
});

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

describe('recovery of an evented run whose restart is lost (#28712)', () => {
  it('restarts a run again once the liveness its lost restart wrote lapsed and the grace period passed', async () => {
    const storage = new InMemoryStore();
    // The run stopped longer ago than the grace period.
    await persistActiveRun(storage, 'orphaned', { updatedAt: new Date(Date.now() - GRACE_MS) });
    const executions: string[] = [];
    // B's restart never reaches a worker.
    const b = await startReplica(storage, 'B', executions, interceptStarts(new EventEmitterPubSub(), { drop: true }));
    await b.restartAllActiveWorkflowRuns();

    // Until then the restart counts as live, so C leaves the run alone.
    const c = await startReplica(storage, 'C', executions, new EventEmitterPubSub());
    await c.restartAllActiveWorkflowRuns();
    expect(executions).toEqual([]);

    // C restarts it once that liveness lapsed and the grace period passed.
    await vi.waitFor(
      async () => {
        await c.restartAllActiveWorkflowRuns();
        expect(executions).toEqual(['C:first:orphaned', 'C:second:orphaned']);
      },
      { timeout: 10_000, interval: 100 },
    );
  }, 20_000);
});
