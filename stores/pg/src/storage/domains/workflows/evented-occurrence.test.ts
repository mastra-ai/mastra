import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PostgresStore } from '../..';
import { Mastra } from '../../../../../../packages/core/src/mastra';
import { createStep, createWorkflow } from '../../../../../../packages/core/src/workflows/evented';
import { RedeliveryDriver } from '../../../../../../packages/core/src/workflows/evented/test-utils/redelivery-driver';
import { TEST_CONFIG } from '../../test-utils';

describe('Postgres evented occurrence replay', () => {
  const schemaName = `evented_guard_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'evented-guard', schemaName });
  beforeAll(() => storage.init());
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  it.each(['step', 'workflow', 'nested-completion', 'snapshots-disabled'] as const)(
    'continues a saved %s loop result after the worker dies before publishing the next iteration',
    async bodyKind => {
      const driver = new RedeliveryDriver();
      const calls: number[] = [];
      const contexts: unknown[] = [];
      const conditions: number[] = [];
      const schema = z.object({ n: z.number() });
      const increment = createStep({
        id: 'increment',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData, requestContext, setState }) => {
          contexts.push(requestContext.get('iteration'));
          requestContext.set('iteration', inputData.n + 1);
          calls.push(inputData.n + 1);
          await setState({ n: inputData.n + 1 });
          return { n: inputData.n + 1 };
        },
      });
      const body =
        bodyKind === 'workflow' || bodyKind === 'nested-completion'
          ? createWorkflow({ id: `nested-${randomUUID()}`, inputSchema: schema, outputSchema: schema })
              .then(increment)
              .commit()
          : increment;
      const workflow = createWorkflow({
        id: `loop-crash-${randomUUID()}`,
        inputSchema: schema,
        outputSchema: schema,
        stateSchema: schema,
        options: bodyKind === 'snapshots-disabled' ? { shouldPersistSnapshot: () => false } : undefined,
      })
        .dountil(body, async ({ inputData }) => {
          if (conditions.includes(inputData.n)) throw new Error('Committed loop decision was evaluated again');
          conditions.push(inputData.n);
          // A reclaimed completion must use its committed decision, even if a
          // condition consulting external state would now return another value.
          return inputData.n === 3 || conditions.filter(n => n === inputData.n).length > 1;
        })
        .commit();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { workflow } });
      const publish = driver.pubsub.publish.bind(driver.pubsub);
      let reached!: () => void;
      const saved = new Promise<void>(resolve => {
        reached = resolve;
      });
      const interrupted = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows' && event.type === 'workflow.step.run' && event.data.prevResult?.output?.n === 1) {
          reached();
          return;
        }
        return publish(topic, event, options);
      });
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        const result = run.start({ inputData: { n: 0 }, initialState: { n: 0 } });
        await saved;
        const store = await storage.getStore('workflows');
        const snapshot = await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
        expect(snapshot?.context[body.id]).toMatchObject({ status: 'success', output: { n: 1 } });
        expect(snapshot?.context.__state).toEqual({ n: 1 });
        expect(calls).toEqual([1]);
        const original =
          bodyKind === 'nested-completion'
            ? driver.events.find(event => event.type === 'workflow.step.end' && event.data.workflowId === body.id)!
            : driver.stepRuns({ spec: '0', runId: run.runId })[0]!;
        interrupted.mockRestore();
        const leaseKey = `workflow-step-run:${original.runId}:${original.id}`;
        await driver.pubsub.releaseLease(leaseKey, (await driver.pubsub.getLeaseOwner(leaseKey))!);
        await driver.redeliverEvent(original);
        expect(await result).toMatchObject({ status: 'success', result: { n: 3 } });
        expect(calls).toEqual([1, 2, 3]);
        expect(conditions).toEqual([1, 2, 3]);
        if (bodyKind === 'step' || bodyKind === 'snapshots-disabled') expect(contexts).toEqual([undefined, 1, 2]);
      } finally {
        interrupted.mockRestore();
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    20_000,
  );

  it.each(['run', 'end'] as const)(
    'continues a saved linear result after losing its continuation and reclaiming step.%s',
    async delivery => {
      const driver = new RedeliveryDriver();
      const schema = z.object({ n: z.number() });
      const calls: string[] = [];
      const first = createStep({
        id: 'first',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ requestContext, setState }) => {
          calls.push('first');
          requestContext.set('committed', true);
          await setState({ n: 1 });
          return { n: 1 };
        },
      });
      const second = createStep({
        id: 'second',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData, requestContext, state }) => {
          calls.push('second');
          expect(requestContext.get('committed')).toBe(true);
          expect(state).toEqual({ n: 1 });
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: `linear-crash-${randomUUID()}`,
        inputSchema: schema,
        outputSchema: schema,
        stateSchema: schema,
      })
        .then(first)
        .then(second)
        .commit();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
      const publish = driver.pubsub.publish.bind(driver.pubsub);
      let reached!: () => void;
      const saved = new Promise<void>(resolve => {
        reached = resolve;
      });
      const interrupted = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows' && event.type === 'workflow.step.run' && event.data.executionPath[0] === 1) {
          reached();
          return;
        }
        return publish(topic, event, options);
      });
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        const result = run.start({ inputData: { n: 0 }, initialState: { n: 0 } });
        await saved;
        const original =
          delivery === 'run'
            ? driver.stepRuns({ spec: '0', runId: run.runId })[0]!
            : driver.events.find(event => event.type === 'workflow.step.end' && event.runId === run.runId)!;
        interrupted.mockRestore();
        const leaseKey = `workflow-step-run:${run.runId}:${original.id}`;
        await driver.pubsub.releaseLease(leaseKey, (await driver.pubsub.getLeaseOwner(leaseKey))!);
        await driver.redeliverEvent(
          delivery === 'end'
            ? {
                ...original,
                data: {
                  ...original.data,
                  prevResult: { ...original.data.prevResult, output: { n: 999 } },
                  state: { n: 999 },
                  requestContext: { committed: false },
                },
              }
            : original,
        );
        await expect.poll(() => calls, { timeout: 1_500 }).toEqual(['first', 'second']);
        expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
        expect(calls).toEqual(['first', 'second']);
      } finally {
        interrupted.mockRestore();
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    8_000,
  );

  it('restarts a completed boundary whose successor reuses the step ID on Postgres', async () => {
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const calls: number[] = [];
    const body = createStep({
      id: 'body',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        calls.push(inputData.n);
        return { n: inputData.n + 1 };
      },
    });
    const workflow = createWorkflow({ id: `restart-reused-${randomUUID()}`, inputSchema: schema, outputSchema: schema })
      .then(body)
      .then(body)
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
    const publish = driver.pubsub.publish.bind(driver.pubsub);
    let reached!: () => void;
    const saved = new Promise<void>(resolve => {
      reached = resolve;
    });
    const interrupted = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
      if (topic === 'workflows' && event.type === 'workflow.step.run' && event.data.executionPath[0] === 1) {
        reached();
        return;
      }
      return publish(topic, event, options);
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      void run.start({ inputData: { n: 0 } });
      await saved;
      interrupted.mockRestore();
      const restarted = await workflow.createRun({ runId: run.runId });
      const result = restarted.restart();
      await expect.poll(() => calls, { timeout: 1_500 }).toEqual([0, 1]);
      expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
    } finally {
      interrupted.mockRestore();
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 8_000);

  it.each(['step', 'parallel', 'foreach', 'nested'] as const)(
    'removes recovery-only snapshots after a %s suspension but preserves resumable snapshots',
    async kind => {
      for (const persistSuspended of [false, true]) {
        let shouldPersistSuspended = persistSuspended;
        const driver = new RedeliveryDriver();
        const schema = z.object({ n: z.number() });
        const pause = createStep({
          id: 'pause',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ suspend }) => suspend({ reason: 'approval' }),
        });
        const child = createWorkflow({ id: `child-${randomUUID()}`, inputSchema: schema, outputSchema: schema })
          .then(pause)
          .commit();
        const workflow = createWorkflow({
          id: `suspend-${randomUUID()}`,
          inputSchema: kind === 'foreach' ? z.array(schema) : schema,
          outputSchema: z.any(),
          options: {
            shouldPersistSnapshot: ({ workflowStatus }) => shouldPersistSuspended && workflowStatus === 'suspended',
          },
        });
        if (kind === 'parallel') workflow.parallel([pause]);
        else if (kind === 'foreach') workflow.foreach(pause);
        else workflow.then(kind === 'nested' ? child : pause);
        workflow.commit();
        const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
        await mastra.startWorkers();
        try {
          const run = await workflow.createRun();
          const result = run.start({ inputData: kind === 'foreach' ? [{ n: 0 }] : { n: 0 } });
          expect(await result).toMatchObject({ status: 'suspended' });
          const store = await storage.getStore('workflows');
          await vi.waitFor(async () => {
            const snapshot = await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
            if (persistSuspended) expect(snapshot?.status).toBe('suspended');
            else expect(snapshot).toBeNull();
          });
          if (persistSuspended && kind === 'step') {
            shouldPersistSuspended = false;
            expect(await run.resume({ resumeData: {} })).toMatchObject({ status: 'suspended' });
            expect(await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId })).toMatchObject({
              context: { pause: { status: 'suspended', suspendPayload: { reason: 'approval' } } },
            });
          }
        } finally {
          await mastra.stopWorkers();
          driver.dispose();
        }
      }
    },
    20_000,
  );

  it.each(['step', 'loop'] as const)(
    'retries a saved failed %s after the worker dies before publishing its retry',
    async kind => {
      const driver = new RedeliveryDriver();
      const schema = z.object({ n: z.number() });
      let calls = 0;
      const increment = createStep({
        id: 'increment',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => {
          if (++calls === 1) throw new Error('Transient failure');
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: `retry-crash-${randomUUID()}`,
        inputSchema: schema,
        outputSchema: schema,
        retryConfig: { attempts: 1, delay: 0 },
      });
      if (kind === 'loop') workflow.dountil(increment, async ({ inputData }) => inputData.n === 1);
      else workflow.then(increment);
      workflow.commit();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { workflow } });
      const publish = driver.pubsub.publish.bind(driver.pubsub);
      let reached!: () => void;
      const saved = new Promise<void>(resolve => {
        reached = resolve;
      });
      const interrupted = vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (topic === 'workflows' && event.type === 'workflow.step.run' && event.data.retryCount === 1) {
          reached();
          return;
        }
        return publish(topic, event, options);
      });
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        const result = run.start({ inputData: { n: 0 } });
        await saved;
        const store = await storage.getStore('workflows');
        expect(
          (await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.context.increment
            .status,
        ).toBe('failed');
        expect(calls).toBe(1);
        interrupted.mockRestore();
        const original = structuredClone(driver.stepRuns({ spec: '0', runId: run.runId })[0]!);
        expect(original.data.stepResults.increment?.metadata?.startedBy).not.toBe(original.id);
        const leaseKey = `workflow-step-run:${run.runId}:${original.id}`;
        await driver.pubsub.releaseLease(leaseKey, (await driver.pubsub.getLeaseOwner(leaseKey))!);
        await driver.redeliverEvent(original);
        const retry = driver.stepRuns({ spec: '0', runId: run.runId }).at(-1)!;
        expect(retry.data.stepResults.increment).toMatchObject({
          status: 'failed',
          metadata: { startedBy: original.id },
        });
        expect(await result).toMatchObject({ status: 'success', result: { n: 1 } });
        expect(calls).toBe(2);
      } finally {
        interrupted.mockRestore();
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    20_000,
  );

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
