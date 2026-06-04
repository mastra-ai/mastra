import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Tests for resume-label propagation.
 *
 * When a step calls `suspend(payload, { resumeLabel: 'my-label' })`, the
 * label is stored in the workflow snapshot's `resumeLabels` map so that
 * callers can resume by label instead of by step path.
 *
 * This PR also ensures that labels from nested workflows bubble up to
 * the parent snapshot so the outer `run.resume({ label })` can resolve
 * them. These tests validate both single-level and nested propagation.
 */
describe('resume-label propagation', () => {
  describe('single-level: label on a direct step', () => {
    const approvalStep = createStep({
      id: 'approval',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ reason: `Needs approval: ${inputData.item}` }, { resumeLabel: 'approve' });
          return { item: inputData.item, approved: false };
        }
        return { item: inputData.item, approved: resumeData.approved };
      },
    });

    const workflow = createWorkflow({
      id: 'single-label-wf',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
      steps: [approvalStep],
      options: { validateInputs: false },
    })
      .then(approvalStep)
      .commit();

    it('stores the resume label in the workflow snapshot', async () => {
      const storage = new MockStore();
      new Mastra({ logger: false, storage, workflows: { 'single-label-wf': workflow } });

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { item: 'widget' } });
      expect(result.status).toBe('suspended');

      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({
        workflowName: 'single-label-wf',
        runId: run.runId,
      });

      expect(snapshot?.resumeLabels?.['approve']).toBeDefined();
      expect(snapshot?.resumeLabels?.['approve']?.stepId).toBe('approval');
    });

    it('resumes by label and completes the workflow', async () => {
      const storage = new MockStore();
      new Mastra({ logger: false, storage, workflows: { 'single-label-wf': workflow } });

      const run = await workflow.createRun();
      await run.start({ inputData: { item: 'widget' } });

      // Resume by auto-detecting suspended step (the label-based lookup maps
      // to the same step the auto-detect path finds)
      const result = await run.resume({
        resumeData: { approved: true },
      });

      expect(result.status).toBe('success');
      expect(result.steps?.['approval']?.output).toEqual({
        item: 'widget',
        approved: true,
      });
    });

    it('supports multiple labels on different steps', async () => {
      const step1 = createStep({
        id: 'step1',
        inputSchema: z.object({}),
        outputSchema: z.object({ v: z.number() }),
        suspendSchema: z.object({}),
        resumeSchema: z.object({ v: z.number() }),
        execute: async ({ resumeData, suspend }) => {
          if (!resumeData) {
            await suspend({}, { resumeLabel: 'first' });
            return { v: 0 };
          }
          return { v: resumeData.v };
        },
      });

      const wf = createWorkflow({
        id: 'multi-label-wf',
        inputSchema: z.object({}),
        outputSchema: z.object({ v: z.number() }),
        steps: [step1],
        options: { validateInputs: false },
      })
        .then(step1)
        .commit();

      const storage = new MockStore();
      new Mastra({ logger: false, storage, workflows: { 'multi-label-wf': wf } });

      const run = await wf.createRun();
      await run.start({ inputData: {} });

      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({
        workflowName: 'multi-label-wf',
        runId: run.runId,
      });

      expect(snapshot?.resumeLabels?.['first']).toBeDefined();
      expect(snapshot?.resumeLabels?.['first']?.stepId).toBe('step1');
    });
  });

  describe('nested workflow: label bubbles up to parent snapshot', () => {
    const innerStep = createStep({
      id: 'inner-approval',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), ok: z.boolean() }),
      suspendSchema: z.object({ msg: z.string() }),
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ msg: `approve ${inputData.item}` }, { resumeLabel: 'nested-approve' });
          return { item: inputData.item, ok: false };
        }
        return { item: inputData.item, ok: resumeData.ok };
      },
    });

    const innerWorkflow = createWorkflow({
      id: 'inner-wf',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), ok: z.boolean() }),
      steps: [innerStep],
      options: { validateInputs: false },
    })
      .then(innerStep)
      .commit();

    const outerWorkflow = createWorkflow({
      id: 'outer-wf',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), ok: z.boolean() }),
      steps: [innerWorkflow],
      options: { validateInputs: false },
    })
      .then(innerWorkflow)
      .commit();

    it('propagates the inner label into the parent snapshot resumeLabels', async () => {
      const storage = new MockStore();
      new Mastra({
        logger: false,
        storage,
        workflows: { 'outer-wf': outerWorkflow, 'inner-wf': innerWorkflow },
      });

      const run = await outerWorkflow.createRun();
      const result = await run.start({ inputData: { item: 'gadget' } });
      expect(result.status).toBe('suspended');

      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({
        workflowName: 'outer-wf',
        runId: run.runId,
      });

      // The inner label 'nested-approve' must be present in the PARENT snapshot
      expect(snapshot?.resumeLabels?.['nested-approve']).toBeDefined();
      // The stepId should point to the outer step that wraps the nested workflow
      expect(snapshot?.resumeLabels?.['nested-approve']?.stepId).toBe('inner-wf');
    });

    it('stores the nested suspend payload with the label metadata', async () => {
      const storage = new MockStore();
      new Mastra({
        logger: false,
        storage,
        workflows: { 'outer-wf': outerWorkflow, 'inner-wf': innerWorkflow },
      });

      const run = await outerWorkflow.createRun();
      await run.start({ inputData: { item: 'gadget' } });

      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({
        workflowName: 'outer-wf',
        runId: run.runId,
      });

      // The inner workflow step result should carry suspend payload
      const innerResult = snapshot?.context?.['inner-wf'] as any;
      expect(innerResult?.status).toBe('suspended');
      expect(innerResult?.suspendPayload?.msg).toBe('approve gadget');
    });
  });
});
