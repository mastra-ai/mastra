import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PostgresStore } from '../..';
import { Mastra } from '../../../../../../packages/core/src/mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../../../../../packages/core/src/request-context';
import { createStep, createWorkflow } from '../../../../../../packages/core/src/workflows/evented';
import {
  nestedHandOffKey,
  runLivenessKey,
  stepOccurrenceKey,
} from '../../../../../../packages/core/src/workflows/evented/leases';
import { abandonLease } from '../../../../../../packages/core/src/workflows/evented/test-utils/abandon-lease';
import { RedeliveryDriver } from '../../../../../../packages/core/src/workflows/evented/test-utils/redelivery-driver';
import { connectionString, TEST_CONFIG } from '../../test-utils';

describe('Postgres evented occurrence replay', () => {
  const schemaName = `evented_guard_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'evented-guard', schemaName });
  beforeAll(() => storage.init());
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  it.each([false, true])(
    'does not fail a finished run on redelivery with snapshot persistence %s',
    async persist => {
      const driver = new RedeliveryDriver();
      const schema = z.object({ n: z.number() });
      let calls = 0;
      const workflow = createWorkflow({
        id: `finished-replay-${randomUUID()}`,
        inputSchema: schema,
        outputSchema: schema,
        options: { shouldPersistSnapshot: () => persist },
      })
        .then(
          createStep({
            id: 'finish',
            inputSchema: schema,
            outputSchema: schema,
            execute: async ({ inputData }) => {
              calls++;
              return inputData;
            },
          }),
        )
        .commit();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 1 } })).toMatchObject({ status: 'success', result: { n: 1 } });
        const store = (await storage.getStore('workflows'))!;
        await expect
          .poll(async () => Boolean(await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId })))
          .toBe(persist);
        const original = driver.stepRuns({ spec: '0', runId: run.runId })[0]!;
        const key = `workflow-step-run:${run.runId}:${original.id}`;
        for (const deliveryAttempt of [2, 3, 4]) {
          const owner = await driver.pubsub.getLeaseOwner(key);
          if (owner) await driver.pubsub.releaseLease(key, owner);
          await driver.redeliverEvent(original, { deliveryAttempt });
        }
        expect(driver.events.filter(event => event.type === 'workflow.fail' && event.runId === run.runId)).toEqual([]);
        expect(calls).toBe(1);
      } finally {
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    8_000,
  );

  it('fails promptly when a live run loses its snapshot inside a step', async () => {
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const store = (await storage.getStore('workflows'))!;
    const workflow = createWorkflow({
      id: `missing-live-${randomUUID()}`,
      inputSchema: schema,
      outputSchema: schema,
    })
      .then(
        createStep({
          id: 'delete-snapshot',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData, runId }) => {
            await store.deleteWorkflowRunById({ workflowName: workflow.id, runId });
            return inputData;
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { n: 1 } });
      expect(result.status).toBe('failed');
      expect(driver.events.filter(event => event.type === 'workflow.fail' && event.runId === run.runId)).toHaveLength(
        1,
      );
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 8_000);

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
          expect(requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBe('live-loop-recovery-token');
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
        const requestContext = new RequestContext();
        requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'live-loop-recovery-token');
        const result = run.start({ inputData: { n: 0 }, initialState: { n: 0 }, requestContext });
        await saved;
        const store = await storage.getStore('workflows');
        const snapshot = await store!.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
        expect(snapshot?.context[body.id]).toMatchObject({ status: 'success', output: { n: 1 } });
        expect(snapshot?.requestContext).not.toHaveProperty(MASTRA_AUTH_TOKEN_KEY);
        expect(snapshot?.context.__state).toEqual({ n: 1 });
        expect(calls).toEqual([1]);
        const original =
          bodyKind === 'nested-completion'
            ? driver.events.find(event => event.type === 'workflow.step.end' && event.data.workflowId === body.id)!
            : driver.stepRuns({ spec: '0', runId: run.runId })[0]!;
        interrupted.mockRestore();
        // The worker died: the body's step lease lapses. This live process could still be releasing
        // it, and a release makes a delivery waiting on it drop the occurrence as handled.
        await abandonLease(storage, stepOccurrenceKey(run.runId, [0], 0));
        const leaseKey = `workflow-step-run:${original.runId}:${original.id}`;
        await driver.pubsub.releaseLease(leaseKey, (await driver.pubsub.getLeaseOwner(leaseKey))!);
        if (bodyKind === 'nested-completion') {
          // The worker died after handing the child's result to the loop: the claim it took for that
          // hand-off lapses instead of being kept, so the redelivered child end hands off again.
          await abandonLease(storage, nestedHandOffKey(run.runId, [0], original.runId));
        }
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

  it('runs a step once when a duplicate is delivered while the first delivery still runs it', async () => {
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const store = (await storage.getStore('workflows'))!;
    const gate = Promise.withResolvers<void>();
    let executions = 0;
    const workflow = createWorkflow({ id: `live-duplicate-${randomUUID()}`, inputSchema: schema, outputSchema: schema })
      .then(
        createStep({
          id: 'slow',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => {
            executions++;
            await gate.promise;
            return inputData;
          },
        }),
      )
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
    await mastra.startWorkers();
    const claim = store.claimRunOwnership.bind(store);
    const refused = Promise.withResolvers<void>();
    const claims = vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
      const result = await claim(args);
      if (args.runId.includes('::step:') && !result.acquired) {
        refused.resolve();
      }

      return result;
    });
    try {
      const run = await workflow.createRun();
      const result = run.start({ inputData: { n: 1 } });
      await expect.poll(() => executions).toBe(1);
      const original = driver.stepRuns({ spec: '0', runId: run.runId })[0]!;
      const key = `workflow-step-run:${run.runId}:${original.id}`;
      await driver.pubsub.releaseLease(key, (await driver.pubsub.getLeaseOwner(key))!);
      // The duplicate finds the first delivery's step lease live and waits for it.
      const duplicate = driver.redeliverEvent(original);
      await refused.promise;
      gate.resolve();
      // It checks the lease again within one renew interval of the release, then drops itself.
      await duplicate;
      expect(await result).toMatchObject({ status: 'success', result: { n: 1 } });
      expect(executions).toBe(1);
    } finally {
      gate.resolve();
      claims.mockRestore();
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 20_000);

  it('continues a suspended loop after approval without stranding the next iteration', async () => {
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const calls: number[] = [];
    const body = createStep({
      id: 'approval',
      inputSchema: schema,
      outputSchema: schema,
      resumeSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ approval: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (inputData.n === 0 && !resumeData?.approved) return suspend({ approval: true });
        calls.push(inputData.n);
        return { n: inputData.n + 1 };
      },
    });
    const workflow = createWorkflow({ id: `loop-resume-${randomUUID()}`, inputSchema: schema, outputSchema: schema })
      .dountil(body, async ({ inputData }) => inputData.n === 2)
      .commit();
    const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'suspended' });
      const result = run.resume({ resumeData: { approved: true } });
      await expect.poll(() => calls, { timeout: 1_500 }).toEqual([0, 1]);
      expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
    }
  }, 8_000);

  it.each([
    ['run', false],
    ['end', false],
    ['run', true],
    ['end', true],
  ] as const)(
    'continues a saved linear result after reclaiming step.%s with pruning %s',
    async (delivery, prune) => {
      const driver = new RedeliveryDriver();
      const schema = z.object({ n: z.number() });
      const calls: string[] = [];
      let releaseSecond!: () => void;
      const secondGate = new Promise<void>(resolve => {
        releaseSecond = resolve;
      });
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
          expect(requestContext.get(MASTRA_AUTH_TOKEN_KEY)).toBe('live-recovery-token');
          expect(state).toEqual({ n: 1 });
          await secondGate;
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: `linear-crash-${randomUUID()}`,
        inputSchema: schema,
        outputSchema: schema,
        stateSchema: schema,
        options: prune
          ? {
              pruneSnapshot: ({ snapshot }) => ({
                ...snapshot,
                context: {
                  ...snapshot.context,
                  ...(snapshot.context.first?.status === 'success'
                    ? { first: { ...snapshot.context.first, output: {} } }
                    : {}),
                },
              }),
            }
          : undefined,
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
        const requestContext = new RequestContext();
        requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'live-recovery-token');
        const result = run.start({ inputData: { n: 0 }, initialState: { n: 0 }, requestContext });
        await saved;
        const original =
          delivery === 'run'
            ? driver.stepRuns({ spec: '0', runId: run.runId })[0]!
            : driver.events.find(event => event.type === 'workflow.step.end' && event.runId === run.runId)!;
        const store = (await storage.getStore('workflows'))!;
        expect(
          (await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.context.first,
        ).toMatchObject({ status: 'success', output: { n: 1 } });
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
                  requestContext: { committed: false, [MASTRA_AUTH_TOKEN_KEY]: 'live-recovery-token' },
                },
              }
            : original,
        );
        await expect.poll(() => calls, { timeout: 1_500 }).toEqual(['first', 'second']);
        if (prune) {
          const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
          expect(snapshot?.context.first).toMatchObject({ output: {}, metadata: { __continuationStarted: true } });
          expect(snapshot?.context.second).toMatchObject({ status: 'running', payload: { n: 1 } });
          const owner = await driver.pubsub.getLeaseOwner(leaseKey);
          if (owner) await driver.pubsub.releaseLease(leaseKey, owner);
          const deliveries = driver.deliveryCount({ spec: '1', runId: run.runId });
          await driver.redeliverEvent(original);
          expect(driver.deliveryCount({ spec: '1', runId: run.runId })).toBe(deliveries);
        }
        releaseSecond();
        expect(await result).toMatchObject({ status: 'success', result: { n: 2 } });
        const owner = await driver.pubsub.getLeaseOwner(leaseKey);
        if (owner) await driver.pubsub.releaseLease(leaseKey, owner);
        const deliveries = driver.deliveryCount({ spec: '1', runId: run.runId });
        await driver.redeliverEvent(original);
        expect(driver.deliveryCount({ spec: '1', runId: run.runId })).toBe(deliveries);
        expect(calls).toEqual(['first', 'second']);
      } finally {
        releaseSecond();
        interrupted.mockRestore();
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    8_000,
  );

  it.each(
    (
      [
        ['terminal', false],
        ['terminal', true],
        ['foreach', false],
        ['parallel', false],
        ['conditional', false],
        ['foreach', true],
        ['parallel', true],
        ['conditional', true],
      ] as const
    ).flatMap(([boundary, replay]) => [[boundary, replay, true] as const, [boundary, replay, false] as const]),
  )(
    'retires results at a %s boundary with continuation replay %s and pruning %s',
    async (boundary, replay, prune) => {
      const driver = new RedeliveryDriver();
      const item = z.object({ n: z.number() });
      const items = z.array(item);
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const first = createStep({
        id: 'first',
        inputSchema: items,
        outputSchema: items,
        execute: async ({ inputData }) => inputData.map(({ n }) => ({ n: n + 1 })),
      });
      const second = createStep({
        id: 'second',
        inputSchema: items,
        outputSchema: items,
        execute: async ({ inputData }) => {
          expect(inputData).toEqual([{ n: 1 }]);
          await gate;
          return [{ n: 2 }];
        },
      });
      const each = createStep({
        id: 'each',
        inputSchema: item,
        outputSchema: item,
        execute: async ({ inputData }) => {
          expect(inputData).toEqual({ n: 1 });
          await gate;
          return { n: 2 };
        },
      });
      const third = createStep({
        id: 'third',
        inputSchema: items,
        outputSchema: items,
        execute: async ({ inputData }) => inputData.map(({ n }) => ({ n: n + 1 })),
      });
      const builder = createWorkflow({
        id: `prune-${boundary}-${randomUUID()}`,
        inputSchema: items,
        outputSchema: z.any(),
        options: prune
          ? {
              pruneSnapshot: ({ snapshot }) => ({
                ...snapshot,
                context: Object.fromEntries(
                  Object.entries(snapshot.context).map(([id, result]) => [
                    id,
                    result?.status === 'success' ? { ...result, output: { pruned: true } } : result,
                  ]),
                ),
              }),
            }
          : undefined,
      }).then(first);
      const workflow =
        boundary === 'foreach'
          ? builder.foreach(each).commit()
          : boundary === 'parallel'
            ? builder.parallel([second]).commit()
            : boundary === 'conditional'
              ? builder.branch([[async () => true, second]]).commit()
              : builder.then(second).then(third).commit();
      const mastra = new Mastra({ storage, pubsub: driver.pubsub, workflows: { [workflow.id]: workflow } });
      const store = (await storage.getStore('workflows'))!;
      const persist = store.persistWorkflowSnapshot.bind(store);
      let terminalWriteFailed = false;
      const failedPrune =
        boundary === 'terminal' && replay
          ? vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
              if (!terminalWriteFailed && args.snapshot.status === 'success') {
                terminalWriteFailed = true;
                throw new Error('Terminal prune write interrupted');
              }
              return persist(args);
            })
          : undefined;
      const publish = driver.pubsub.publish.bind(driver.pubsub);
      const interrupted = replay
        ? vi.spyOn(driver.pubsub, 'publish').mockImplementation(async (topic, event, options) => {
            if (event.type === 'workflow.step.run' && event.data.executionPath?.[0] === 1) return;
            return publish(topic, event, options);
          })
        : undefined;
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        const result = run.start({ inputData: [{ n: 0 }] });
        if (replay) {
          const committed = await driver.waitForStepEnd({ spec: '0', runId: run.runId });
          await expect
            .poll(() =>
              interrupted!.mock.calls.some(
                ([, event]) => event.type === 'workflow.step.run' && event.data.executionPath?.[0] === 1,
              ),
            )
            .toBe(true);
          interrupted!.mockRestore();
          await driver.redeliverEvent(committed);
        }
        await expect
          .poll(async () => {
            const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
            return snapshot?.context.first;
          })
          .toMatchObject({
            output: prune ? { pruned: true } : [{ n: 1 }],
            metadata: { __continuationStarted: true },
          });
        const predecessor = await driver.waitForStepEnd({ spec: '0', runId: run.runId });
        const continuations = driver.deliveryCount({ spec: '1', runId: run.runId });
        await driver.redeliverEvent(predecessor);
        expect(driver.deliveryCount({ spec: '1', runId: run.runId })).toBe(continuations);
        release();
        if (failedPrune) {
          await expect.poll(() => terminalWriteFailed).toBe(true);
          const terminalEnd = driver.events.find(event => event.type === 'workflow.end' && event.runId === run.runId)!;
          const replayed = await driver.redeliverEvent(terminalEnd);
          expect(replayed.handled[0]?.result).toEqual({ ok: true });
        }
        expect(await result).toMatchObject({
          status: 'success',
          result: boundary === 'terminal' ? [{ n: 3 }] : boundary === 'foreach' ? [{ n: 2 }] : { second: [{ n: 2 }] },
        });
        const finalId = boundary === 'terminal' ? 'third' : boundary === 'foreach' ? 'each' : 'second';
        await expect
          .poll(async () => {
            const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
            return snapshot?.context[finalId];
          })
          .toMatchObject({
            status: 'success',
            output: prune ? { pruned: true } : boundary === 'terminal' ? [{ n: 3 }] : [{ n: 2 }],
          });
        await driver.redeliverEvent(predecessor);
        expect(driver.deliveryCount({ spec: '1', runId: run.runId })).toBe(continuations);
        if (boundary === 'terminal') {
          const terminalEnds = driver.events.filter(event => event.type === 'workflow.end').length;
          const terminalRun = driver.stepRuns({ spec: '2', runId: run.runId })[0]!;
          const terminalEnd = await driver.waitForStepEnd({ spec: '2', runId: run.runId });
          const leaseKey = `workflow-step-run:${run.runId}:${terminalRun.id}`;
          const owner = await driver.pubsub.getLeaseOwner(leaseKey);
          if (owner) await driver.pubsub.releaseLease(leaseKey, owner);
          await driver.redeliverEvent(terminalRun);
          await driver.redeliverEvent(terminalEnd);
          expect(driver.events.filter(event => event.type === 'workflow.end')).toHaveLength(terminalEnds);
          const completed = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
          expect(completed?.result).toMatchObject({ status: 'success', output: [{ n: 3 }] });
        }
      } finally {
        failedPrune?.mockRestore();
        interrupted?.mockRestore();
        release();
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    8_000,
  );

  it('keeps the committed terminal result when the read replica still sees a running step', async () => {
    const readPool = new Pool({ connectionString, max: 1 });
    const replicaStorage = new PostgresStore({ ...TEST_CONFIG, id: 'lagging-reader', schemaName, readPool });
    await replicaStorage.init();
    const driver = new RedeliveryDriver();
    const schema = z.object({ n: z.number() });
    const step = createStep({
      id: 'finish',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ runId }) => {
        // Keep a real PostgreSQL read view behind the primary's terminal commit.
        await readPool.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const stale = await readPool.query(
          `SELECT snapshot FROM "${schemaName}".mastra_workflow_snapshot WHERE run_id = $1`,
          [runId],
        );
        expect(stale.rows[0].snapshot.status).toBe('running');
        return { n: 1 };
      },
    });
    const workflow = createWorkflow({
      id: `replica-prune-${randomUUID()}`,
      inputSchema: schema,
      outputSchema: schema,
      options: {
        pruneSnapshot: ({ snapshot }) => ({
          ...snapshot,
          context: Object.fromEntries(
            Object.entries(snapshot.context).map(([id, result]) => [
              id,
              result?.status === 'success' ? { ...result, output: {} } : result,
            ]),
          ),
        }),
      },
    })
      .then(step)
      .commit();
    const mastra = new Mastra({
      storage: replicaStorage,
      pubsub: driver.pubsub,
      workflows: { [workflow.id]: workflow },
    });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun({ resourceId: 'replica-owner' });
      expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'success', result: { n: 1 } });
      await expect
        .poll(() => driver.events.some(event => event.type === 'workflow.end' && event.runId === run.runId))
        .toBe(true);
      const end = driver.events.find(event => event.type === 'workflow.end' && event.runId === run.runId)!;
      await driver.redeliverEvent(end);
      const store = (await replicaStorage.getStore('workflows'))!;
      const completed = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      expect(completed).toMatchObject({
        status: 'success',
        result: { output: { n: 1 } },
        context: { finish: { output: {}, metadata: { __continuationStarted: true } } },
      });
      const stale = await readPool.query(
        `SELECT snapshot FROM "${schemaName}".mastra_workflow_snapshot WHERE run_id = $1`,
        [run.runId],
      );
      expect(stale.rows[0].snapshot.status).toBe('running');
      await readPool.query('ROLLBACK');
      expect(await store.getWorkflowRunById({ workflowName: workflow.id, runId: run.runId })).toMatchObject({
        resourceId: 'replica-owner',
      });
    } finally {
      await readPool.query('ROLLBACK');
      await mastra.stopWorkers();
      driver.dispose();
      await replicaStorage.close();
      await readPool.end();
    }
  }, 8_000);

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
      // With no step of the run running anywhere, its liveness lapses.
      await abandonLease(storage, runLivenessKey(run.runId));
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
        // The worker died: the step lease it handed to the retry it never published lapses, where
        // this live process would keep renewing it.
        await abandonLease(storage, stepOccurrenceKey(run.runId, [0], kind === 'loop' ? 0 : undefined));
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
});
