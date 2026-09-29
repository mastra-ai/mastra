import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createWorkflow } from '../../create';
import { computeScheduleDefinitionHash } from '../../scheduler/definition-hash';
import type { ScheduledWorkflowTrigger } from '../../scheduler/types';
import { createStep } from '../../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '../workflow';

const SCHEDULE_ID = 'wf_nightly';
const FIRE_AT = 1_700_000_000_000;
const RUN_ID = `sched_${SCHEDULE_ID}_${FIRE_AT}`;

type StepExecute = (args: { inputData: any; state: any; requestContext: any }) => Promise<unknown>;

function buildDefaultWorkflow(execute: StepExecute, inputSchema: z.ZodType = z.object({ n: z.number() })) {
  const wf = createWorkflow({
    id: 'nightly',
    inputSchema,
    outputSchema: z.any(),
    stateSchema: z.object({ seen: z.string().optional() }),
  });
  wf.then(
    createStep({
      id: 'record',
      inputSchema,
      outputSchema: z.any(),
      stateSchema: z.object({ seen: z.string().optional() }),
      execute: execute as any,
    }),
  ).commit();
  return wf;
}

function buildEventedWorkflow(execute: StepExecute) {
  const wf = createEventedWorkflow({ id: 'nightly', inputSchema: z.object({ n: z.number() }), outputSchema: z.any() });
  wf.then(
    createEventedStep({
      id: 'record',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.any(),
      execute: execute as any,
    }) as any,
  ).commit();
  return wf;
}

function makeStartEvent(
  overrides: {
    scheduleTrigger?: ScheduledWorkflowTrigger;
    scheduleDefinitionHash?: string;
    parentWorkflow?: unknown;
    inputData?: unknown;
  } = {},
): Event {
  return {
    type: 'workflow.start',
    runId: RUN_ID,
    data: {
      workflowId: 'nightly',
      runId: RUN_ID,
      executionPath: [0],
      stepResults: {},
      prevResult: { status: 'success', output: 'inputData' in overrides ? overrides.inputData : { n: 7 } },
      activeSteps: {},
      requestContext: { tenant: 'acme' },
      initialState: { seen: 'initial' },
      ...(overrides.scheduleTrigger ? { scheduleTrigger: overrides.scheduleTrigger } : {}),
      ...(overrides.scheduleDefinitionHash ? { scheduleDefinitionHash: overrides.scheduleDefinitionHash } : {}),
      ...(overrides.parentWorkflow ? { parentWorkflow: overrides.parentWorkflow } : {}),
    },
  } as Event;
}

const trigger = (triggerKind: ScheduledWorkflowTrigger['triggerKind'] = 'schedule-fire'): ScheduledWorkflowTrigger => ({
  scheduleId: SCHEDULE_ID,
  scheduledFireAt: FIRE_AT,
  triggerKind,
});

async function setup(wf: { id: string }, extraWorkflows: Record<string, unknown> = {}) {
  const pubsub = new EventEmitterPubSub();
  const workflowEvents: Event[] = [];
  const watchEvents: Event[] = [];
  await pubsub.subscribe('workflows', async event => {
    workflowEvents.push(event);
  });
  await pubsub.subscribe(`workflow.events.v2.${RUN_ID}`, async event => {
    watchEvents.push(event);
  });
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { nightly: wf, ...extraWorkflows } as any,
    pubsub,
  });
  const schedules = await mastra.getStorage()!.getStore('schedules');
  await schedules!.createSchedule({
    id: SCHEDULE_ID,
    target: { type: 'workflow', workflowId: 'nightly' },
    cron: '0 0 1 1 *',
    status: 'active',
    nextFireAt: FIRE_AT,
    createdAt: FIRE_AT,
    updatedAt: FIRE_AT,
  });
  const stepRuns = () => workflowEvents.filter(e => e.type === 'workflow.step.run');
  const workflowStartWatches = () => watchEvents.filter(e => (e.data as any)?.type === 'workflow-start');
  return { mastra, schedules: schedules!, workflowEvents, stepRuns, workflowStartWatches };
}

