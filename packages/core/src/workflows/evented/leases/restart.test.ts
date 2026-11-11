/**
 * Booting replicas restart every active evented run they find, including runs
 * another replica is still executing (#28712). `restart()` refuses while the
 * run, or a nested run it drives, is live, so each step runs once however many
 * replicas boot. These cases cover that refusal and concurrent restarts.
 * Leases use a short TTL here, read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { InMemoryStore } from '../../../storage/mock';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import {
  Num,
  crash,
  interceptWorkflowEvents,
  isStepRunAt,
  recordLeases,
  restartOutcome,
  runIsLive,
  runStatus,
  shapes,
  sleep,
  startReplica,
  stopReplicas,
  track,
  work,
} from '../test-utils/lease-replicas';
import type { Built, Report } from '../test-utils/lease-replicas';
import { runLivenessKey, stepOccurrenceKey } from '.';

afterEach(stopReplicas);

describe('evented restart refusal (#28712)', () => {
  it('runs a step once when three replicas boot after the replica running it crashed', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const tracked = track({ blocks: ['a'] }, { hangForever: true });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    // A crashes mid-step. Its step lease and the run's liveness run out one TTL later.
    await a.mastra.shutdown({ drainTimeout: 0 });
    let expiresAt = 0;
    for (const key of [stepOccurrenceKey(run.runId, [0]), runLivenessKey(run.runId)]) {
      const { record } = await store.claimRunOwnership({
        runId: key,
        ownerId: 'crashed-worker',
        leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
        force: true,
      });
      expiresAt = Math.max(expiresAt, record!.leaseExpiresAt!.getTime());
    }

    const booting = await Promise.all(
      ['B', 'C', 'D'].map(name => startReplica(storage, shapes.step.build(tracked.reporter(name)))),
    );
    await Promise.all(booting.map(replica => replica.mastra.restartAllActiveWorkflowRuns()));
    expect(tracked.executions).toEqual(['A:a']);

    // The sweeps re-check once the leases could have lapsed, and one of them recovers the run.
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 15_000 });
    const recovered = tracked.executions.filter(e => !e.startsWith('A:'));
    expect(recovered).toHaveLength(1);
    expect(tracked.at[recovered[0]!]).toBeGreaterThanOrEqual(expiresAt);
  }, 30_000);

  it.each(['step', 'parallel', 'conditional', 'foreach', 'loop'] as const)(
    '%s: two replicas restarting a crashed run at once run each step once',
    async name => {
      const shape = shapes[name];
      // The crashed loop was in its second iteration, so the restart runs that iteration and the third.
      const iteration = name === 'loop' ? 1 : undefined;
      const recoveredLabels = name === 'loop' ? ['body:2', 'body:3'] : shape.labels;
      const storage = new InMemoryStore();
      const tracked = track(shape, { hangForever: true });
      const a = await startReplica(storage, shape.build(tracked.reporter('A')));
      const run = await a.workflow.createRun();
      void run.start({ inputData: shape.input as any });
      await tracked.allBlocked;
      await crash(a, storage, [
        ...shape.running.map(path => stepOccurrenceKey(run.runId, path, iteration)),
        runLivenessKey(run.runId),
      ]);

      const b = await startReplica(storage, shape.build(tracked.reporter('B')));
      const c = await startReplica(storage, shape.build(tracked.reporter('C')));
      const restarts = await Promise.all([restartOutcome(b, run.runId), restartOutcome(c, run.runId)]);

      expect(restarts.map(r => r.id).sort()).toEqual(['WORKFLOW_RESTART_RUN_OWNED', 'resolved:success']);
      const recovered = tracked.executions.filter(e => !e.startsWith('A:')).map(e => e.slice(2));
      expect(recovered.sort()).toEqual([...recoveredLabels].sort());
    },
    20_000,
  );

  it.each(['start', 'startAsync'] as const)(
    'leaves a run started with %s() to the replica running it when two replicas boot',
    async method => {
      const storage = new InMemoryStore();
      const tracked = track({ blocks: ['a'] });
      const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
      const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
      const c = await startReplica(storage, shapes.step.build(tracked.reporter('C')));
      const run = await a.workflow.createRun();
      if (method === 'start') void run.start({ inputData: { n: 1 } });
      else await run.startAsync({ inputData: { n: 1 } });
      await tracked.allBlocked;
      const blockedSince = Date.now();

      // Both sweeps are refused, then re-check the run once the liveness they saw could have
      // lapsed. A keeps it fresh, so at least one re-check is refused as well.
      const leases = await recordLeases(storage);
      await Promise.all([b.mastra.restartAllActiveWorkflowRuns(), c.mastra.restartAllActiveWorkflowRuns()]);
      await leases.until(() => leases.reads.filter(key => key === runLivenessKey(run.runId)).length >= 3);
      await sleep(Math.max(0, blockedSince + WORKFLOW_RUN_LEASE_TTL_MS * 2 - Date.now()));

      tracked.release();
      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

  it.each([
    ['its start event is still queued', false],
    ['its first step event is queued after its start event sat queued for a lease TTL', true],
  ] as const)(
    'leaves a just-started run to its replica while %s',
    async (_, startQueuedPastTtl) => {
      const storage = new InMemoryStore();
      const tracked = track({ blocks: [] });
      const startQueued = Promise.withResolvers<void>();
      const deliverStart = Promise.withResolvers<void>();
      const stepQueued = Promise.withResolvers<void>();
      const deliverStep = Promise.withResolvers<void>();
      // The events that start the run and its first step sit in the broker's queue for a while.
      const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
        if (event.type === 'workflow.start') {
          startQueued.resolve();
          return { hold: deliverStart.promise };
        }
        if (!startQueuedPastTtl || !isStepRunAt(event, [0])) return undefined;
        stepQueued.resolve();
        return { hold: deliverStep.promise };
      });
      const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')), { pubsub });
      const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
      const run = await a.workflow.createRun();
      // startAsync() resolves once its start event is published, which the queue holds back here.
      const started = run.startAsync({ inputData: { n: 1 } });
      await startQueued.promise;
      if (startQueuedPastTtl) {
        // The liveness the caller wrote lapses; the worker taking the start event writes it again.
        await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
        expect(await runIsLive(storage, run.runId)).toBe(false);
        deliverStart.resolve();
        await stepQueued.promise;
      }

      await b.mastra.restartAllActiveWorkflowRuns();
      deliverStart.resolve();
      deliverStep.resolve();
      await started;

      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

  it('leaves a time-travelled run to its replica while its start event is still queued', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    const queued = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    let holding = false;
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (!holding || event.type !== 'workflow.start') return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    // The step fails for the run's input, and the run is time travelled with a corrected one.
    const build = (replica: string) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(
          createStep({
            id: 'a',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              executions.push(`${replica}:${inputData.n}`);
              if (inputData.n === 1) throw new Error('bad input');
              return inputData;
            },
          }),
        )
        .commit();
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('failed');
    // The failed run's liveness lapses before it is time travelled.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
    expect(await runIsLive(storage, run.runId)).toBe(false);

    holding = true;
    const travelled = (await a.workflow.createRun({ runId: run.runId })).timeTravel({ step: 'a', inputData: { n: 2 } });
    await queued.promise;
    await b.mastra.restartAllActiveWorkflowRuns();
    deliver.resolve();

    expect((await travelled).status).toBe('success');
    expect(executions).toEqual(['A:1', 'A:2']);
  }, 20_000);

  it('leaves a parent run to its replica while the resume of its nested run is still queued', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const queued = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    let holding = false;
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (!holding || event.type !== 'workflow.resume') return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    const build = (replica: string) => {
      const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
        .then(
          createStep({
            id: 'approve',
            inputSchema: Num,
            outputSchema: Num,
            resumeSchema: z.object({ approved: z.boolean() }),
            execute: async ({ inputData, resumeData, suspend }) => {
              executions.push(`${replica}:${resumeData ? 'resumed' : 'suspended'}`);
              return resumeData ? inputData : suspend({});
            },
          }),
        )
        .commit();
      const parent = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(child).commit();
      return { parent: parent as unknown as Built, child: child as unknown as Built };
    };
    const onA = build('A');
    const onB = build('B');
    const a = await startReplica(storage, onA.parent, { pubsub, nested: { child: onA.child } });
    const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('suspended');
    const parentSnapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
    const nestedRunId = (parentSnapshot?.context.child as { suspendPayload?: any }).suspendPayload?.__workflow_meta
      ?.runId as string;
    // The suspended runs' liveness lapses before the nested run is resumed.
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
    expect(await runIsLive(storage, run.runId)).toBe(false);
    expect(await runIsLive(storage, nestedRunId)).toBe(false);

    // Resuming the nested run directly makes its parent `running` again too.
    holding = true;
    const resumed = (await onA.child.createRun({ runId: nestedRunId })).resume({ resumeData: { approved: true } });
    await queued.promise;
    await b.mastra.restartAllActiveWorkflowRuns();
    deliver.resolve();

    expect((await resumed).status).toBe('success');
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(executions).toEqual(['A:suspended', 'A:resumed']);
  }, 20_000);

  it('refuses to restart a run between one step finishing and the next one starting', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: [] });
    const queued = Promise.withResolvers<void>();
    const deliver = Promise.withResolvers<void>();
    const build = (report: Report) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(work('first', report))
        .then(work('second', report))
        .commit();
    // The message starting the second step sits in the broker's queue for a while.
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (!isStepRunAt(event, [1])) return undefined;
      queued.resolve();
      return { hold: deliver.promise };
    });
    const a = await startReplica(storage, build(tracked.reporter('A')), { pubsub });
    const b = await startReplica(storage, build(tracked.reporter('B')));
    const run = await a.workflow.createRun();
    const result = run.start({ inputData: { n: 1 } });
    await queued.promise;

    expect((await restartOutcome(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    deliver.resolve();
    expect((await result).status).toBe('success');
    expect(tracked.executions).toEqual(['A:first', 'A:second']);
  }, 20_000);

  it('refuses to restart a parallel run while a branch runs on another replica', async () => {
    const storage = new InMemoryStore();
    const branchA = Promise.withResolvers<void>();
    const branchB = Promise.withResolvers<void>();
    const executions: string[] = [];
    const started = { a: Promise.withResolvers<void>(), b: Promise.withResolvers<void>() };
    const build = (replica: string) =>
      shapes.parallel.build(async label => {
        executions.push(`${replica}:${label}`);
        if (replica === 'C') return;
        started[label as 'a' | 'b'].resolve();
        await (label === 'a' ? branchA : branchB).promise;
      });
    // Branch b's message goes to replica B instead of A.
    const diverted = Promise.withResolvers<Event>();
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event =>
      isStepRunAt(event, [0, 1]) ? { divert: diverted.resolve } : undefined,
    );
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const c = await startReplica(storage, build('C'));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    const onB = b.mastra.handleWorkflowEvent(await diverted.promise);
    await Promise.all([started.a.promise, started.b.promise]);

    expect((await restartOutcome(c, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    // Branch a finishes on A, and A has been idle for longer than a lease TTL; B still runs branch b.
    branchA.resolve();
    await vi.waitFor(async () => {
      const store = (await storage.getStore('workflows'))!;
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
      expect(snapshot?.context.a?.status).toBe('success');
    });
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
    expect((await restartOutcome(c, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

    branchB.resolve();
    expect(await onB).toEqual({ ok: true });
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(executions.sort()).toEqual(['A:a', 'B:b']);
  }, 20_000);

  it.each(['then', 'foreach'] as const)(
    'refuses to restart a parent run while a step of a nested workflow it started with .%s() runs',
    async kind => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const tracked = track({ blocks: ['inner:1'] });
      const build = (replica: string) => {
        const report = tracked.reporter(replica);
        const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
          .then(
            createStep({
              id: 'inner',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                await report(`inner:${inputData.n}`);
                return inputData;
              },
            }),
          )
          .commit();
        const parent =
          kind === 'then'
            ? createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(child).commit()
            : createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
                .foreach(child, { concurrency: 2 })
                .commit();
        return { parent: parent as unknown as Built, child: child as unknown as Built };
      };
      const onA = build('A');
      const onB = build('B');
      const a = await startReplica(storage, onA.parent, { nested: { child: onA.child } });
      const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
      const run = await a.workflow.createRun();
      const result = run.start({ inputData: (kind === 'then' ? { n: 1 } : [{ n: 1 }, { n: 2 }]) as any });
      await tracked.allBlocked;
      if (kind === 'foreach') {
        // The second item's nested run finished; only the first item's nested run still runs.
        await vi.waitFor(async () => {
          const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
          expect((snapshot?.context.child as { output?: unknown[] } | undefined)?.output?.[1]).toBeTruthy();
        });
      }

      // The parent's step only dispatched the nested run; its own liveness lapses while the nested step runs.
      await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
      expect((await restartOutcome(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

      tracked.release();
      expect((await result).status).toBe('success');
      expect(tracked.executions.sort()).toEqual(kind === 'then' ? ['A:inner:1'] : ['A:inner:1', 'A:inner:2']);
    },
    20_000,
  );
});
