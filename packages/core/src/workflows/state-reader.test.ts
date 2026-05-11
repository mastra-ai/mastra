import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import {
  createWorkflowStateReader,
  getWorkflowResumeLabel,
  getWorkflowResumeLabels,
  getWorkflowStepOutput,
  getWorkflowStepPayload,
  getWorkflowSuspendedStep,
  getWorkflowSuspendedSteps,
} from './state-reader';
import type { WorkflowRunState, WorkflowState } from './types';
import { createStep, createWorkflow } from './workflow';

describe('workflow state reader', () => {
  const baseState: WorkflowState = {
    runId: 'run-1',
    workflowName: 'reader-workflow',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'suspended',
    error: { message: 'workflow failed' },
    payload: { value: 'initial' },
    result: { done: true },
    steps: {
      'first-step': {
        status: 'success',
        payload: { value: 'initial' },
        output: { value: 'processed' },
      },
      'nested-workflow.review-step': {
        status: 'success',
        payload: { value: 'processed' },
        output: { reviewed: true },
      },
      'approval-step': {
        status: 'suspended',
        payload: { value: 'processed' },
        suspendPayload: {
          reason: 'approval',
          __workflow_meta: {
            path: ['approval-step', 'nested-review-step'],
          },
        },
        suspendOutput: { pending: true },
        suspendedAt: 1,
      },
      'foreach-step': [
        {
          status: 'success',
          payload: { item: 'alpha' },
          output: { approved: true },
        },
        {
          status: 'suspended',
          payload: { item: 'beta' },
          suspendPayload: { reason: 'review beta' },
        },
      ],
    },
    suspendedPaths: {
      'approval-step': [2, 0],
    },
    resumeLabels: {
      approve: { stepId: 'approval-step' },
      reject: { stepId: 'approval-step', foreachIndex: 1 },
      unrelated: { stepId: 'other-step' },
    },
  };

  it('reads workflow status, terminal fields, step payloads, and step outputs', () => {
    const reader = createWorkflowStateReader(baseState);

    expect(reader.getStatus()).toBe('suspended');
    expect(reader.getResult()).toEqual({ done: true });
    expect(reader.getError()).toEqual({ message: 'workflow failed' });
    expect(reader.getStepOutput('first-step')).toEqual({ value: 'processed' });
    expect(reader.getStepPayload('first-step')).toEqual({ value: 'initial' });
    expect(reader.getStepOutput('nested-workflow.review-step')).toEqual({ reviewed: true });
    expect(reader.getStepOutput('foreach-step')).toEqual([{ approved: true }, undefined]);
    expect(reader.getStepPayload('foreach-step')).toEqual([{ item: 'alpha' }, { item: 'beta' }]);
    expect(getWorkflowStepOutput(baseState, 'missing-step')).toBeUndefined();
    expect(getWorkflowStepPayload(baseState, 'missing-step')).toBeUndefined();
  });

  it('reads resume labels without exposing mutable state', () => {
    const label = getWorkflowResumeLabel(baseState, 'reject');
    label!.stepId = 'mutated-step';

    const labels = getWorkflowResumeLabels(baseState);
    labels.approve = { stepId: 'mutated-step' };
    labels.reject!.stepId = 'mutated-step';

    expect(getWorkflowResumeLabel(baseState, 'approve')).toEqual({ stepId: 'approval-step' });
    expect(createWorkflowStateReader(baseState).getResumeLabel('reject')).toEqual({
      stepId: 'approval-step',
      foreachIndex: 1,
    });
    expect(createWorkflowStateReader(baseState).getResumeLabel('missing')).toBeUndefined();
  });

  it('reads suspended steps with nested paths and matching labels', () => {
    const suspendedStep = getWorkflowSuspendedStep(baseState);

    expect(suspendedStep).toEqual({
      stepId: 'approval-step',
      path: ['approval-step', 'nested-review-step'],
      executionPath: [2, 0],
      step: baseState.steps?.['approval-step'],
      payload: { value: 'processed' },
      suspendPayload: {
        reason: 'approval',
        __workflow_meta: {
          path: ['approval-step', 'nested-review-step'],
        },
      },
      suspendOutput: { pending: true },
      resumeLabels: {
        approve: { stepId: 'approval-step' },
        reject: { stepId: 'approval-step', foreachIndex: 1 },
      },
    });
    expect(createWorkflowStateReader(baseState).getSuspendedSteps()).toEqual([suspendedStep]);
  });

  it('falls back to the suspended step id when nested metadata is absent', () => {
    const state: WorkflowState = {
      ...baseState,
      steps: {
        'approval-step': {
          status: 'suspended',
          payload: { value: 'processed' },
        },
      },
      suspendedPaths: {
        'approval-step': [1],
      },
      resumeLabels: {},
    };

    expect(getWorkflowSuspendedSteps(state)).toEqual([
      {
        stepId: 'approval-step',
        path: ['approval-step'],
        executionPath: [1],
        step: state.steps?.['approval-step'],
        payload: { value: 'processed' },
        suspendPayload: undefined,
        suspendOutput: undefined,
        resumeLabels: {},
      },
    ]);
  });
});