describe('WorkflowEventProcessor — scheduled default-engine fires (#18807)', () => {
  it('runs the fire in-process instead of stepping it through the evented engine', async () => {
    const execute = vi.fn<StepExecute>(async ({ inputData, state, requestContext }) => ({
      n: inputData.n,
      seen: state.seen,
      tenant: requestContext.get('tenant'),
    }));
    const wf = buildDefaultWorkflow(execute);
    expect(wf.engineType).toBe('default');
    const { mastra, stepRuns, workflowStartWatches } = await setup(wf);

    const result = await mastra.handleWorkflowEvent(makeStartEvent({ scheduleTrigger: trigger() }));

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(1);
    const run = await wf.getWorkflowRunById(RUN_ID);
    expect(run?.status).toBe('success');
    expect((run?.steps as any)?.record?.output).toEqual({ n: 7, seen: 'initial', tenant: 'acme' });
    expect(stepRuns()).toHaveLength(0);
    // The default engine streams on its own run-scoped pubsub, so an evented
    // `workflow-start` here would be a start with no matching finish.
    expect(workflowStartWatches()).toHaveLength(0);

    await mastra.shutdown();
  });

  it('skips a redelivered fire for a run that already exists', async () => {
    const execute = vi.fn<StepExecute>(async ({ inputData }) => inputData);
    const wf = buildDefaultWorkflow(execute);
    const { mastra } = await setup(wf);

    await mastra.handleWorkflowEvent(makeStartEvent({ scheduleTrigger: trigger() }));
    const result = await mastra.handleWorkflowEvent(makeStartEvent({ scheduleTrigger: trigger() }));

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(1);

    await mastra.shutdown();
  });

  it('refuses a fire whose definition hash is stale and records it', async () => {
    const execute = vi.fn<StepExecute>(async ({ inputData }) => inputData);
    const wf = buildDefaultWorkflow(execute);
    expect(computeScheduleDefinitionHash(wf.serializedStepGraph)).not.toBe('ffffffffffffffff');
    const { mastra, schedules } = await setup(wf);

    await mastra.handleWorkflowEvent(
      makeStartEvent({ scheduleTrigger: trigger(), scheduleDefinitionHash: 'ffffffffffffffff' }),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(await wf.getWorkflowRunById(RUN_ID)).toBeNull();
    const triggers = await schedules.listTriggers(SCHEDULE_ID);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({ outcome: 'failed', scheduledFireAt: FIRE_AT });
    expect(triggers[0]!.error).toContain('Stale workflow definition');

    await mastra.shutdown();
  });

  it('records a failed trigger when run.start() rejects, without retrying or failing through the evented engine', async () => {
    const execute = vi.fn<StepExecute>(async ({ inputData }) => inputData);
    const wf = buildDefaultWorkflow(execute);
    const { mastra, schedules, workflowEvents } = await setup(wf);

    // Violates the workflow's inputSchema, so `run.start()` rejects before any step runs.
    const result = await mastra.handleWorkflowEvent(
      makeStartEvent({ scheduleTrigger: trigger('manual'), inputData: { n: 'not-a-number' } }),
    );

    expect(result).toEqual({ ok: true });
    expect(execute).not.toHaveBeenCalled();
    const triggers = await schedules.listTriggers(SCHEDULE_ID);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      runId: RUN_ID,
      outcome: 'failed',
      scheduledFireAt: FIRE_AT,
      triggerKind: 'manual',
    });
    expect(triggers[0]!.error).toBeTruthy();
    expect(workflowEvents.filter(e => e.type === 'workflow.fail')).toHaveLength(0);

    await mastra.shutdown();
  });

  it('keeps stepping unmarked default-engine starts through the evented engine', async () => {
    const wf = buildDefaultWorkflow(async ({ inputData }) => inputData);
    const { mastra, stepRuns } = await setup(wf);

    await mastra.handleWorkflowEvent(makeStartEvent());

    expect(stepRuns()).toHaveLength(1);

    await mastra.shutdown();
  });

  it('keeps stepping marked evented-engine starts through the evented engine', async () => {
    const execute = vi.fn<StepExecute>(async ({ inputData }) => inputData);
    const wf = buildEventedWorkflow(execute);
    expect(wf.engineType).toBe('evented');
    const { mastra, stepRuns } = await setup(wf);

    await mastra.handleWorkflowEvent(makeStartEvent({ scheduleTrigger: trigger() }));

    expect(stepRuns()).toHaveLength(1);

    await mastra.shutdown();
  });

  it('keeps stepping marked starts that belong to a parent workflow through the evented engine', async () => {
    const execute = vi.fn<StepExecute>(async ({ inputData }) => inputData);
    const wf = buildDefaultWorkflow(execute);
    const parent = createWorkflow({ id: 'parent', inputSchema: z.object({ n: z.number() }), outputSchema: z.any() });
    parent.then(wf).commit();
    const { mastra, stepRuns } = await setup(wf, { parent });

    // A nested child start carries its parent's descriptor; a marker spread in
    // from the parent's payload must not pull it out of the parent's run.
    await mastra.handleWorkflowEvent(
      makeStartEvent({
        scheduleTrigger: trigger(),
        parentWorkflow: {
          workflowId: 'parent',
          runId: 'parent-run',
          executionPath: [0],
          resume: false,
          stepResults: {},
          stepId: 'nightly',
          stepGraph: parent.stepGraph,
          activeStepsPath: {},
          resumeSteps: [],
        },
      }),
    );

    expect(execute).not.toHaveBeenCalled();
    expect(stepRuns()).toHaveLength(1);

    await mastra.shutdown();
  });
});
