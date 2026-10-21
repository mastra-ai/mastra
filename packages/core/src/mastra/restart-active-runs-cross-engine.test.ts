import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { InMemoryStore } from '../storage';
import { createStep as createDefaultStep, createWorkflow as createDefaultWorkflow } from '../workflows';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflows/evented';
import { Mastra } from './index';

const schema = z.object({});
const resultSchema = z.object({ charged: z.boolean() });

type Engine = 'default' | 'evented';

function createHost(engine: Engine, storage: InMemoryStore, charge: () => Promise<void>) {
  const execute = async () => {
    await charge();
    return { charged: true };
  };
  const prepare =
    engine === 'evented'
      ? createEventedStep({ id: 'prepare', inputSchema: schema, outputSchema: schema, execute: async () => ({}) })
      : createDefaultStep({ id: 'prepare', inputSchema: schema, outputSchema: schema, execute: async () => ({}) });
  const step =
    engine === 'evented'
      ? createEventedStep({ id: 'charge-card', inputSchema: schema, outputSchema: resultSchema, execute })
      : createDefaultStep({ id: 'charge-card', inputSchema: schema, outputSchema: resultSchema, execute });
  const workflow =
    engine === 'evented'
      ? createEventedWorkflow({
          id: 'charge-card-workflow',
          inputSchema: schema,
          outputSchema: resultSchema,
          steps: [prepare, step],
        })
          .then(prepare)
          .then(step)
          .commit()
      : createDefaultWorkflow({ id: 'charge-card-workflow', inputSchema: schema, outputSchema: resultSchema })
          .then(prepare)
          .then(step)
          .commit();
  return new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow },
    pubsub: new EventEmitterPubSub(),
  });
}

async function runLiveReplicaScenario(engine: Engine) {
  const storage = new InMemoryStore();
  const charges: string[] = [];
  let signalStarted!: () => void;
  const started = new Promise<void>(resolve => (signalStarted = resolve));
  let finishCharge!: () => void;
  const blocked = new Promise<void>(resolve => (finishCharge = resolve));
  const hostA = createHost(engine, storage, async () => {
    charges.push('A');
    signalStarted();
    await blocked;
  });
  const hostB = createHost(engine, storage, async () => {
    charges.push('B');
  });
  let result: Promise<unknown> | undefined;
  try {
    await hostA.startWorkers();
    await hostB.startWorkers();
    const run = await hostA.getWorkflow('charge-card-workflow').createRun();
    result = run.start({ inputData: {} });
    await started;
    expect((await hostB.listActiveWorkflowRuns()).runs.map(active => active.runId)).toContain(run.runId);
    await hostB.restartAllActiveWorkflowRuns();
    if (engine === 'evented') {
      // Observe the asynchronous restart long enough for the second host to execute it.
      // If ownership is added, no B charge should appear and the expected-failure test becomes green.
      await vi.waitFor(() => expect(charges).toContain('B'), { timeout: 1000 }).catch(() => {});
    }
    return [...charges];
  } finally {
    finishCharge();
    await result;
    await hostB.stopWorkers();
    await hostA.stopWorkers();
  }
}

describe('boot recovery with a live charge-card step across workflow engines', () => {
  it('default: does not duplicate an in-flight charge on another replica', async () => {
    expect(await runLiveReplicaScenario('default')).toEqual(['A']);
  });

  // Known #25631 blocker: evented workers have no run ownership; a new restart event
  // bypasses the per-event-id step lease. This in-process broker reproduces the
  // duplicate, but is not a substitute for a distributed broker/fenced-store test.
  it.fails('evented: does not duplicate an in-flight charge on another replica', async () => {
    expect(await runLiveReplicaScenario('evented')).toEqual(['A']);
  });
});
