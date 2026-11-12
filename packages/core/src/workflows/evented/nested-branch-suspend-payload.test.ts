/**
 * Regression for https://github.com/mastra-ai/mastra/issues/29728.
 *
 * When a step suspends inside a nested workflow's `.parallel()` or `.branch()`, the
 * parent run must report the step's suspend() payload, the resume labels, and a path
 * to a step that is still suspended — on both engines.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

const engines = [
  { engine: 'default', createWorkflow: createDefaultWorkflow, createStep: createDefaultStep, evented: false },
  { engine: 'evented', createWorkflow: createEventedWorkflow, createStep: createEventedStep, evented: true },
] as const;

const item = z.object({ n: z.number() });

describe.each(engines)('$engine engine: nested branch/parallel suspend', ({ createWorkflow, createStep, evented }) => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    if (evented) {
      await mastra?.stopWorkers();
    }
    mastra = undefined;
  });

  async function setup(workflows: Record<string, any>) {
    const storage = new MockStore();
    mastra = new Mastra({
      logger: false,
      storage,
      ...(evented ? { pubsub: new EventEmitterPubSub() } : {}),
      workflows,
    });
    if (evented) {
      await mastra.startWorkers();
    }
    const store = (await storage.getStore('workflows'))!;
    return {
      run: () => mastra!.getWorkflow('order').createRun(),
      parentSnapshot: (runId: string) => store.loadWorkflowSnapshot({ workflowName: 'order', runId }),
    };
  }

  function buildParallel() {
    const approval = (id: string) =>
      createStep({
        id,
        inputSchema: item,
        outputSchema: z.object({ approvedBy: z.string() }),
        resumeSchema: z.object({ approver: z.string() }),
        execute: async ({ resumeData, suspend }: any) =>
          resumeData === undefined
            ? await suspend({ approval: id }, { resumeLabel: `approve-${id}` })
            : { approvedBy: resumeData.approver },
      });
    const review = createWorkflow({ id: 'review', inputSchema: item, outputSchema: z.any() })
      .parallel([approval('a'), approval('b')])
      .commit();
    const order = createWorkflow({ id: 'order', inputSchema: item, outputSchema: z.any() }).then(review).commit();
    return { order, review };
  }

  it('reports the suspend payload and resume labels of a nested .parallel()', async () => {
    const { run, parentSnapshot } = await setup(buildParallel());
    const r = await run();
    const result: any = await r.start({ inputData: { n: 0 } });

    expect(result.status).toBe('suspended');
    const [path] = result.suspended;
    expect(path[0]).toBe('review');
    expect(['a', 'b']).toContain(path[1]);
    expect(result.steps.review.suspendPayload.approval).toBe(path[1]);

    const snapshot = await parentSnapshot(r.runId);
    expect(Object.keys(snapshot?.resumeLabels ?? {}).sort()).toEqual(['approve-a', 'approve-b']);
  });

  it('points at a still-suspended step after one of two suspended steps is resumed', async () => {
    const { run } = await setup(buildParallel());
    const r = await run();
    let result: any = await r.start({ inputData: { n: 0 } });

    const resumed: string[] = [];
    for (const approver of ['alice', 'bob', 'carol']) {
      if (result.status !== 'suspended') break;
      const step = result.suspended[0];
      resumed.push(step[1]);
      result = await r.resume({ step, resumeData: { approver } });
      if (result.status === 'suspended') {
        expect(result.steps.review.suspendPayload.approval).toBe(result.suspended[0][1]);
      }
    }

    expect(result.status).toBe('success');
    expect(resumed).toHaveLength(2);
    expect(new Set(resumed).size).toBe(2);
    expect(result.result).toEqual({
      [resumed[0]!]: { approvedBy: 'alice' },
      [resumed[1]!]: { approvedBy: 'bob' },
    });
  });

  it('resumes the step a label names inside a nested .parallel()', async () => {
    const { run } = await setup(buildParallel());
    const r = await run();
    await r.start({ inputData: { n: 0 } });

    let result: any = await r.resume({ label: 'approve-b', resumeData: { approver: 'alice' } });
    expect(result.status).toBe('suspended');
    expect(result.suspended[0]).toEqual(['review', 'a']);

    result = await r.resume({ label: 'approve-a', resumeData: { approver: 'bob' } });
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ a: { approvedBy: 'bob' }, b: { approvedBy: 'alice' } });
  });

  it('reports the suspend payload and resume label of a nested .branch()', async () => {
    const ask = createStep({
      id: 'ask',
      inputSchema: item,
      outputSchema: z.object({ answer: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async ({ resumeData, suspend }: any) =>
        resumeData === undefined
          ? await suspend({ reason: 'need input' }, { resumeLabel: 'lbl' })
          : { answer: resumeData.answer },
    });
    const inner = createWorkflow({ id: 'inner', inputSchema: item, outputSchema: z.any() })
      .branch([[async () => true, ask]])
      .commit();
    const order = createWorkflow({ id: 'order', inputSchema: item, outputSchema: z.any() }).then(inner).commit();

    const { run, parentSnapshot } = await setup({ order, inner });
    const r = await run();
    let result: any = await r.start({ inputData: { n: 0 } });

    expect(result.status).toBe('suspended');
    expect(result.suspended[0]).toEqual(['inner', 'ask']);
    expect(result.steps.inner.suspendPayload.reason).toBe('need input');
    const snapshot = await parentSnapshot(r.runId);
    expect(Object.keys(snapshot?.resumeLabels ?? {})).toEqual(['lbl']);

    result = await r.resume({ step: result.suspended[0], resumeData: { answer: 'yes' } });
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ ask: { answer: 'yes' } });
  });
});
