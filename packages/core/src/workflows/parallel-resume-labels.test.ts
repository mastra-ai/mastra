import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createWorkflowStateReader } from './state-reader';
import { createStep } from './workflow';

/**
 * When several steps are suspended with resume labels and only one of them is
 * resumed, the labels of the steps that are still suspended must stay in the
 * stored run so later label-based resumes reach the right step.
 */

const approvalSchemas = {
  inputSchema: z.object({}),
  outputSchema: z.object({ approvedBy: z.string() }),
  suspendSchema: z.object({ step: z.string() }),
  resumeSchema: z.object({ approvedBy: z.string() }),
};

function createApprovalStep(id: string) {
  return createStep({
    id,
    ...approvalSchemas,
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) {
        await suspend({ step: id }, { resumeLabel: `approve-${id}` });
        return { approvedBy: '' };
      }
      return { approvedBy: resumeData.approvedBy };
    },
  });
}

function createParallelWorkflow(id: string) {
  const a = createApprovalStep('a');
  const b = createApprovalStep('b');
  const c = createApprovalStep('c');
  const workflow = createWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.any(),
    steps: [a, b, c],
    options: { validateInputs: false },
  })
    .parallel([a, b, c])
    .commit();
  const storage = new MockStore();
  new Mastra({ logger: false, storage, workflows: { [id]: workflow } });
  return workflow;
}

async function readLabels(workflow: { getWorkflowRunById: (runId: string) => Promise<any> }, runId: string) {
  const run = await workflow.getWorkflowRunById(runId);
  const reader = createWorkflowStateReader(run);
  return { reader, labels: Object.keys(reader.getResumeLabels()).sort() };
}

describe('resume labels of still-suspended steps survive a partial resume', () => {
  it('keeps sibling labels in a parallel block so recovery by label resumes the right step', async () => {
    const workflow = createParallelWorkflow('parallel-label-recovery');
    const run = await workflow.createRun();
    const started = await run.start({ inputData: {} });
    expect(started.status).toBe('suspended');

    const approvals: Array<[string, string, string[]]> = [
      ['approve-a', 'alice', ['approve-a', 'approve-b', 'approve-c']],
      ['approve-c', 'carol', ['approve-b', 'approve-c']],
      ['approve-b', 'bob', ['approve-b']],
    ];

    let result: any;
    for (const [label, approvedBy, expectedLabels] of approvals) {
      const { reader, labels } = await readLabels(workflow, run.runId);
      expect(labels).toEqual(expectedLabels);

      const recovered = await workflow.createRun({ runId: run.runId });
      result = await recovered.resume({
        step: reader.getResumeLabel(label)?.stepId ?? reader.getSuspendedStep()?.path,
        resumeData: { approvedBy },
      } as any);
    }

    expect(result.status).toBe('success');
    expect(result.result).toEqual({
      a: { approvedBy: 'alice' },
      b: { approvedBy: 'bob' },
      c: { approvedBy: 'carol' },
    });

    const { labels } = await readLabels(workflow, run.runId);
    expect(labels).toEqual([]);
  });

  it('keeps sibling labels when resuming by label', async () => {
    const workflow = createParallelWorkflow('parallel-label-resume');
    const run = await workflow.createRun();
    await run.start({ inputData: {} });

    const first = await run.resume({ label: 'approve-b', resumeData: { approvedBy: 'bob' } });
    expect(first.status).toBe('suspended');
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-a', 'approve-c']);

    const second = await run.resume({ label: 'approve-c', resumeData: { approvedBy: 'carol' } });
    expect(second.status).toBe('suspended');
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-a']);

    const last = await run.resume({ label: 'approve-a', resumeData: { approvedBy: 'alice' } });
    expect(last.status).toBe('success');
    expect((last as any).result).toEqual({
      a: { approvedBy: 'alice' },
      b: { approvedBy: 'bob' },
      c: { approvedBy: 'carol' },
    });
  });

  it('keeps a resumed step label when that step suspends again', async () => {
    const twice = createStep({
      id: 'twice',
      ...approvalSchemas,
      execute: async ({ resumeData, suspend, suspendData }) => {
        if (!resumeData || !(suspendData as any)?.second) {
          await suspend({ step: 'twice', second: !!resumeData } as any, { resumeLabel: 'approve-twice' });
          return { approvedBy: '' };
        }
        return { approvedBy: resumeData.approvedBy };
      },
    });
    const other = createApprovalStep('other');
    const workflow = createWorkflow({
      id: 'parallel-label-resuspend',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      steps: [twice, other],
      options: { validateInputs: false },
    })
      .parallel([twice, other])
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'parallel-label-resuspend': workflow } });

    const run = await workflow.createRun();
    await run.start({ inputData: {} });

    const resumed = await run.resume({ label: 'approve-twice', resumeData: { approvedBy: 'first' } });
    expect(resumed.status).toBe('suspended');
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-other', 'approve-twice']);
  });

  it('keeps sibling labels in a conditional block with several suspended branches', async () => {
    const a = createApprovalStep('a');
    const b = createApprovalStep('b');
    const workflow = createWorkflow({
      id: 'branch-label-resume',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      steps: [a, b],
      options: { validateInputs: false },
    })
      .branch([
        [async () => true, a],
        [async () => true, b],
      ])
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'branch-label-resume': workflow } });

    const run = await workflow.createRun();
    const started = await run.start({ inputData: {} });
    expect(started.status).toBe('suspended');
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-a', 'approve-b']);

    const first = await run.resume({ label: 'approve-b', resumeData: { approvedBy: 'bob' } });
    expect(first.status).toBe('suspended');
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-a']);

    const last = await run.resume({ label: 'approve-a', resumeData: { approvedBy: 'alice' } });
    expect(last.status).toBe('success');
    expect((last as any).result).toEqual({ a: { approvedBy: 'alice' }, b: { approvedBy: 'bob' } });
  });

  it('keeps the label of a suspended nested workflow when a sibling step is resumed', async () => {
    const inner = createApprovalStep('inner');
    const nested = createWorkflow({
      id: 'nested-approval',
      inputSchema: z.object({}),
      outputSchema: z.object({ approvedBy: z.string() }),
      steps: [inner],
      options: { validateInputs: false },
    })
      .then(inner)
      .commit();
    const plain = createApprovalStep('plain');
    const workflow = createWorkflow({
      id: 'parallel-nested-label',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      steps: [nested, plain],
      options: { validateInputs: false },
    })
      .parallel([nested, plain])
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'parallel-nested-label': workflow } });

    const run = await workflow.createRun();
    await run.start({ inputData: {} });
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-inner', 'approve-plain']);

    const first = await run.resume({ label: 'approve-plain', resumeData: { approvedBy: 'pat' } });
    expect(first.status).toBe('suspended');
    expect((await readLabels(workflow, run.runId)).labels).toEqual(['approve-inner']);

    const last = await run.resume({ label: 'approve-inner', resumeData: { approvedBy: 'ivy' } });
    expect(last.status).toBe('success');
    expect((last as any).result).toEqual({
      'nested-approval': { approvedBy: 'ivy' },
      plain: { approvedBy: 'pat' },
    });
  });
});
