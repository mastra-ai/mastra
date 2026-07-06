import type { ActorSignal } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { InngestExecutionEngine } from './execution-engine';
import { init } from './index';

/**
 * Hermetic tests for FGA `actor` signal threading through @mastra/inngest.
 *
 * These do NOT require an Inngest dev server. They exercise the two seams the
 * engine owns directly:
 *   1. The run/start path serializes `actor` into the Inngest event payload.
 *   2. `executeWorkflowStep` forwards `actor` across the nested-workflow
 *      `step.invoke()` serialization boundary so the nested run re-threads it.
 */
describe('@mastra/inngest actor signal threading (hermetic)', () => {
  const actor: ActorSignal = { actorKind: 'system', sourceWorkflow: 'nightly-workflow' };

  // Surface parity — every public Inngest path that maps to core actor-aware
  // execution flows into one of four run-level event sinks (or a nested invoke).
  // We assert `actor` at each distinct sink; shared sinks cover their callers:
  //
  //   public path        -> event sink              -> covered by
  //   start              -> _start                  -> "serializes actor on the start (_start) path"
  //   stream             -> _start                  -> (shared _start sink)
  //   streamLegacy       -> _start                  -> (shared _start sink)
  //   startAsync         -> startAsync (own send)    -> "serializes actor ... on the start path" (startAsync)
  //   resume             -> _resumeAndSendEvent      -> (shared resume sink)
  //   resumeAsync        -> _resumeAndSendEvent      -> "forwards a re-supplied actor through the resume event payload"
  //   timeTravel         -> _timeTravel              -> "serializes actor on the timeTravel path"
  //   timeTravelStream   -> _timeTravel              -> (shared _timeTravel sink)
  //   nested (start)     -> executeWorkflowStep      -> "forwards actor into the nested-workflow invoke payload"
  //   nested (resume)    -> executeWorkflowStep      -> "forwards actor into the nested-workflow RESUME invoke payload"

  it('forwards actor into the nested-workflow invoke payload (durable step boundary)', async () => {
    const inngest = new Inngest({ id: 'mastra-test' });
    const { createWorkflow, createStep } = init(inngest);

    const nestedStep = createStep({
      id: 'nested-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [nestedStep],
    })
      .then(nestedStep)
      .commit();

    // Capture the data handed to inngestStep.invoke (the serialization boundary).
    const invokeData: any[] = [];
    const fakeStep: any = {
      run: async (_id: string, fn: () => Promise<any>) => fn(),
      invoke: async (_id: string, opts: { function: any; data: any }) => {
        invokeData.push(opts.data);
        return { result: { status: 'success', result: { value: 'ok' }, state: {} }, runId: 'nested-run' };
      },
      sleep: async () => {},
      sleepUntil: async () => {},
    };

    const engine = new InngestExecutionEngine({} as Mastra, fakeStep, 0, {});
    const pubsub: any = { publish: vi.fn().mockResolvedValue(undefined) };

    const result = await engine.executeWorkflowStep({
      step: nestedWorkflow as any,
      stepResults: {},
      executionContext: {
        workflowId: 'parent-workflow',
        runId: 'parent-run',
        executionPath: [0],
        suspendedPaths: {},
        state: {},
      } as any,
      prevOutput: {},
      inputData: { value: 'ok' },
      pubsub,
      startedAt: Date.now(),
      actor,
    } as any);

    expect(result?.status).toBe('success');
    expect(invokeData).toHaveLength(1);
    expect(invokeData[0].actor).toEqual(actor);
  });

  it('serializes actor into the Inngest event payload on the start path', async () => {
    const inngest = new Inngest({ id: 'mastra-test' });
    const { createWorkflow, createStep } = init(inngest);

    const step = createStep({
      id: 'step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });

    const workflow = createWorkflow({
      id: 'actor-start-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step],
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'actor-start-workflow': workflow as any },
    });
    workflow.__registerMastra(mastra);

    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-1'] } as any);

    const run = await workflow.createRun();
    await run.startAsync({ inputData: { value: 'ok' }, actor });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentData = (sendSpy.mock.calls[0]![0] as any).data;
    expect(sentData.actor).toEqual(actor);
  });

  it('forwards a re-supplied actor through the resume event payload (per-call contract)', async () => {
    // `actor` is intentionally NOT rehydrated from the snapshot (matching the default
    // engine — see packages/core/src/workflows/workflow.ts `_resume`). A trusted resumer
    // re-supplies it on each resume; this locks in that per-call contract.
    const inngest = new Inngest({ id: 'mastra-test' });
    const { createWorkflow, createStep } = init(inngest);

    const step = createStep({
      id: 'suspendable-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });

    const workflow = createWorkflow({
      id: 'actor-resume-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step],
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'actor-resume-workflow': workflow as any },
    });
    workflow.__registerMastra(mastra);

    const run = await workflow.createRun();

    // Persist a suspended snapshot so the resume path has something to load.
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: 'actor-resume-workflow',
      runId: run.runId,
      snapshot: {
        runId: run.runId,
        serializedStepGraph: [],
        status: 'suspended',
        value: {},
        context: { input: { value: 'ok' } },
        activePaths: [],
        suspendedPaths: { 'suspendable-step': [0] },
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      } as any,
    });

    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-resume'] } as any);

    await run.resumeAsync({ resumeData: { value: 'ok' }, step: 'suspendable-step', actor });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentData = (sendSpy.mock.calls[0]![0] as any).data;
    expect(sentData.actor).toEqual(actor);
  });

  it('serializes actor on the start (_start) path', async () => {
    // Covers start + stream + streamLegacy, which all funnel through `_start`.
    const inngest = new Inngest({ id: 'mastra-test' });
    const { createWorkflow, createStep } = init(inngest);

    const step = createStep({
      id: 's',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'actor-start-sink-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step],
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'actor-start-sink-workflow': workflow as any },
    });
    workflow.__registerMastra(mastra);

    const run = await workflow.createRun();
    // start() awaits getRunOutput, which polls a live Inngest server; stub it so the
    // hermetic test exercises only the `_start` event-send sink.
    vi.spyOn(run as any, 'getRunOutput').mockResolvedValue({ output: { result: { status: 'success' } } });
    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-start'] } as any);

    await run.start({ inputData: { value: 'ok' }, actor });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect((sendSpy.mock.calls[0]![0] as any).data.actor).toEqual(actor);
  });

  it('serializes actor on the timeTravel path', async () => {
    // Covers timeTravel + timeTravelStream, which both funnel through `_timeTravel`.
    const inngest = new Inngest({ id: 'mastra-test' });
    const { createWorkflow, createStep } = init(inngest);

    const step = createStep({
      id: 's',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({
      id: 'actor-tt-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [step],
    })
      .then(step)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'actor-tt-workflow': workflow as any },
    });
    workflow.__registerMastra(mastra);

    const run = await workflow.createRun();
    // A completed snapshot to load + rebuild time-travel execution params from.
    const store = await mastra.getStorage()!.getStore('workflows');
    await store!.persistWorkflowSnapshot({
      workflowName: 'actor-tt-workflow',
      runId: run.runId,
      snapshot: {
        runId: run.runId,
        serializedStepGraph: [],
        status: 'success',
        value: {},
        context: { input: { value: 'ok' } },
        activePaths: [],
        suspendedPaths: {},
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      } as any,
    });

    vi.spyOn(run as any, 'getRunOutput').mockResolvedValue({ output: { result: { status: 'success' } } });
    const sendSpy = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-tt'] } as any);

    await run.timeTravel({ step: 's', inputData: { value: 'ok' }, actor });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect((sendSpy.mock.calls[0]![0] as any).data.actor).toEqual(actor);
  });

  it('forwards actor into the nested-workflow RESUME invoke payload', async () => {
    // The resume branch of executeWorkflowStep is a distinct invoke site from the
    // start-time branch — this is the durable-boundary-on-resume case.
    const inngest = new Inngest({ id: 'mastra-test' });
    const { createWorkflow, createStep } = init(inngest);

    const nestedStep = createStep({
      id: 'nested-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const nestedWorkflow = createWorkflow({
      id: 'nested-resume-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      steps: [nestedStep],
    })
      .then(nestedStep)
      .commit();

    const invokeData: any[] = [];
    const fakeStep: any = {
      run: async (_id: string, fn: () => Promise<any>) => fn(),
      invoke: async (_id: string, opts: { function: any; data: any }) => {
        invokeData.push(opts.data);
        return { result: { status: 'success', result: { value: 'ok' }, state: {} }, runId: 'nested-run' };
      },
      sleep: async () => {},
      sleepUntil: async () => {},
    };

    // The resume branch loads a snapshot via mastra storage, so give the engine a real store.
    const mastra = new Mastra({ logger: false, storage: new MockStore() });
    const engine = new InngestExecutionEngine(mastra, fakeStep, 0, {});
    const pubsub: any = { publish: vi.fn().mockResolvedValue(undefined) };

    const result = await engine.executeWorkflowStep({
      step: nestedWorkflow as any,
      stepResults: {},
      executionContext: {
        workflowId: 'parent',
        runId: 'parent-run',
        executionPath: [0],
        suspendedPaths: {},
        state: {},
      } as any,
      resume: { steps: ['nested-step'], resumePayload: { value: 'ok' } },
      prevOutput: {},
      inputData: { value: 'ok' },
      pubsub,
      startedAt: Date.now(),
      actor,
    } as any);

    expect(result?.status).toBe('success');
    expect(invokeData).toHaveLength(1);
    expect(invokeData[0].resume).toBeDefined(); // confirms we hit the resume branch
    expect(invokeData[0].actor).toEqual(actor);
  });
});
