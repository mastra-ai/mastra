import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { computeScheduleDefinitionHash } from '../../scheduler/definition-hash';

function makeStartEvent(workflowId: string, runId: string): Event {
  return {
    type: 'workflow.start',
    runId,
    data: {
      workflowId,
      runId,
      executionPath: [0],
      stepResults: {},
      prevResult: { status: 'success', output: {} },
      activeSteps: {},
      requestContext: {},
    },
  } as Event;
}

describe('WorkflowEventProcessor #dispatch', () => {
  it('resolves the workflow by its `id` even when registered under a different key (issue #16471)', async () => {
    // Workflow has id "daily-report" but is registered as { dailyReport }.
    // The scheduler emits `workflow.start` with workflowId="daily-report",
    // and that lookup must succeed.
    const wf = createWorkflow({
      id: 'daily-report',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    wf.then(
      createStep({
        id: 'noop',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      }) as any,
    ).commit();

    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      // Note: registration key `dailyReport` !== workflow.id `daily-report`.
      workflows: { dailyReport: wf } as any,
      pubsub,
    });

    const result = await mastra.handleWorkflowEvent(makeStartEvent('daily-report', 'run-1'));

    expect(result).toEqual({ ok: true });

    await mastra.shutdown();
  });

  it('does not retry indefinitely when the workflow is no longer registered', async () => {
    // Simulates a scheduled workflow whose definition was deleted from code.
    // Scheduler publishes `workflow.start` for the missing workflow; the
    // processor must terminate it instead of returning retry:true forever.
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: {} as any,
      pubsub,
    });

    const failEvents: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.fail') failEvents.push(event);
    });

    const result = await mastra.handleWorkflowEvent(makeStartEvent('ghost-workflow', 'run-1'));

    // Must NOT be a retryable failure — otherwise the transport redelivers
    // the event infinitely.
    expect(result).toEqual({ ok: true });
    // errorWorkflow() should have published a single workflow.fail event so
    // any downstream listeners (storage, watchers) can finalize the run.
    expect(failEvents.length).toBeGreaterThanOrEqual(1);

    // A follow-up workflow.fail event for the same missing workflow must
    // also terminate (it would otherwise loop back through #dispatch and
    // re-trigger errorWorkflow forever).
    const followUp = await mastra.handleWorkflowEvent({
      type: 'workflow.fail',
      runId: 'run-1',
      data: {
        workflowId: 'ghost-workflow',
        runId: 'run-1',
        executionPath: [],
        stepResults: {},
        prevResult: { status: 'failed', error: { message: 'gone' } as any },
        activeSteps: {},
        requestContext: {},
      },
    } as Event);
    expect(followUp).toEqual({ ok: true });

    await mastra.shutdown();
  });

  describe('stale scheduled-definition fence (#19169)', () => {
    // Builds a workflow whose graph (and therefore hash) depends on `steps`,
    // letting a test stand in for "this instance is running an older build".
    const makeWorkflow = (steps: string[]) => {
      const wf = createWorkflow({
        id: 'fenced-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
      });
      let chain: any = wf;
      for (const id of steps) {
        chain = chain.then(
          createStep({
            id,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            execute: async () => ({}),
          }) as any,
        );
      }
      chain.commit();
      return wf;
    };

    const RUN_ID = 'sched_wf_fenced-wf_1700000000000';

    /**
     * Dispatch is event-driven: a fire that is allowed through emits the
     * `workflow-start` watch event and begins stepping, while a refused fire
     * emits nothing at all. Collecting published events is therefore the
     * observable that actually distinguishes the two.
     */
    const makeMastra = (wf: any) => {
      const pubsub = new EventEmitterPubSub();
      const started: Event[] = [];
      void pubsub.subscribe(`workflow.events.v2.${RUN_ID}`, async event => {
        if ((event.data as any)?.type === 'workflow-start') started.push(event);
      });
      const mastra = new Mastra({
        logger: false,
        storage: new MockStore(),
        workflows: { fencedWf: wf } as any,
        pubsub,
      });
      return { mastra, started };
    };

    const fire = (mastra: Mastra, scheduleDefinitionHash?: string) => {
      const event = makeStartEvent('fenced-wf', RUN_ID);
      (event.data as any).scheduleDefinitionHash = scheduleDefinitionHash;
      return mastra.handleWorkflowEvent(event);
    };

    it('refuses a fire whose hash does not match the locally registered definition', async () => {
      // This instance is the straggler: it only knows the pre-gate graph.
      const staleWf = makeWorkflow(['side-effect']);
      const { mastra, started } = makeMastra(staleWf);

      // The schedule row was written by the current build, which added a gate
      // step ahead of the side effect — so its hash differs from ours.
      const currentWf = makeWorkflow(['gate', 'side-effect']);
      const currentHash = computeScheduleDefinitionHash(currentWf.serializedStepGraph);
      expect(currentHash).toBeDefined();
      expect(currentHash).not.toBe(computeScheduleDefinitionHash(staleWf.serializedStepGraph));

      await fire(mastra, currentHash);

      // The whole point of the issue: the old graph must not start executing
      // just because the gate step didn't exist in this build.
      expect(started).toHaveLength(0);

      await mastra.shutdown();
    });

    it('runs the fire when the local definition matches the schedule row', async () => {
      const wf = makeWorkflow(['side-effect']);
      const { mastra, started } = makeMastra(wf);

      await fire(mastra, computeScheduleDefinitionHash(wf.serializedStepGraph));

      expect(started).toHaveLength(1);

      await mastra.shutdown();
    });

    it('fails open when the event carries no definition hash', async () => {
      const wf = makeWorkflow(['side-effect']);
      const { mastra, started } = makeMastra(wf);

      // Imperative/legacy schedules and every non-scheduled run land here.
      await fire(mastra, undefined);

      expect(started).toHaveLength(1);

      await mastra.shutdown();
    });

    it('records a failed trigger so a refused fire is visible in schedule history', async () => {
      const wf = makeWorkflow(['side-effect']);
      const { mastra } = makeMastra(wf);
      const store = await mastra.getStorage()!.getStore('schedules');
      await store.createSchedule({
        id: 'wf_fenced-wf',
        target: { type: 'workflow', workflowId: 'fenced-wf' },
        cron: '0 0 1 1 *',
        status: 'active',
        nextFireAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await fire(mastra, 'ffffffffffffffff');

      const triggers = await store.listTriggers('wf_fenced-wf');
      expect(triggers).toHaveLength(1);
      expect(triggers[0]!.outcome).toBe('failed');
      expect(triggers[0]!.scheduledFireAt).toBe(1700000000000);
      expect(triggers[0]!.error).toContain('Stale workflow definition');

      await mastra.shutdown();
    });
  });
});
