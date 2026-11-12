import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PostgresStore } from '../..';
import { Mastra } from '../../../../../../packages/core/src/mastra';
import { createStep, createWorkflow } from '../../../../../../packages/core/src/workflows/evented';
import { RedeliveryDriver } from '../../../../../../packages/core/src/workflows/evented/test-utils/redelivery-driver';
import { TEST_CONFIG } from '../../test-utils';

// Loop cases of the Postgres evented occurrence replay suite (evented-occurrence.test.ts).
describe('Postgres evented occurrence replay of loops', () => {
  const schemaName = `evented_guard_loops_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'evented-guard-loops', schemaName });
  beforeAll(() => storage.init());
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  it('finishes a loop when an older worker leaves saved rows without occurrence metadata', async () => {
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const calls: number[] = [];
    const body = createStep({
      id: 'increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        calls.push(inputData.n + 1);
        return { n: inputData.n + 1 };
      },
    });
    const workflow = createWorkflow({ id: `legacy-loop-${randomUUID()}`, inputSchema: schema, outputSchema: schema })
      .dountil(body, async ({ inputData }) => inputData.n === 3)
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { workflow } });
    const publish = driver.pubsub.publish.bind(driver.pubsub);
    let legacyWrite = false;
    const olderWorker = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
      if (
        !legacyWrite &&
        topic === 'workflows' &&
        event.type === 'workflow.step.run' &&
        event.data.prevResult?.output?.n === 1
      ) {
        const store = await storage.getStore('workflows');
        const snapshot = await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: event.runId });
        expect(snapshot?.context[body.id]).toMatchObject({ status: 'success', output: { n: 1 } });
        for (const result of Object.values(snapshot!.context)) {
          if (result?.metadata) delete result.metadata.startedBy;
        }
        await store!.persistWorkflowSnapshot({ workflowName: workflow.id, runId: event.runId, snapshot: snapshot! });
        legacyWrite = true;
      }
      return publish(topic, event, options);
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 3 } });
      expect(legacyWrite).toBe(true);
      expect(calls).toEqual([1, 2, 3]);
    } finally {
      olderWorker.mockRestore();
      await mastra.stopWorkers();
      driver.dispose();
    }
  });

  it('continues with committed loop state when a slower duplicate loses completion', async () => {
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    let release!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    let executions = 0;
    const states: unknown[] = [];
    const body = createStep({
      id: 'body',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData, state, setState }) => {
        executions++;
        if (executions === 1) {
          await blocked;
          await setState({ n: 999 });
          return { n: 999 };
        }
        states.push(state);
        await setState({ n: inputData.n + 1 });
        return { n: inputData.n + 1 };
      },
    });
    // Without step leases both deliveries run side by side and the completion guard picks the
    // winner. With leases the duplicate waits instead, and a holder whose lease was taken over
    // drops its follow-up rather than continuing.
    const workflow = createWorkflow({
      id: `loop-race-${randomUUID()}`,
      inputSchema: schema,
      outputSchema: schema,
      stateSchema: schema,
      options: { autoRestartActiveRuns: false },
    })
      .dountil(body, async ({ inputData }) => inputData.n >= 2)
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
    const publish = driver.pubsub.publish.bind(driver.pubsub);
    let swallowed = false;
    const interrupted = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
      if (
        !swallowed &&
        topic === 'workflows' &&
        event.type === 'workflow.step.run' &&
        event.data.prevResult?.output?.n === 1
      ) {
        swallowed = true;
        return;
      }
      return publish(topic, event, options);
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = run.start({ inputData: { n: 0 }, initialState: { n: 0 } });
      await expect.poll(() => executions).toBe(1);
      const original = driver.stepRuns({ spec: '0', runId: run.runId })[0]!;
      const key = `workflow-step-run:${run.runId}:${original.id}`;
      await driver.pubsub.releaseLease(key, (await driver.pubsub.getLeaseOwner(key))!);
      await driver.redeliverEvent(original);
      expect(swallowed).toBe(true);
      release();
      await expect.poll(() => executions, { timeout: 1_500 }).toBe(3);
      expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
      expect(states).toEqual([{ n: 0 }, { n: 1 }]);
    } finally {
      release();
      interrupted.mockRestore();
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 8_000);

  it('does not repeat loop bodies or rewind newer state when completed events are reclaimed', async () => {
    const driver = new RedeliveryDriver();
    const calls: number[] = [];
    const schema = z.object({ n: z.number() });
    const increment = createStep({
      id: 'increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData, setState }) => {
        const n = inputData.n + 1;
        calls.push(n);
        await setState({ n });
        return { n };
      },
    });
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const checkpoint = createStep({
      id: 'checkpoint',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        entered();
        await blocked;
        return inputData;
      },
    });
    const workflow = createWorkflow({
      id: `occurrences-${randomUUID()}`,
      inputSchema: schema,
      outputSchema: schema,
      stateSchema: schema,
    })
      .dountil(increment, async ({ inputData }) => inputData.n === 3)
      .then(checkpoint)
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { workflow } });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = run.start({ inputData: { n: 0 }, initialState: { n: 0 } });
      await started;
      const store = await storage.getStore('workflows');
      const load = () => store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      const before = await load();
      expect(before?.context.__state).toEqual({ n: 3 });
      const completion = driver.events.find(event => event.type === 'workflow.step.end');
      expect(completion).toBeDefined();
      expect(calls).toEqual([1, 2, 3]);
      await driver.redeliverEvent(completion!);
      expect(await load()).toEqual(before);
      // Expire the event-processing lease without changing the persisted occurrence.
      const stepRun = driver.stepRuns({ spec: '0', runId: run.runId }).at(-1)!;
      await driver.pubsub.releaseLease(
        `workflow-step-run:${run.runId}:${stepRun.id}`,
        (await driver.pubsub.getLeaseOwner(`workflow-step-run:${run.runId}:${stepRun.id}`))!,
      );
      await driver.redeliverEvent(stepRun);
      expect(calls).toEqual([1, 2, 3]);
      release();
      expect(await result).toMatchObject({ status: 'success', result: { n: 3 } });
    } finally {
      release();
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 20_000);
});
