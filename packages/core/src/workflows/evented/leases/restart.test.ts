/**
 * Booting replicas restart every active evented run they find, including runs
 * another replica is still executing (#28712). `restart()` refuses while the
 * run's own liveness key is live, which the run's events and those of the runs
 * nested under it keep fresh, so each step runs once however many replicas
 * boot. These cases cover that refusal and concurrent restarts.
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
  holdEvents,
  interceptWorkflowEvents,
  isStepRunAt,
  recordLeases,
  restartOutcome,
  runIsLive,
  runStatus,
  scanning,
  shapes,
  sleep,
  startReplica,
  stepRunningOnA,
  stopReplicas,
  track,
} from '../test-utils/lease-replicas';
import type { Built } from '../test-utils/lease-replicas';
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

    // Their recovery loops look again once the leases could have lapsed, and one of them recovers the run.
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

  it('leaves a run to the replica running it when two replicas boot', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: ['a'] });
    const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')));
    const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')), { recovery: scanning });
    const c = await startReplica(storage, shapes.step.build(tracked.reporter('C')), { recovery: scanning });
    const run = await a.workflow.createRun();
    await run.startAsync({ inputData: { n: 1 } });
    await tracked.allBlocked;
    const blockedSince = Date.now();

    // Both boot calls leave the run alone, and so do the recovery loops ticking on while A keeps
    // the run live for longer than the liveness TTL.
    const leases = await recordLeases(storage);
    await Promise.all([b.mastra.restartAllActiveWorkflowRuns(), c.mastra.restartAllActiveWorkflowRuns()]);
    await leases.until(() => leases.reads.filter(key => key === runLivenessKey(run.runId)).length >= 3);
    await sleep(Math.max(0, blockedSince + WORKFLOW_RUN_LEASE_TTL_MS * 2 - Date.now()));

    tracked.release();
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(tracked.executions).toEqual(['A:a']);
  }, 20_000);

  it.each([
    ['its start event is still queued', false],
    ['its first step event is queued after its start event sat queued for a lease TTL', true],
  ] as const)(
    'leaves a just-started run to its replica while %s',
    async (_, startQueuedPastTtl) => {
      const storage = new InMemoryStore();
      const tracked = track({ blocks: [] });
      // The events that start the run and its first step sit in the broker's queue for a while.
      const start = holdEvents(event => event.type === 'workflow.start');
      const step = holdEvents(event => startQueuedPastTtl && isStepRunAt(event, [0]), start.pubsub);
      const a = await startReplica(storage, shapes.step.build(tracked.reporter('A')), { pubsub: step.pubsub });
      const b = await startReplica(storage, shapes.step.build(tracked.reporter('B')));
      const run = await a.workflow.createRun();
      // startAsync() resolves once its start event is published, which the queue holds back here.
      const started = run.startAsync({ inputData: { n: 1 } });
      await start.held;
      if (startQueuedPastTtl) {
        // The liveness the caller wrote lapses; the worker taking the start event writes it again.
        await vi.waitFor(async () => expect(await runIsLive(storage, run.runId)).toBe(false), {
          timeout: WORKFLOW_RUN_LEASE_TTL_MS * 2,
        });
        start.deliver();
        await step.held;
      }

      await b.mastra.restartAllActiveWorkflowRuns();
      start.deliver();
      step.deliver();
      await started;

      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

  it('leaves a time-travelled run to its replica while its start event is still queued', async () => {
    const storage = new InMemoryStore();
    const executions: string[] = [];
    let holding = false;
    const queue = holdEvents(event => holding && event.type === 'workflow.start');
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
    const a = await startReplica(storage, build('A'), { pubsub: queue.pubsub });
    const b = await startReplica(storage, build('B'));
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('failed');
    // The failed run's liveness lapses before it is time travelled.
    await vi.waitFor(async () => expect(await runIsLive(storage, run.runId)).toBe(false), {
      timeout: WORKFLOW_RUN_LEASE_TTL_MS * 2,
    });

    holding = true;
    const travelled = (await a.workflow.createRun({ runId: run.runId })).timeTravel({ step: 'a', inputData: { n: 2 } });
    await queue.held;
    await b.mastra.restartAllActiveWorkflowRuns();
    queue.deliver();

    expect((await travelled).status).toBe('success');
    expect(executions).toEqual(['A:1', 'A:2']);
  }, 20_000);

  it('leaves a parent run to its replica while the resume of its nested run is still queued', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    let holding = false;
    const queue = holdEvents(event => holding && event.type === 'workflow.resume');
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
    const a = await startReplica(storage, onA.parent, { pubsub: queue.pubsub, nested: { child: onA.child } });
    const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('suspended');
    const parentSnapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
    const nestedRunId = (parentSnapshot?.context.child as { suspendPayload?: any }).suspendPayload?.__workflow_meta
      ?.runId as string;
    // The suspended runs' liveness lapses before the nested run is resumed.
    await vi.waitFor(
      async () =>
        expect([await runIsLive(storage, run.runId), await runIsLive(storage, nestedRunId)]).toEqual([false, false]),
      { timeout: WORKFLOW_RUN_LEASE_TTL_MS * 2 },
    );

    // Resuming the nested run directly makes its parent `running` again too.
    holding = true;
    const resumed = (await onA.child.createRun({ runId: nestedRunId })).resume({ resumeData: { approved: true } });
    await queue.held;
    await b.mastra.restartAllActiveWorkflowRuns();
    queue.deliver();

    expect((await resumed).status).toBe('success');
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    expect(executions).toEqual(['A:suspended', 'A:resumed']);
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

  it('marks a run live before its restart is published', async () => {
    // The restart's start event sits in the broker's queue; no worker has handled it yet.
    const queue = holdEvents(event => event.type === 'workflow.start');
    const { storage, a, b, run } = await stepRunningOnA({ hangForever: true, b: { pubsub: queue.pubsub } });
    await crash(a, storage, [stepOccurrenceKey(run.runId, [0]), runLivenessKey(run.runId)]);
    expect(await runIsLive(storage, run.runId)).toBe(false);

    const restarted = restartOutcome(b, run.runId);
    await queue.held;
    expect(await runIsLive(storage, run.runId)).toBe(true);
    queue.deliver();
    expect((await restarted).id).toBe('resolved:success');
  }, 20_000);
});