describe('Workflow.getWorkflowRunById recovery fields', () => {
  it('exposes recovery fields on default workflow state responses', async () => {
    const storage = new MockStore();
    const approvalStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ suspend, resumeData }) => {
        if (!resumeData) {
          await suspend({ reason: 'manual review' }, { resumeLabel: 'approve' });
          return { approved: false };
        }

        return { approved: resumeData.approved };
      },
    });
    const workflow = createWorkflow({
      id: 'reader-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
    })
      .then(approvalStep)
      .commit();

    new Mastra({ logger: false, storage, workflows: { readerWorkflow: workflow } });

    const run = await workflow.createRun();
    await run.start({ inputData: { value: 'test' } });

    const state = await workflow.getWorkflowRunById(run.runId);

    expect(state?.status).toBe('suspended');
    expect(state?.suspendedPaths).toEqual({ 'approval-step': [0] });
    expect(state?.resumeLabels).toEqual({ approve: { stepId: 'approval-step' } });
    expect(state?.waitingPaths).toEqual({});
    expect(createWorkflowStateReader(state!).getSuspendedStep()).toMatchObject({
      stepId: 'approval-step',
      path: ['approval-step'],
      resumeLabels: { approve: { stepId: 'approval-step' } },
    });
  });

  it('supports field filtering for recovery fields', async () => {
    const storage = new MockStore();
    const workflow = createWorkflow({
      id: 'reader-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    }).commit();
    new Mastra({ logger: false, storage, workflows: { readerWorkflow: workflow } });

    const workflowsStore = await storage.getStore('workflows');
    const snapshot: WorkflowRunState = {
      runId: 'run-1',
      status: 'suspended',
      value: {},
      context: { input: { value: 'test' } },
      serializedStepGraph: [],
      activePaths: [],
      activeStepsPath: { 'approval-step': [0] },
      suspendedPaths: { 'approval-step': [0] },
      resumeLabels: { approve: { stepId: 'approval-step', foreachIndex: 2 } },
      waitingPaths: { 'sleep-step': [1] },
      requestContext: { userId: 'user-1' },
      tracingContext: { traceId: 'trace-1', spanId: 'span-1', parentSpanId: 'parent-1' },
      timestamp: Date.now(),
    };
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: 'reader-workflow',
      runId: 'run-1',
      snapshot,
    });

    const filteredState = await workflow.getWorkflowRunById('run-1', {
      fields: ['resumeLabels', 'requestContext', 'tracingContext'],
    });
    const defaultState = await workflow.getWorkflowRunById('run-1');

    expect(filteredState).toMatchObject({
      runId: 'run-1',
      workflowName: 'reader-workflow',
      status: 'suspended',
      resumeLabels: { approve: { stepId: 'approval-step', foreachIndex: 2 } },
      requestContext: { userId: 'user-1' },
      tracingContext: { traceId: 'trace-1', spanId: 'span-1', parentSpanId: 'parent-1' },
    });
    expect(filteredState).not.toHaveProperty('steps');
    expect(filteredState).not.toHaveProperty('suspendedPaths');
    expect(filteredState).not.toHaveProperty('waitingPaths');
    expect(defaultState).not.toHaveProperty('requestContext');
    expect(defaultState).not.toHaveProperty('tracingContext');
  });
});
