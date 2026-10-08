/**
 * The evented engine carries mid-run workflow state (setState) in event
 * payloads. It must also record it in storage together with each step result,
 * otherwise a run restarted after a crash resumes with the state from the
 * run's start and silently drops every setState() made before the crash.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const looseObject = z.looseObject({});
const stateSchema = z.object({ first: z.number(), second: z.number() });
const initialState = { first: 0, second: 0 };

type StateStepExecute = (params: { inputData: any; state: any; setState: (s: any) => Promise<void> }) => Promise<any>;

const hosts: Mastra[] = [];

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stopWorkers()));
});

async function makeHost(workflow: { id: string }, storage: InstanceType<typeof MockStore>) {
  const mastra = new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startWorkers();
  hosts.push(mastra);
  return mastra;
}

function makeStep(id: string, execute: StateStepExecute) {
  return createStep({
    id,
    inputSchema: looseObject,
    outputSchema: looseObject,
    stateSchema,
    execute: execute as any,
  });
}

async function loadSnapshot(storage: InstanceType<typeof MockStore>, workflowName: string, runId: string) {
  const workflowsStore = await storage.getStore('workflows');
  return workflowsStore!.loadWorkflowSnapshot({ workflowName, runId });
}

describe('evented mid-run state recording', () => {
  it('restarts a crashed run with the state set by completed steps', async () => {
    const storage = new MockStore();
    const workflowId = 'mid-run-state-sequential';
    const runId = `mid-run-state-sequential-${Date.now()}`;

    const build = (step1Execute: StateStepExecute, step2Execute: StateStepExecute) => {
      const step1 = makeStep('step1', step1Execute);
      const step2 = makeStep('step2', step2Execute);
      return createWorkflow({
        id: workflowId,
        inputSchema: looseObject,
        outputSchema: looseObject,
        stateSchema,
        steps: [step1, step2],
      })
        .then(step1)
        .then(step2)
        .commit();
    };

    // ---- Host A: step1 sets state, step2 hangs (simulated crash) ----
    const step2Started = Promise.withResolvers<void>();
    const workflowA = build(
      async ({ setState, state }) => {
        await setState({ ...state, first: 1 });
        return { done: 'step1' };
      },
      async () => {
        step2Started.resolve();
        // Never resolves: the "process" dies while this step is in flight.
        await new Promise<never>(() => {});
        return {};
      },
    );
    await makeHost(workflowA, storage);
    const runA = await workflowA.createRun({ runId });
    runA.start({ inputData: {}, initialState }).catch(() => {});
    await step2Started.promise;

    const snapshot = await loadSnapshot(storage, workflowId, runId);
    expect((snapshot!.context as any).__state).toEqual({ first: 1, second: 0 });

    // ---- Host B: fresh instances over the SAME storage ----
    const step1B = vi.fn(async () => ({ done: 'should-not-run' }));
    const step2B = vi.fn<StateStepExecute>(async ({ state }) => ({ seen: state }));
    const workflowB = build(step1B, step2B);
    await makeHost(workflowB, storage);

    const runB = await workflowB.createRun({ runId });
    const result = await runB.restart();

    expect(result.status).toBe('success');
    expect(step1B).not.toHaveBeenCalled();
    expect(step2B).toHaveBeenCalledTimes(1);
    expect(step2B.mock.calls[0]![0].state).toEqual({ first: 1, second: 0 });
  });

  it('restarts a crashed run with the merged state of a completed parallel group', async () => {
    const storage = new MockStore();
    const workflowId = 'mid-run-state-parallel';
    const runId = `mid-run-state-parallel-${Date.now()}`;

    const build = (nextExecute: StateStepExecute) => {
      const branch1 = makeStep('branch1', async ({ setState }) => {
        await new Promise(resolve => setTimeout(resolve, 20));
        await setState({ first: 1 });
        return { branch: 1 };
      });
      const branch2 = makeStep('branch2', async ({ setState }) => {
        await setState({ second: 1 });
        return { branch: 2 };
      });
      const next = makeStep('next', nextExecute);
      return createWorkflow({
        id: workflowId,
        inputSchema: looseObject,
        outputSchema: looseObject,
        stateSchema,
        steps: [branch1, branch2, next],
      })
        .parallel([branch1, branch2])
        .then(next)
        .commit();
    };

    // ---- Host A: both branches set state, the following step hangs ----
    const nextStarted = Promise.withResolvers<void>();
    const workflowA = build(async () => {
      nextStarted.resolve();
      await new Promise<never>(() => {});
      return {};
    });
    await makeHost(workflowA, storage);
    const runA = await workflowA.createRun({ runId });
    runA.start({ inputData: {}, initialState }).catch(() => {});
    await nextStarted.promise;

    const snapshot = await loadSnapshot(storage, workflowId, runId);
    expect((snapshot!.context as any).__state).toEqual({ first: 1, second: 1 });

    // ---- Host B: restart over the SAME storage ----
    const nextB = vi.fn<StateStepExecute>(async ({ state }) => ({ seen: state }));
    const workflowB = build(nextB);
    await makeHost(workflowB, storage);

    const runB = await workflowB.createRun({ runId });
    const result = await runB.restart();

    expect(result.status).toBe('success');
    expect(nextB).toHaveBeenCalledTimes(1);
    expect(nextB.mock.calls[0]![0].state).toEqual({ first: 1, second: 1 });
  });

  it('restarts a crashed run with the state set by every foreach iteration', async () => {
    const storage = new MockStore();
    const workflowId = 'mid-run-state-foreach';
    const runId = `mid-run-state-foreach-${Date.now()}`;

    const build = (afterExecute: StateStepExecute) => {
      const body = createStep({
        id: 'body',
        inputSchema: z.number(),
        outputSchema: z.number(),
        stateSchema,
        execute: async ({ inputData, state, setState }) => {
          await setState({ ...state, first: state.first + inputData });
          return inputData;
        },
      });
      const toItems = createStep({
        id: 'to-items',
        inputSchema: looseObject,
        outputSchema: z.array(z.number()),
        execute: async () => [1, 2, 3],
      });
      const after = createStep({
        id: 'after',
        inputSchema: z.array(z.number()),
        outputSchema: looseObject,
        stateSchema,
        execute: afterExecute as any,
      });
      return createWorkflow({
        id: workflowId,
        inputSchema: looseObject,
        outputSchema: looseObject,
        stateSchema,
        steps: [toItems, body, after],
      })
        .then(toItems)
        .foreach(body)
        .then(after)
        .commit();
    };

    // ---- Host A: every iteration sets state, the following step hangs ----
    const afterStarted = Promise.withResolvers<void>();
    const workflowA = build(async () => {
      afterStarted.resolve();
      await new Promise<never>(() => {});
      return {};
    });
    await makeHost(workflowA, storage);
    const runA = await workflowA.createRun({ runId });
    runA.start({ inputData: {}, initialState }).catch(() => {});
    await afterStarted.promise;

    const snapshot = await loadSnapshot(storage, workflowId, runId);
    expect((snapshot!.context as any).__state).toEqual({ first: 6, second: 0 });

    // ---- Host B: restart over the SAME storage ----
    const afterB = vi.fn<StateStepExecute>(async ({ state }) => ({ seen: state }));
    const workflowB = build(afterB);
    await makeHost(workflowB, storage);

    const runB = await workflowB.createRun({ runId });
    const result = await runB.restart();

    expect(result.status).toBe('success');
    expect(afterB).toHaveBeenCalledTimes(1);
    expect(afterB.mock.calls[0]![0].state).toEqual({ first: 6, second: 0 });
  });
});
