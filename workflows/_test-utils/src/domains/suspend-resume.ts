/**
 * Suspend and Resume tests for workflows
 * Note: These tests require storage/Mastra setup for full functionality
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for suspend/resume tests.
 */
export function createSuspendResumeWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should return the correct runId
  {
    const executeFn = vi.fn().mockResolvedValue({ result: 'success' });
    const step1 = createStep({
      id: 'step1',
      execute: executeFn,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-runid-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1],
    })
      .then(step1)
      .commit();

    workflows['suspend-resume-runid-workflow'] = { workflow, mocks: { executeFn } };
  }

  // Test: should suspend workflow when suspend is called
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1-done' });
    const step2Action = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({ reason: 'waiting for approval' });
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'suspend-test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['suspend-test-workflow'] = { workflow, mocks: { step1Action, step2Action } };
  }

  // Test: should handle suspend with empty payload
  {
    const step1Action = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend();
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'empty-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['empty-suspend-workflow'] = { workflow, mocks: { step1Action } };
  }

  // Test: should suspend with typed payload
  {
    const step1Action = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({
        approvalRequired: true,
        requestedBy: 'user-123',
        amount: 500,
      });
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({
        approvalRequired: z.boolean(),
        requestedBy: z.string(),
        amount: z.number(),
      }),
    });

    const workflow = createWorkflow({
      id: 'typed-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ approved: z.boolean() }),
    });

    workflow.then(step1).commit();

    workflows['typed-suspend-workflow'] = { workflow, mocks: { step1Action } };
  }

  // Test: should not execute steps after suspended step
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1-done' });
    const step2Action = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({ reason: 'approval needed' });
    });
    const step3Action = vi.fn().mockResolvedValue({ final: 'should not run' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ final: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'suspend-stops-execution-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ final: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['suspend-stops-execution-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  // Test: should handle suspend in conditional branch
  {
    const checkStep = vi.fn().mockResolvedValue({ needsApproval: true });
    const approvalStep = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({ type: 'manager-approval' });
    });
    const autoApproveStep = vi.fn().mockResolvedValue({ approved: true });

    const check = createStep({
      id: 'check',
      execute: checkStep,
      inputSchema: z.object({}),
      outputSchema: z.object({ needsApproval: z.boolean() }),
    });

    const approval = createStep({
      id: 'approval',
      execute: approvalStep,
      inputSchema: z.object({ needsApproval: z.boolean() }),
      outputSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ type: z.string() }),
    });

    const autoApprove = createStep({
      id: 'autoApprove',
      execute: autoApproveStep,
      inputSchema: z.object({ needsApproval: z.boolean() }),
      outputSchema: z.object({ approved: z.boolean() }),
    });

    const workflow = createWorkflow({
      id: 'suspend-in-branch-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ approved: z.boolean() }),
    });

    workflow
      .then(check)
      .branch([
        [async ({ inputData }) => inputData.needsApproval === true, approval],
        [async ({ inputData }) => inputData.needsApproval === false, autoApprove],
      ])
      .commit();

    workflows['suspend-in-branch-workflow'] = {
      workflow,
      mocks: { checkStep, approvalStep, autoApproveStep },
    };
  }

  // Test: should handle suspend and resume with state
  {
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1-done' });
    const step2Action = vi
      .fn()
      .mockImplementationOnce(async ({ suspend, state, setState }: any) => {
        // Set state and then suspend
        await setState({ ...state, value: state.value + '-modified' });
        return suspend({ reason: 'waiting' });
      })
      .mockImplementationOnce(async ({ state }: any) => {
        // On resume, state should be preserved
        return { result: 'resumed', stateValue: state.value };
      });
    const step3Action = vi.fn().mockImplementation(async ({ state }: any) => {
      return { final: 'done', stateValue: state.value };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string(), stateValue: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({}),
      stateSchema: z.object({ value: z.string() }),
    });

    const step3 = createStep({
      id: 'step3',
      execute: step3Action,
      inputSchema: z.object({ result: z.string(), stateValue: z.string() }),
      outputSchema: z.object({ final: z.string(), stateValue: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-with-state-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ final: z.string(), stateValue: z.string() }),
      stateSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).then(step3).commit();

    workflows['suspend-resume-with-state-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action },
    };
  }

  // Test: should remain suspended when one of parallel steps suspends
  {
    const normalStep = vi.fn().mockResolvedValue({ result: 'normal-done' });
    const suspendStep = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({ waitingFor: 'approval' });
    });

    const step1 = createStep({
      id: 'step1',
      execute: normalStep,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: suspendStep,
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ waitingFor: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'parallel-one-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.parallel([step1, step2]).commit();

    workflows['parallel-one-suspend-workflow'] = {
      workflow,
      mocks: { normalStep, suspendStep },
    };
  }

  // Test: should complete parallel workflow when no steps suspend
  {
    const step1Fn = vi.fn().mockResolvedValue({ value: 10 });
    const step2Fn = vi.fn().mockResolvedValue({ value: 20 });

    const step1 = createStep({
      id: 'step1',
      execute: step1Fn,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Fn,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'parallel-no-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    workflow.parallel([step1, step2]).commit();

    workflows['parallel-no-suspend-workflow'] = {
      workflow,
      mocks: { step1Fn, step2Fn },
    };
  }

  // Test: should propagate suspend from nested workflow
  {
    const outerStep = vi.fn().mockResolvedValue({ value: 'outer-done' });
    const innerSuspendStep = vi.fn().mockImplementation(async ({ suspend }) => {
      return suspend({ nestedReason: 'inner-waiting' });
    });

    const outerStepDef = createStep({
      id: 'outer-step',
      execute: outerStep,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const innerStepDef = createStep({
      id: 'inner-step',
      execute: innerSuspendStep,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ nestedReason: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'nested-suspend-inner',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [innerStepDef],
    })
      .then(innerStepDef)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-suspend-main',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    mainWorkflow.then(outerStepDef).then(nestedWorkflow).commit();

    workflows['nested-suspend-main'] = {
      workflow: mainWorkflow,
      mocks: { outerStep, innerSuspendStep },
      nestedWorkflowId: 'nested-suspend-inner',
    };
  }

  // Test: should handle basic suspend and resume flow
  {
    let resumeCallCount = 0;
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1-done' });
    const step2Action = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      resumeCallCount++;
      if (resumeCallCount === 1) {
        // First call - suspend
        return suspend({ reason: 'waiting for user input' });
      }
      // Second call (after resume) - complete with resumeData
      return { result: 'completed', userInput: (resumeData as any)?.userInput || 'default' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string(), userInput: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'basic-resume-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), userInput: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['basic-resume-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
      resetMocks: () => {
        resumeCallCount = 0;
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should handle suspend and resume using resumeLabel
  {
    let resumeCallCount = 0;
    const step1Action = vi.fn().mockResolvedValue({ value: 'step1-done' });
    const step2Action = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      resumeCallCount++;
      if (resumeCallCount === 1) {
        // First call - suspend with a label
        return suspend({ reason: 'waiting' }, { resumeLabel: 'my-custom-label' });
      }
      // Second call (after resume) - complete with resumeData
      return { result: 'completed', userInput: (resumeData as any)?.userInput || 'default' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string(), userInput: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'resume-with-label-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), userInput: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['resume-with-label-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
      resetMocks: () => {
        resumeCallCount = 0;
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should preserve state across suspend and resume cycles
  {
    const stateValuesObserved: Array<{ step: string; state: any }> = [];

    const step1Action = vi.fn().mockImplementation(async ({ state, setState, suspend, resumeData }) => {
      stateValuesObserved.push({ step: 'step-1', state: { ...state } });

      if (!resumeData) {
        // First run: update state and suspend
        await setState({ ...state, count: state.count + 1, items: [...state.items, 'item-1'] });
        await suspend({});
        return {};
      }

      // After resume: state should be preserved
      return {};
    });

    const step2Action = vi.fn().mockImplementation(async ({ state }) => {
      stateValuesObserved.push({ step: 'step-2', state: { ...state } });
      return { finalCount: state.count, itemCount: state.items.length };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      stateSchema: z.object({ count: z.number(), items: z.array(z.string()) }),
      resumeSchema: z.object({ proceed: z.boolean() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ finalCount: z.number(), itemCount: z.number() }),
      stateSchema: z.object({ count: z.number(), items: z.array(z.string()) }),
    });

    const workflow = createWorkflow({
      id: 'state-persistence-resume-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ finalCount: z.number(), itemCount: z.number() }),
      stateSchema: z.object({ count: z.number(), items: z.array(z.string()) }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['state-persistence-resume-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, stateValuesObserved },
      resetMocks: () => {
        stateValuesObserved.length = 0;
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should handle multiple suspend/resume cycles in parallel workflow
  {
    let step1ResumeCount = 0;
    let step2ResumeCount = 0;

    const step1Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      step1ResumeCount++;
      if (step1ResumeCount < 2 && !resumeData) {
        await suspend({});
        return { result: 0 };
      }
      const increment = (resumeData as any)?.increment || 0;
      return { result: inputData.value + increment };
    });

    const step2Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      step2ResumeCount++;
      if (step2ResumeCount < 2 && !resumeData) {
        await suspend({});
        return { result: 0 };
      }
      const multiplier = (resumeData as any)?.multiplier || 1;
      return { result: inputData.value * multiplier };
    });

    const step1 = createStep({
      id: 'multi-resume-step-1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ increment: z.number() }),
      execute: step1Action,
    });

    const step2 = createStep({
      id: 'multi-resume-step-2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: step2Action,
    });

    const workflow = createWorkflow({
      id: 'multi-suspend-parallel-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({
        'multi-resume-step-1': z.object({ result: z.number() }),
        'multi-resume-step-2': z.object({ result: z.number() }),
      }),
    });

    workflow.parallel([step1, step2]).commit();

    workflows['multi-suspend-parallel-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
      resetMocks: () => {
        step1ResumeCount = 0;
        step2ResumeCount = 0;
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should support both explicit step resume and auto-resume
  {
    const suspendStepAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        // First execution - suspend
        await suspend({ waitingFor: 'user-input', originalValue: inputData.value });
        return { result: '' }; // Should not be reached
      } else {
        // Resume execution
        return { result: `processed-${(resumeData as any).extraData}` };
      }
    });

    const completeStepAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { final: `Completed: ${inputData.result}` };
    });

    const suspendStep = createStep({
      id: 'suspend-step',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      resumeSchema: z.object({ extraData: z.string() }),
      execute: suspendStepAction,
    });

    const completeStep = createStep({
      id: 'complete-step',
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ final: z.string() }),
      execute: completeStepAction,
    });

    const workflow = createWorkflow({
      id: 'auto-resume-test-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ final: z.string() }),
    });

    workflow.then(suspendStep).then(completeStep).commit();

    workflows['auto-resume-test-workflow'] = {
      workflow,
      mocks: { suspendStepAction, completeStepAction },
      resetMocks: () => {
        suspendStepAction.mockClear();
        completeStepAction.mockClear();
      },
    };
  }

  // Test: should maintain correct step status after resuming in branching workflows
  {
    const branchStep1Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const branchStep2Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const branchStep1 = createStep({
      id: 'branch-step-1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: branchStep1Action,
    });

    const branchStep2 = createStep({
      id: 'branch-step-2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: branchStep2Action,
    });

    const workflow = createWorkflow({
      id: 'branching-resume-status-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({
        'branch-step-1': z.object({ result: z.number() }),
        'branch-step-2': z.object({ result: z.number() }),
      }),
    });

    workflow
      .branch([
        [async () => true, branchStep1], // First branch will execute and suspend
        [async () => true, branchStep2], // Second branch will execute and suspend
      ])
      .commit();

    workflows['branching-resume-status-workflow'] = {
      workflow,
      mocks: { branchStep1Action, branchStep2Action },
      resetMocks: () => {
        branchStep1Action.mockClear();
        branchStep2Action.mockClear();
      },
    };
  }

  // Test: should be able to resume suspended nested workflow step
  {
    const beginAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return inputData;
    });
    const startAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { newValue: (inputData.startValue || 0) + 1 };
    });
    const otherAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend({});
      }
      return { newValue: inputData.newValue, other: 26 };
    });
    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: (inputData.newValue || 0) + (inputData.other || 0) };
    });
    const lastAction = vi.fn().mockImplementation(async () => {
      return { success: true };
    });

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ newValue: z.number() }),
      execute: startAction,
    });

    const otherStep = createStep({
      id: 'other',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({ newValue: z.number(), other: z.number() }),
      execute: otherAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ newValue: z.number(), other: z.number() }),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const beginStep = createStep({
      id: 'begin-step',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ startValue: z.number() }),
      execute: beginAction,
    });

    const lastStep = createStep({
      id: 'last-step',
      inputSchema: z.object({ finalValue: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: lastAction,
    });

    const nestedWorkflow = createWorkflow({
      id: 'sr-nested-wf-a',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    })
      .then(startStep)
      .then(otherStep)
      .then(finalStep)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'nested-resume-workflow',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      options: { validateInputs: false },
    });

    mainWorkflow.then(beginStep).then(nestedWorkflow).then(lastStep).commit();

    workflows['nested-resume-workflow'] = {
      workflow: mainWorkflow,
      nestedWorkflowId: 'sr-nested-wf-a',
      mocks: { beginAction, startAction, otherAction, finalAction, lastAction },
      resetMocks: () => {
        beginAction.mockClear();
        startAction.mockClear();
        otherAction.mockClear();
        finalAction.mockClear();
        lastAction.mockClear();
      },
    };
  }

  // Test: should handle basic suspend and resume in a dountil workflow
  {
    let iterationCount = 0;
    const incrementAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 1 };
    });

    const resumeAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      const finalValue = (resumeData?.value ?? 0) + inputData.value;
      if (!resumeData?.value || finalValue < 10) {
        return await suspend({ message: `Please provide additional information. now value is ${inputData.value}` });
      }
      return { value: finalValue };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value };
    });

    const incrementStep = createStep({
      id: 'increment',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: incrementAction,
    });

    const resumeStep = createStep({
      id: 'resume',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ value: z.number() }),
      suspendSchema: z.object({ message: z.string() }),
      execute: resumeAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: finalAction,
    });

    const nestedWorkflow = createWorkflow({
      id: 'simple-resume-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      steps: [incrementStep, resumeStep],
    })
      .then(incrementStep)
      .then(resumeStep)
      .commit();

    const dountilWorkflow = createWorkflow({
      id: 'dountil-suspend-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .dountil(nestedWorkflow, async ({ inputData }) => {
        iterationCount++;
        return inputData.value >= 10;
      })
      .then(finalStep)
      .commit();

    workflows['dountil-suspend-workflow'] = {
      workflow: dountilWorkflow,
      nestedWorkflowId: 'simple-resume-workflow',
      mocks: { incrementAction, resumeAction, finalAction },
      getIterationCount: () => iterationCount,
      resetMocks: () => {
        iterationCount = 0;
        incrementAction.mockClear();
        resumeAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should have access to the correct input value when resuming in a loop
  {
    const step1Action = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      let { condition, value } = inputData;
      const { shouldContinue } = resumeData ?? {};

      if (!shouldContinue) {
        await suspend({ message: `Continue with value ${value}?` });
        return { value, condition };
      }

      value = value + 1;
      condition = value >= 10;

      return { value, condition };
    });

    const step2Action = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value, condition: inputData.condition };
    });

    const step1 = createStep({
      id: 'step-1',
      inputSchema: z.object({
        value: z.number(),
        condition: z.boolean().default(false),
      }),
      outputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
      resumeSchema: z.object({ shouldContinue: z.boolean() }),
      suspendSchema: z.object({ message: z.string() }),
      execute: step1Action,
    });

    const step2 = createStep({
      id: 'step-2',
      inputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
      outputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
      execute: step2Action,
    });

    const workflow = createWorkflow({
      id: 'loop-resume-input-workflow',
      inputSchema: z.object({
        value: z.number(),
        condition: z.boolean().default(false),
      }),
      outputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
    })
      .dountil(step1, async ({ inputData: { condition } }) => condition)
      .then(step2)
      .commit();

    workflows['loop-resume-input-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
      resetMocks: () => {
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should have access to the correct inputValue when resuming a step preceded by a .map step
  {
    const getUserInputAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { userInput: inputData.input };
    });

    const promptAgentAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        return suspend({ testPayload: 'suspend message' });
      }
      return { modelOutput: inputData.userInput + ' ' + resumeData.userInput };
    });

    const improveResponseAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        return suspend({});
      }
      return {
        improvedOutput: 'improved output',
        overallScore: {
          completenessScore: { score: (inputData.completenessScore.score + resumeData.completenessScore.score) / 2 },
          toneScore: { score: (inputData.toneScore.score + resumeData.toneScore.score) / 2 },
        },
      };
    });

    const evaluateAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return inputData.overallScore;
    });

    const getUserInput = createStep({
      id: 'getUserInput',
      execute: getUserInputAction,
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ userInput: z.string() }),
    });

    const promptAgent = createStep({
      id: 'promptAgent',
      execute: promptAgentAction,
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ modelOutput: z.string() }),
      suspendSchema: z.object({ testPayload: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });

    const improveResponse = createStep({
      id: 'improveResponse',
      execute: improveResponseAction,
      resumeSchema: z.object({
        toneScore: z.object({ score: z.number() }),
        completenessScore: z.object({ score: z.number() }),
      }),
      inputSchema: z.object({
        toneScore: z.object({ score: z.number() }),
        completenessScore: z.object({ score: z.number() }),
      }),
      outputSchema: z.object({
        improvedOutput: z.string(),
        overallScore: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
      }),
    });

    const evaluateImproved = createStep({
      id: 'evaluateImprovedResponse',
      execute: evaluateAction,
      inputSchema: z.object({
        improvedOutput: z.string(),
        overallScore: z.object({
          toneScore: z.object({ score: z.number() }),
          completenessScore: z.object({ score: z.number() }),
        }),
      }),
      outputSchema: z.object({
        toneScore: z.object({ score: z.number() }),
        completenessScore: z.object({ score: z.number() }),
      }),
    });

    const workflow = createWorkflow({
      id: 'map-step-resume-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({
        toneScore: z.object({ score: z.number() }),
        completenessScore: z.object({ score: z.number() }),
      }),
    });

    workflow
      .then(getUserInput)
      .then(promptAgent)
      .map(
        async () => {
          return {
            toneScore: { score: 0.8 },
            completenessScore: { score: 0.7 },
          };
        },
        { id: 'evaluateToneConsistency' },
      )
      .then(improveResponse)
      .then(evaluateImproved)
      .commit();

    workflows['map-step-resume-workflow'] = {
      workflow,
      improveResponseStep: improveResponse,
      mocks: { getUserInputAction, promptAgentAction, improveResponseAction, evaluateAction },
      resetMocks: () => {
        getUserInputAction.mockClear();
        promptAgentAction.mockClear();
        improveResponseAction.mockClear();
        evaluateAction.mockClear();
      },
    };
  }

  // Test: should suspend and resume in foreach loop
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        return suspend({});
      }
      return { value: inputData.value + 11 + resumeData.resumeValue };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
    });

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ resumeValue: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'foreach-suspend-workflow',
      options: { validateInputs: false },
      steps: [mapStep, finalStep],
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
    });

    workflow.foreach(mapStep).then(finalStep).commit();

    workflows['foreach-suspend-workflow'] = {
      workflow,
      mocks: { mapAction, finalAction },
      resetMocks: () => {
        mapAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should suspend and resume when running concurrent foreach
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      // Only suspend for items with value > 5 (simulates some items completing, some suspending)
      if (!resumeData && inputData.value > 5) {
        return suspend({});
      }
      return { value: inputData.value + 11 + (resumeData?.resumeValue ?? 0) };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
    });

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ resumeValue: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'foreach-concurrent-suspend-workflow',
      options: { validateInputs: false },
      steps: [mapStep, finalStep],
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
    });

    workflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

    workflows['foreach-concurrent-suspend-workflow'] = {
      workflow,
      mocks: { mapAction, finalAction },
      resetMocks: () => {
        mapAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should suspend and resume with forEachIndex
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        return suspend({});
      }
      return { value: inputData.value + 11 + resumeData.resumeValue };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
    });

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ resumeValue: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'foreach-index-suspend-workflow',
      options: { validateInputs: false },
      steps: [mapStep, finalStep],
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
    });

    workflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

    workflows['foreach-index-suspend-workflow'] = {
      workflow,
      mocks: { mapAction, finalAction },
      resetMocks: () => {
        mapAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should suspend and resume provided label when running all items concurrency for loop
  {
    let resumeLabelCounter = 0;
    const mapAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        const labelId = resumeLabelCounter++;
        return suspend({}, { resumeLabel: `foreach-label-${labelId}` });
      }
      return { value: inputData.value + 11 + resumeData.resumeValue };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
    });

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ resumeValue: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'foreach-label-suspend-workflow',
      steps: [mapStep, finalStep],
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
    });

    workflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

    workflows['foreach-label-suspend-workflow'] = {
      workflow,
      mocks: { mapAction, finalAction },
      resetMocks: () => {
        mapAction.mockClear();
        finalAction.mockClear();
        resumeLabelCounter = 0;
      },
    };
  }

  // Test: should suspend and resume when running a partial item concurrency for loop
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      if (!resumeData && inputData.value > 5) {
        return suspend({});
      }
      return { value: inputData.value + 11 + (resumeData?.resumeValue ?? 0) };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
    });

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ resumeValue: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'foreach-partial-suspend-workflow',
      steps: [mapStep, finalStep],
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
    });

    // Partial concurrency (3 at a time)
    workflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

    workflows['foreach-partial-suspend-workflow'] = {
      workflow,
      mocks: { mapAction, finalAction },
      resetMocks: () => {
        mapAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should suspend and resume provided index when running a partial item concurrency for loop
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      if (!resumeData && inputData.value > 5) {
        return suspend({});
      }
      return { value: inputData.value + 11 + (resumeData?.resumeValue ?? 0) };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { finalValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0) };
    });

    const mapStep = createStep({
      id: 'map',
      inputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ resumeValue: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'foreach-partial-index-suspend-workflow',
      steps: [mapStep, finalStep],
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({ finalValue: z.number() }),
    });

    // Partial concurrency (3 at a time)
    workflow.foreach(mapStep, { concurrency: 3 }).then(finalStep).commit();

    workflows['foreach-partial-index-suspend-workflow'] = {
      workflow,
      mocks: { mapAction, finalAction },
      resetMocks: () => {
        mapAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should handle consecutive nested workflows with suspend/resume
  {
    const step1Action = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
      if (!resumeData?.suspect) {
        return await suspend({ message: 'What is the suspect?' });
      }
      return { suspect: resumeData.suspect };
    });

    const step2Action = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
      if (!resumeData?.suspect) {
        return await suspend({ message: 'What is the second suspect?' });
      }
      return { suspect: resumeData.suspect };
    });

    const step1 = createStep({
      id: 'step-1',
      inputSchema: z.object({ suspect: z.string() }),
      outputSchema: z.object({ suspect: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ suspect: z.string() }),
      execute: step1Action,
    });

    const step2 = createStep({
      id: 'step-2',
      inputSchema: z.object({ suspect: z.string() }),
      outputSchema: z.object({ suspect: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ suspect: z.string() }),
      execute: step2Action,
    });

    const subWorkflow1 = createWorkflow({
      id: 'sub-workflow-1',
      inputSchema: z.object({ suspect: z.string() }),
      outputSchema: z.object({ suspect: z.string() }),
    })
      .then(step1)
      .commit();

    const subWorkflow2 = createWorkflow({
      id: 'sub-workflow-2',
      inputSchema: z.object({ suspect: z.string() }),
      outputSchema: z.object({ suspect: z.string() }),
    })
      .then(step2)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'consecutive-nested-resume-workflow',
      inputSchema: z.object({ suspect: z.string() }),
      outputSchema: z.object({ suspect: z.string() }),
    })
      .then(subWorkflow1)
      .then(subWorkflow2)
      .commit();

    workflows['consecutive-nested-resume-workflow'] = {
      workflow: mainWorkflow,
      mocks: { step1Action, step2Action },
      resetMocks: () => {
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should throw error when multiple steps are suspended and no step specified
  {
    const branchStep1Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const branchStep2Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value / (resumeData as any).divisor };
    });

    const branchStep1 = createStep({
      id: 'branch-step-1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: branchStep1Action,
    });

    const branchStep2 = createStep({
      id: 'branch-step-2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ divisor: z.number() }),
      execute: branchStep2Action,
    });

    // Create a workflow with branching where both conditions are true
    // This will cause both branches to execute and suspend
    const workflow = createWorkflow({
      id: 'multi-suspend-branch-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({}),
    })
      .branch([
        [() => Promise.resolve(true), branchStep1], // Always executes and suspends
        [() => Promise.resolve(true), branchStep2], // Also executes and suspends
      ])
      .commit();

    workflows['multi-suspend-branch-workflow'] = {
      workflow,
      mocks: { branchStep1Action, branchStep2Action },
      resetMocks: () => {
        branchStep1Action.mockClear();
        branchStep2Action.mockClear();
      },
    };
  }

  // Test: should remain suspended when only one of multiple parallel suspended steps is resumed - #6418
  {
    const parallelStep1Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const parallelStep2Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value / (resumeData as any).divisor };
    });

    const parallelStep1 = createStep({
      id: 'parallel-step-1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: parallelStep1Action,
    });

    const parallelStep2 = createStep({
      id: 'parallel-step-2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ divisor: z.number() }),
      execute: parallelStep2Action,
    });

    const workflow = createWorkflow({
      id: 'parallel-suspension-bug-6418-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({
        'parallel-step-1': z.object({ result: z.number() }),
        'parallel-step-2': z.object({ result: z.number() }),
      }),
    })
      .parallel([parallelStep1, parallelStep2])
      .commit();

    workflows['parallel-suspension-bug-6418-workflow'] = {
      workflow,
      mocks: { parallelStep1Action, parallelStep2Action },
      resetMocks: () => {
        parallelStep1Action.mockClear();
        parallelStep2Action.mockClear();
      },
    };
  }

  // Test: should work with requestContext - bug #4442
  {
    const getUserInputAction = vi.fn().mockResolvedValue({ userInput: 'test input' });
    const promptAgentAction = vi.fn().mockImplementation(async ({ suspend, requestContext, resumeData }) => {
      if (!resumeData) {
        requestContext.set('responses', [...(requestContext.get('responses') ?? []), 'first message']);
        return await suspend({ testPayload: 'hello' });
      }
      requestContext.set('responses', [...(requestContext.get('responses') ?? []), 'promptAgentAction']);
      return undefined;
    });
    const requestContextAction = vi.fn().mockImplementation(async ({ requestContext }) => {
      return requestContext.get('responses');
    });

    const getUserInput = createStep({
      id: 'getUserInput',
      execute: getUserInputAction,
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ userInput: z.string() }),
    });
    const promptAgent = createStep({
      id: 'promptAgent',
      execute: promptAgentAction,
      inputSchema: z.object({ userInput: z.string() }),
      outputSchema: z.object({ modelOutput: z.string() }),
      suspendSchema: z.object({ testPayload: z.string() }),
      resumeSchema: z.object({ userInput: z.string() }),
    });
    const requestContextStep = createStep({
      id: 'requestContextAction',
      execute: requestContextAction,
      inputSchema: z.object({ modelOutput: z.string() }),
      outputSchema: z.array(z.string()),
    });

    const workflow = createWorkflow({
      id: 'requestcontext-bug-4442-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    });

    workflow.then(getUserInput).then(promptAgent).then(requestContextStep).commit();

    workflows['requestcontext-bug-4442-workflow'] = {
      workflow,
      mocks: { getUserInputAction, promptAgentAction, requestContextAction },
      resetMocks: () => {
        getUserInputAction.mockClear();
        promptAgentAction.mockClear();
        requestContextAction.mockClear();
      },
    };
  }

  // Test: should maintain correct step status after resuming in branching workflows - #6419
  {
    const branchStep1Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const branchStep2Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const branchStep1 = createStep({
      id: 'branch-step-1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: branchStep1Action,
    });

    const branchStep2 = createStep({
      id: 'branch-step-2',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: branchStep2Action,
    });

    const workflow = createWorkflow({
      id: 'branching-state-bug-6419-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({
        'branch-step-1': z.object({ result: z.number() }),
        'branch-step-2': z.object({ result: z.number() }),
      }),
    });

    workflow
      .branch([
        [async () => true, branchStep1], // First branch will execute and suspend
        [async () => true, branchStep2], // Second branch will execute and suspend
      ])
      .commit();

    workflows['branching-state-bug-6419-workflow'] = {
      workflow,
      mocks: { branchStep1Action, branchStep2Action },
      resetMocks: () => {
        branchStep1Action.mockClear();
        branchStep2Action.mockClear();
      },
    };
  }

  // Test: should have access to the correct input value when resuming in a loop - bug #6669
  {
    const step1Action = vi.fn().mockImplementation(async ({ inputData, resumeData, suspend }) => {
      let { condition, value } = inputData;
      const { shouldContinue } = (resumeData as any) ?? {};

      if (!shouldContinue) {
        await suspend({
          message: `Continue with value ${value}?`,
        });
        return { value, condition };
      }

      // Small delay to simulate work
      await new Promise(resolve => setTimeout(resolve, 50));

      value = value + 1;
      condition = value >= 10;

      return {
        value,
        condition,
      };
    });

    const step2Action = vi.fn().mockImplementation(async ({ inputData }) => {
      const { condition, value } = inputData;
      return { value, condition };
    });

    const step1 = createStep({
      id: 'step-1',
      inputSchema: z.object({
        value: z.number(),
        condition: z.boolean().default(false),
      }),
      outputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
      resumeSchema: z.object({
        shouldContinue: z.boolean(),
      }),
      suspendSchema: z.object({
        message: z.string(),
      }),
      execute: step1Action,
    });

    const step2 = createStep({
      id: 'step-2',
      inputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
      outputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
      execute: step2Action,
    });

    const workflow = createWorkflow({
      id: 'loop-input-bug-6669-workflow',
      inputSchema: z.object({
        value: z.number(),
        condition: z.boolean().default(false),
      }),
      outputSchema: z.object({
        value: z.number(),
        condition: z.boolean(),
      }),
    });

    workflow
      .dountil(step1, async ({ inputData: { condition } }) => condition)
      .then(step2)
      .commit();

    workflows['loop-input-bug-6669-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action },
      resetMocks: () => {
        step1Action.mockClear();
        step2Action.mockClear();
      },
    };
  }

  // Test: should handle basic suspend and resume in nested dountil workflow - bug #5650
  {
    let incrementLoopValue = 2;

    const resumeStepAction = vi.fn().mockImplementation(async ({ inputData, requestContext, getInitData }) => {
      const shouldNotExist = requestContext?.get('__mastraWorflowInputData');
      expect(shouldNotExist).toBeUndefined();
      const initData = getInitData();

      expect(initData.value).toBe(incrementLoopValue);
      incrementLoopValue = inputData.value; // we expect the input of the nested workflow to be updated with the output of this step
      return { value: inputData.value };
    });

    const incrementStepAction = vi
      .fn()
      .mockImplementation(async ({ inputData, resumeData, suspend, requestContext }) => {
        const shouldNotExist = requestContext?.get('__mastraWorflowInputData');
        expect(shouldNotExist).toBeUndefined();
        if (!(resumeData as any)?.amountToIncrementBy) {
          return suspend({ optionsToIncrementBy: [1, 2, 3] });
        }

        const result = inputData.value + (resumeData as any).amountToIncrementBy;
        return { value: result };
      });

    const resumeStep = createStep({
      id: 'resume',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: resumeStepAction,
    });

    const incrementStep = createStep({
      id: 'increment',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      resumeSchema: z.object({
        amountToIncrementBy: z.number(),
      }),
      suspendSchema: z.object({
        optionsToIncrementBy: z.array(z.number()),
      }),
      execute: incrementStepAction,
    });

    const nestedWorkflow = createWorkflow({
      id: 'simple-resume-workflow-5650',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      steps: [incrementStep, resumeStep],
    })
      .then(incrementStep)
      .then(resumeStep)
      .commit();

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    });

    const dowhileWorkflow = createWorkflow({
      id: 'nested-dountil-bug-5650-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .dountil(nestedWorkflow, async ({ inputData }) => {
        return inputData.value >= 10;
      })
      .then(finalStep)
      .commit();

    workflows['nested-dountil-bug-5650-workflow'] = {
      workflow: dowhileWorkflow,
      nestedWorkflowId: 'simple-resume-workflow-5650',
      mocks: { resumeStepAction, incrementStepAction },
      resetMocks: () => {
        resumeStepAction.mockClear();
        incrementStepAction.mockClear();
        incrementLoopValue = 2;
      },
      getIterationCount: () => incrementLoopValue,
    };
  }

  // Test: should auto-resume without specifying step parameter (single suspended step)
  {
    const step1Action = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { result: 0 };
      }
      return { result: inputData.value * (resumeData as any).multiplier };
    });

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
      resumeSchema: z.object({ multiplier: z.number() }),
      execute: step1Action,
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-auto-nonstep-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.number() }),
    })
      .then(step1)
      .commit();

    workflows['suspend-resume-auto-nonstep-workflow'] = {
      workflow,
      mocks: { step1Action },
      resetMocks: () => {
        step1Action.mockClear();
      },
    };
  }

  // Test: should resume with resumeSchema defaults
  {
    const incrementAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 1 };
    });

    const resumeAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData && inputData.value < 10) {
        await suspend({});
        return { value: 0 };
      }
      return { value: (resumeData as any).value + inputData.value };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value };
    });

    const incrementStep = createStep({
      id: 'increment',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: incrementAction,
    });

    const resumeStep = createStep({
      id: 'resume',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ value: z.number().optional().default(21) }),
      execute: resumeAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-schema-defaults-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(incrementStep)
      .then(resumeStep)
      .then(finalStep)
      .commit();

    workflows['suspend-resume-schema-defaults-workflow'] = {
      workflow,
      mocks: { incrementAction, resumeAction, finalAction },
      resetMocks: () => {
        incrementAction.mockClear();
        resumeAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should handle consecutive parallel chains
  {
    const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
      return { result1: `processed-${inputData.input}` };
    });

    const step2Action = vi.fn().mockImplementation(async ({ inputData }) => {
      return { result2: `transformed-${inputData.input}` };
    });

    const step3Action = vi.fn().mockImplementation(async ({ inputData }) => {
      return { result3: `combined-${inputData.step1.result1}-${inputData.step2.result2}` };
    });

    const step4Action = vi.fn().mockImplementation(async ({ inputData }) => {
      return { result4: `final-${inputData.step1.result1}-${inputData.step2.result2}` };
    });

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result1: z.string() }),
      execute: step1Action,
    });

    const step2 = createStep({
      id: 'step2',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({ result2: z.string() }),
      execute: step2Action,
    });

    const step3 = createStep({
      id: 'step3',
      inputSchema: z.object({
        step1: z.object({ result1: z.string() }),
        step2: z.object({ result2: z.string() }),
      }),
      outputSchema: z.object({ result3: z.string() }),
      execute: step3Action,
    });

    const step4 = createStep({
      id: 'step4',
      inputSchema: z.object({
        step1: z.object({ result1: z.string() }),
        step2: z.object({ result2: z.string() }),
      }),
      outputSchema: z.object({ result4: z.string() }),
      execute: step4Action,
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-consecutive-parallel-workflow',
      inputSchema: z.object({ input: z.string() }),
      outputSchema: z.object({}),
    })
      .parallel([step1, step2])
      .parallel([step3, step4])
      .commit();

    workflows['suspend-resume-consecutive-parallel-workflow'] = {
      workflow,
      mocks: { step1Action, step2Action, step3Action, step4Action },
      resetMocks: () => {
        step1Action.mockClear();
        step2Action.mockClear();
        step3Action.mockClear();
        step4Action.mockClear();
      },
    };
  }

  // Test: should throw error when resuming a non-suspended workflow
  {
    const incrementAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 1 };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value };
    });

    const incrementStep = createStep({
      id: 'increment',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: incrementAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-not-suspended-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(incrementStep)
      .then(finalStep)
      .commit();

    workflows['suspend-resume-not-suspended-workflow'] = {
      workflow,
      mocks: { incrementAction, finalAction },
      resetMocks: () => {
        incrementAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should throw error when resuming with invalid data (schema validation)
  {
    const incrementAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 1 };
    });

    const resumeAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { value: 0 };
      }
      return { value: (resumeData as any).value + inputData.value };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value };
    });

    const incrementStep = createStep({
      id: 'increment',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: incrementAction,
    });

    const resumeStep = createStep({
      id: 'resume',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ value: z.number() }),
      execute: resumeAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-invalid-data-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(incrementStep)
      .then(resumeStep)
      .then(finalStep)
      .commit();

    workflows['suspend-resume-invalid-data-workflow'] = {
      workflow,
      mocks: { incrementAction, resumeAction, finalAction },
      resetMocks: () => {
        incrementAction.mockClear();
        resumeAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should throw error when trying to resume a step that is not suspended
  {
    const incrementAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 1 };
    });

    const resumeAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({});
        return { value: 0 };
      }
      return { value: (resumeData as any).value + inputData.value };
    });

    const finalAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value };
    });

    const incrementStep = createStep({
      id: 'increment',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: incrementAction,
    });

    const resumeStep = createStep({
      id: 'resume',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      resumeSchema: z.object({ value: z.number() }),
      execute: resumeAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: finalAction,
    });

    const workflow = createWorkflow({
      id: 'suspend-resume-non-suspended-step-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(incrementStep)
      .then(resumeStep)
      .then(finalStep)
      .commit();

    workflows['suspend-resume-non-suspended-step-workflow'] = {
      workflow,
      mocks: { incrementAction, resumeAction, finalAction },
      resetMocks: () => {
        incrementAction.mockClear();
        resumeAction.mockClear();
        finalAction.mockClear();
      },
    };
  }

  // Test: should be able to suspend nested workflow step (with [wf, step] resume path)
  {
    const beginAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return inputData;
    });
    const startAction = vi.fn().mockImplementation(async ({ inputData }) => {
      const currentValue = inputData.startValue || 0;
      const newValue = currentValue + 1;
      return { newValue };
    });
    const otherAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend();
      }
      return { other: 26 };
    });
    const finalAction = vi.fn().mockImplementation(async ({ getStepResult }) => {
      const startStep = { id: 'start' };
      const otherStep = { id: 'other' };
      const startVal = getStepResult(startStep)?.newValue ?? 0;
      const otherVal = getStepResult(otherStep)?.other ?? 0;
      return { finalValue: startVal + otherVal };
    });
    const lastAction = vi.fn().mockImplementation(async () => {
      return { success: true };
    });

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ newValue: z.number() }),
      execute: startAction,
    });

    const otherStep = createStep({
      id: 'other',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({ newValue: z.number(), other: z.number() }),
      execute: otherAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ newValue: z.number().optional(), other: z.number().optional() }),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const beginStep = createStep({
      id: 'begin-step',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ startValue: z.number() }),
      execute: beginAction,
    });

    const lastStep = createStep({
      id: 'last-step',
      inputSchema: z.object({ finalValue: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: lastAction,
    });

    const nestedWorkflow = createWorkflow({
      id: 'sr-nested-wf-suspend-step',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ finalValue: z.number() }),
      options: { validateInputs: false },
    })
      .then(startStep)
      .then(otherStep)
      .then(finalStep)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'sr-suspend-nested-step-workflow',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ success: z.boolean() }),
      options: { validateInputs: false },
    });

    mainWorkflow.then(beginStep).then(nestedWorkflow).then(lastStep).commit();

    workflows['sr-suspend-nested-step-workflow'] = {
      workflow: mainWorkflow,
      nestedWorkflowId: 'sr-nested-wf-suspend-step',
      otherStep,
      nestedWorkflow,
      mocks: { beginAction, startAction, otherAction, finalAction, lastAction },
      resetMocks: () => {
        beginAction.mockClear();
        startAction.mockClear();
        otherAction.mockClear();
        finalAction.mockClear();
        lastAction.mockClear();
      },
    };
  }

  // Test: should preserve request context in nested workflows after suspend/resume
  {
    const setupStepAction = vi.fn().mockImplementation(async ({ requestContext }) => {
      requestContext.set('test-key', 'test-context-value');
      return { setup: true };
    });

    const suspendStepAction = vi.fn().mockImplementation(async ({ resumeData, suspend, requestContext }) => {
      expect(requestContext.get('test-key')).toBe('test-context-value');
      if (!resumeData?.confirmed) {
        return await suspend({ message: 'Workflow suspended for testing' });
      }
      return { resumed: true };
    });

    const verifyContextAction = vi
      .fn()
      .mockImplementation(async ({ requestContext, mastra, getInitData, inputData }) => {
        const testData = requestContext.get('test-key');
        const initData = getInitData();

        expect(testData).toBe('test-context-value');
        expect(mastra).toBeDefined();
        expect(requestContext).toBeDefined();
        expect(inputData).toEqual({ resumed: true });
        expect(initData).toEqual({ resumed: true });

        return { success: true, hasTestData: !!testData };
      });

    const setupStep = createStep({
      id: 'setup-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ setup: z.boolean() }),
      execute: setupStepAction,
    });

    const suspendStep = createStep({
      id: 'suspend-step',
      inputSchema: z.object({ setup: z.boolean() }),
      outputSchema: z.object({ resumed: z.boolean() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: suspendStepAction,
    });

    const verifyContextStep = createStep({
      id: 'verify-context-step',
      inputSchema: z.object({ resumed: z.boolean() }),
      outputSchema: z.object({ success: z.boolean(), hasTestData: z.boolean() }),
      execute: verifyContextAction,
    });

    const nestedWorkflow = createWorkflow({
      id: 'sr-nested-wf-after-suspend',
      inputSchema: z.object({ resumed: z.boolean() }),
      outputSchema: z.object({ success: z.boolean(), hasTestData: z.boolean() }),
    })
      .then(verifyContextStep)
      .commit();

    const mainWorkflow = createWorkflow({
      id: 'sr-request-context-nested-suspend-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ success: z.boolean(), hasTestData: z.boolean() }),
    })
      .then(setupStep)
      .then(suspendStep)
      .then(nestedWorkflow)
      .commit();

    workflows['sr-request-context-nested-suspend-workflow'] = {
      workflow: mainWorkflow,
      nestedWorkflowId: 'sr-nested-wf-after-suspend',
      mocks: { setupStepAction, suspendStepAction, verifyContextAction },
      resetMocks: () => {
        setupStepAction.mockClear();
        suspendStepAction.mockClear();
        verifyContextAction.mockClear();
      },
    };
  }

  // Test: should be able to suspend nested workflow step in a nested workflow step (deep nesting)
  {
    const startAction = vi.fn().mockImplementation(async ({ inputData }) => {
      const currentValue = inputData.startValue || 0;
      const newValue = currentValue + 1;
      return { newValue };
    });

    const otherAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend();
      }
      return { other: 26 };
    });

    const finalAction = vi.fn().mockImplementation(async ({ getStepResult }) => {
      const startStep = { id: 'start' };
      const otherStep = { id: 'other' };
      const startVal = getStepResult(startStep)?.newValue ?? 0;
      const otherVal = getStepResult(otherStep)?.other ?? 0;
      return { finalValue: startVal + otherVal };
    });

    const lastAction = vi.fn().mockImplementation(async () => {
      return { success: true };
    });

    const beginAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return inputData;
    });

    const passthroughAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return inputData;
    });

    const startStep = createStep({
      id: 'start',
      inputSchema: z.object({ startValue: z.number() }),
      outputSchema: z.object({ newValue: z.number() }),
      execute: startAction,
    });

    const otherStep = createStep({
      id: 'other',
      inputSchema: z.object({ newValue: z.number() }),
      outputSchema: z.object({ newValue: z.number(), other: z.number() }),
      execute: otherAction,
    });

    const finalStep = createStep({
      id: 'final',
      inputSchema: z.object({ newValue: z.number().optional(), other: z.number().optional() }),
      outputSchema: z.object({ finalValue: z.number() }),
      execute: finalAction,
    });

    const counterInputSchema = z.object({ startValue: z.number() });
    const counterOutputSchema = z.object({ finalValue: z.number() });

    const passthroughStep = createStep({
      id: 'passthrough',
      inputSchema: counterInputSchema,
      outputSchema: counterInputSchema,
      execute: passthroughAction,
    });

    const wfA = createWorkflow({
      id: 'sr-deep-nested-wf-a',
      inputSchema: counterInputSchema,
      outputSchema: finalStep.outputSchema,
      options: { validateInputs: false },
    })
      .then(startStep)
      .then(otherStep)
      .then(finalStep)
      .commit();

    const wfB = createWorkflow({
      id: 'sr-deep-nested-wf-b',
      inputSchema: counterInputSchema,
      outputSchema: finalStep.outputSchema,
      options: { validateInputs: false },
    })
      .then(passthroughStep)
      .then(wfA)
      .commit();

    const wfC = createWorkflow({
      id: 'sr-deep-nested-wf-c',
      inputSchema: counterInputSchema,
      outputSchema: finalStep.outputSchema,
      options: { validateInputs: false },
    })
      .then(passthroughStep)
      .then(wfB)
      .commit();

    const beginStep = createStep({
      id: 'begin-step',
      inputSchema: counterInputSchema,
      outputSchema: counterInputSchema,
      execute: beginAction,
    });

    const lastStep = createStep({
      id: 'last-step',
      inputSchema: wfA.outputSchema as any,
      outputSchema: z.object({ success: z.boolean() }),
      execute: lastAction,
    });

    const counterWorkflow = createWorkflow({
      id: 'sr-deep-nested-suspend-workflow',
      inputSchema: counterInputSchema,
      outputSchema: counterOutputSchema,
      steps: [wfC, passthroughStep],
      options: { validateInputs: false },
    });

    counterWorkflow.then(beginStep).then(wfC).then(lastStep).commit();

    workflows['sr-deep-nested-suspend-workflow'] = {
      workflow: counterWorkflow,
      nestedWorkflowId: 'sr-deep-nested-wf-c',
      mocks: { startAction, otherAction, finalAction, lastAction, beginAction, passthroughAction },
      resetMocks: () => {
        startAction.mockClear();
        otherAction.mockClear();
        finalAction.mockClear();
        lastAction.mockClear();
        beginAction.mockClear();
        passthroughAction.mockClear();
      },
    };
  }

  // Test: should not execute incorrect branches after resuming from suspended nested workflow
  {
    const fetchItemsAction = vi.fn().mockResolvedValue([
      { id: '1', name: 'Item 1', type: 'first' },
      { id: '2', name: 'Item 2', type: 'second' },
      { id: '3', name: 'Item 3', type: 'third' },
    ]);

    const selectItemAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend({ message: 'Select an item' });
      }
      return resumeData;
    });

    const firstItemAction = vi.fn().mockResolvedValue({ processed: 'first' });
    const thirdItemAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend({ message: 'Select date for third item' });
      }
      return { processed: 'third', date: resumeData };
    });

    const secondItemDateAction = vi.fn().mockImplementation(async ({ suspend, resumeData }) => {
      if (!resumeData) {
        return await suspend({ message: 'Select date for second item' });
      }
      return { processed: 'second', date: resumeData };
    });

    const finalProcessingAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { result: 'processed', input: inputData };
    });

    const fetchItems = createStep({
      id: 'fetch-items',
      inputSchema: z.object({}),
      outputSchema: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
      execute: fetchItemsAction,
    });

    const selectItem = createStep({
      id: 'select-item',
      inputSchema: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
      outputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
      execute: selectItemAction,
    });

    const firstItemStep = createStep({
      id: 'first-item-step',
      inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
      outputSchema: z.object({ processed: z.string() }),
      execute: firstItemAction,
    });

    const thirdItemStep = createStep({
      id: 'third-item-step',
      inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
      outputSchema: z.object({ processed: z.string(), date: z.date() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.date(),
      execute: thirdItemAction,
    });

    const secondItemDateStep = createStep({
      id: 'second-item-date-step',
      inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
      outputSchema: z.object({ processed: z.string(), date: z.date() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.date(),
      execute: secondItemDateAction,
    });

    const finalProcessingStep = createStep({
      id: 'final-processing',
      inputSchema: z.object({
        processed: z.string(),
        date: z.date().optional(),
      }),
      outputSchema: z.object({ result: z.string(), input: z.any() }),
      execute: finalProcessingAction,
    });

    // Create nested workflow for second item
    const secondItemWorkflow = createWorkflow({
      id: 'sr-second-item-workflow',
      inputSchema: z.object({ id: z.string(), name: z.string(), type: z.string() }),
      outputSchema: z.object({ processed: z.string(), date: z.date() }),
    })
      .then(secondItemDateStep)
      .commit();

    // Create main workflow with conditional branching
    const mainWorkflow = createWorkflow({
      id: 'sr-incorrect-branches-resume-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string(), input: z.any() }),
    })
      .then(fetchItems)
      .then(selectItem)
      .branch([
        [async ({ inputData }) => inputData.type === 'first', firstItemStep],
        [async ({ inputData }) => inputData.type === 'second', secondItemWorkflow],
        [async ({ inputData }) => inputData.type === 'third', thirdItemStep],
      ])
      .map(async ({ inputData }) => {
        if (inputData['first-item-step']) {
          return inputData['first-item-step'];
        } else if (inputData['sr-second-item-workflow']) {
          return inputData['sr-second-item-workflow'];
        } else if (inputData['third-item-step']) {
          return inputData['third-item-step'];
        }
        throw new Error('No valid branch result found');
      })
      .then(finalProcessingStep)
      .commit();

    workflows['sr-incorrect-branches-resume-workflow'] = {
      workflow: mainWorkflow,
      nestedWorkflowId: 'sr-second-item-workflow',
      mocks: {
        fetchItemsAction,
        selectItemAction,
        firstItemAction,
        thirdItemAction,
        secondItemDateAction,
        finalProcessingAction,
      },
      resetMocks: () => {
        fetchItemsAction.mockClear();
        selectItemAction.mockClear();
        firstItemAction.mockClear();
        thirdItemAction.mockClear();
        secondItemDateAction.mockClear();
        finalProcessingAction.mockClear();
      },
    };
  }

  // Test: should pass correct inputData to branch condition when resuming after map
  {
    const conditionSpy = vi.fn();

    const suspendingStepAction = vi.fn().mockImplementation(async ({ inputData, suspend, resumeData }) => {
      if (!resumeData) {
        await suspend({ prompt: 'Please provide an answer' });
        return { result: '' };
      }
      return { result: `processed: ${inputData.mappedValue}, answer: ${(resumeData as any).answer}` };
    });

    const fallbackStepAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { result: `fallback: ${inputData.mappedValue}` };
    });

    // Helper to build the workflow (simulates reconstruction after server restart)
    const buildWorkflow = () => {
      const suspendingStep = createStep({
        id: 'suspending-step',
        inputSchema: z.object({ mappedValue: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: suspendingStepAction,
      });

      const nestedWorkflow = createWorkflow({
        id: 'sr-nested-wf-with-suspend',
        inputSchema: z.object({ mappedValue: z.number() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .then(suspendingStep)
        .commit();

      const fallbackStep = createStep({
        id: 'fallback-step',
        inputSchema: z.object({ mappedValue: z.number() }),
        outputSchema: z.object({ result: z.string() }),
        execute: fallbackStepAction,
      });

      const mainWorkflow = createWorkflow({
        id: 'sr-map-branch-suspend-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ result: z.string() }),
      })
        .map(async ({ inputData }) => {
          return { mappedValue: inputData.value * 2 };
        })
        .branch([
          [
            async ({ inputData }) => {
              conditionSpy(inputData);
              return inputData.mappedValue > 10;
            },
            nestedWorkflow,
          ],
          [
            async ({ inputData }) => {
              conditionSpy(inputData);
              return inputData.mappedValue <= 10;
            },
            fallbackStep,
          ],
        ])
        .commit();

      return { mainWorkflow, nestedWorkflow };
    };

    const { mainWorkflow } = buildWorkflow();

    workflows['sr-map-branch-suspend-workflow'] = {
      workflow: mainWorkflow,
      nestedWorkflowId: 'sr-nested-wf-with-suspend',
      buildWorkflow,
      mocks: { suspendingStepAction, fallbackStepAction, conditionSpy },
      resetMocks: () => {
        suspendingStepAction.mockClear();
        fallbackStepAction.mockClear();
        conditionSpy.mockClear();
      },
    };
  }

  // Test: should provide access to suspendData in workflow step on resume
  {
    const suspendDataAccessStep = createStep({
      id: 'suspend-data-access-test',
      inputSchema: z.object({
        value: z.string(),
      }),
      resumeSchema: z.object({
        confirm: z.boolean(),
      }),
      suspendSchema: z.object({
        reason: z.string(),
        originalValue: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
        wasResumed: z.boolean(),
        suspendReason: z.string().optional(),
      }),
      execute: async ({ inputData, resumeData, suspend, suspendData }: any) => {
        const { value } = inputData;
        const { confirm } = resumeData ?? {};

        // On first execution, suspend with context
        if (!confirm) {
          return await suspend({
            reason: 'User confirmation required',
            originalValue: value,
          });
        }

        // On resume, we can now access the suspend data!
        const suspendReason = suspendData?.reason || 'Unknown';
        const originalValue = suspendData?.originalValue || 'Unknown';

        return {
          result: `Processed ${originalValue} after ${suspendReason}`,
          wasResumed: true,
          suspendReason,
        };
      },
    });

    const workflow = createWorkflow({
      id: 'suspend-data-access-workflow',
      inputSchema: z.object({
        value: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
        wasResumed: z.boolean(),
        suspendReason: z.string().optional(),
      }),
    });

    workflow.then(suspendDataAccessStep).commit();

    workflows['suspend-data-access-workflow'] = {
      workflow,
      suspendDataAccessStep,
      mocks: {},
    };
  }

  return workflows;
}

export function createSuspendResumeTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute } = ctx;

  describe('Suspend and Resume', () => {
    it('should return the correct runId', async () => {
      const { workflow, mocks } = registry!['suspend-resume-runid-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(mocks.executeFn).toHaveBeenCalled();
    });

    it('should suspend workflow when suspend is called', async () => {
      const { workflow, mocks } = registry!['suspend-test-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'waiting for approval' },
      });
    });

    it('should handle suspend with empty payload', async () => {
      const { workflow } = registry!['empty-suspend-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(result.steps.step1).toMatchObject({
        status: 'suspended',
      });
    });

    it('should suspend with typed payload and suspendSchema', async () => {
      const { workflow, mocks } = registry!['typed-suspend-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(result.steps.step1).toMatchObject({
        status: 'suspended',
        suspendPayload: {
          approvalRequired: true,
          requestedBy: 'user-123',
          amount: 500,
        },
      });
    });

    it('should not execute steps after suspended step', async () => {
      const { workflow, mocks } = registry!['suspend-stops-execution-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      // Step 3 should NOT be executed because step 2 suspended
      expect(mocks.step3Action).toHaveBeenCalledTimes(0);

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'approval needed' },
      });
      // Step 3 should not have a result
      expect(result.steps.step3).toBeUndefined();
    });

    it('should handle suspend in conditional branch', async () => {
      const { workflow, mocks } = registry!['suspend-in-branch-workflow']!;

      const result = await execute(workflow, {});

      expect(result.status).toBe('suspended');
      expect(mocks.checkStep).toHaveBeenCalledTimes(1);
      expect(mocks.approvalStep).toHaveBeenCalledTimes(1);
      // Auto-approve should NOT run because the condition went to approval branch
      expect(mocks.autoApproveStep).toHaveBeenCalledTimes(0);

      expect(result.steps.check).toMatchObject({
        status: 'success',
        output: { needsApproval: true },
      });
      expect(result.steps.approval).toMatchObject({
        status: 'suspended',
        suspendPayload: { type: 'manager-approval' },
      });
    });

    // Note: This test only verifies suspend with state - full resume cycle requires storage setup
    it.skipIf(ctx.skipTests.state)('should suspend workflow with state modifications', async () => {
      const { workflow, mocks } = registry!['suspend-resume-with-state-workflow']!;

      const result = await execute(workflow, {}, { initialState: { value: 'initial' } });

      expect(result.status).toBe('suspended');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(mocks.step2Action).toHaveBeenCalledTimes(1);
      // Step 3 should NOT be executed because step 2 suspended
      expect(mocks.step3Action).toHaveBeenCalledTimes(0);

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 'step1-done' },
      });
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'waiting' },
      });
    });

    it('should remain suspended when one of parallel steps suspends', async () => {
      const { workflow, mocks } = registry!['parallel-one-suspend-workflow']!;

      const result = await execute(workflow, {});

      // Workflow should be suspended because one step suspended
      expect(result.status).toBe('suspended');
      expect(mocks.normalStep).toHaveBeenCalledTimes(1);
      expect(mocks.suspendStep).toHaveBeenCalledTimes(1);

      // Normal step completed
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { result: 'normal-done' },
      });

      // Suspend step is suspended
      expect(result.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { waitingFor: 'approval' },
      });
    });

    it('should complete parallel workflow when no steps suspend', async () => {
      const { workflow, mocks } = registry!['parallel-no-suspend-workflow']!;

      const result = await execute(workflow, {});

      // Workflow should complete successfully
      expect(result.status).toBe('success');
      expect(mocks.step1Fn).toHaveBeenCalledTimes(1);
      expect(mocks.step2Fn).toHaveBeenCalledTimes(1);

      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { value: 10 },
      });

      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { value: 20 },
      });
    });

    it('should propagate suspend from nested workflow', async () => {
      const { workflow, mocks, nestedWorkflowId } = registry!['nested-suspend-main']!;

      const result = await execute(workflow, {});

      // Workflow should be suspended because nested workflow suspended
      expect(result.status).toBe('suspended');
      expect(mocks.outerStep).toHaveBeenCalledTimes(1);
      expect(mocks.innerSuspendStep).toHaveBeenCalledTimes(1);

      // Outer step completed
      expect(result.steps['outer-step']).toMatchObject({
        status: 'success',
        output: { value: 'outer-done' },
      });

      // Nested workflow is suspended
      expect(result.steps[nestedWorkflowId]).toMatchObject({
        status: 'suspended',
      });
    });

    // Tests that require explicit resume() support
    it.skipIf(ctx.skipTests.resumeBasic || !ctx.resume)('should handle basic suspend and resume flow', async () => {
      const { workflow, mocks, resetMocks } = registry!['basic-resume-workflow']!;
      resetMocks?.();

      // Generate a unique run ID for this test
      const runId = `resume-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // First execution - should suspend
      const suspendResult = await execute(workflow, {}, { runId });
      expect(suspendResult.status).toBe('suspended');
      expect(mocks.step1Action).toHaveBeenCalledTimes(1);
      expect(suspendResult.steps.step2).toMatchObject({
        status: 'suspended',
        suspendPayload: { reason: 'waiting for user input' },
      });

      // Resume with user input
      const resumeResult = await ctx.resume!(workflow, {
        runId,
        step: 'step2',
        resumeData: { userInput: 'hello from resume' },
      });

      expect(resumeResult.status).toBe('success');
      expect(resumeResult.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'completed', userInput: 'hello from resume' },
      });
    });

    it.skipIf(ctx.skipTests.resumeWithLabel || !ctx.resume)(
      'should handle suspend and resume using resumeLabel',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['resume-with-label-workflow']!;
        resetMocks?.();

        // Generate a unique run ID for this test
        const runId = `resume-label-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // First execution - should suspend
        const suspendResult = await execute(workflow, {}, { runId });
        expect(suspendResult.status).toBe('suspended');
        expect(mocks.step1Action).toHaveBeenCalledTimes(1);
        expect(suspendResult.steps.step2).toMatchObject({
          status: 'suspended',
          suspendPayload: { reason: 'waiting' },
        });

        // Resume using label instead of step
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          label: 'my-custom-label',
          resumeData: { userInput: 'resumed via label' },
        });

        expect(resumeResult.status).toBe('success');
        expect(resumeResult.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'completed', userInput: 'resumed via label' },
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeWithState || !ctx.resume)(
      'should preserve state across suspend and resume cycles',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['state-persistence-resume-workflow']!;
        resetMocks?.();

        const stateValuesObserved = mocks.stateValuesObserved as Array<{ step: string; state: any }>;

        // Generate a unique run ID for this test
        const runId = `state-resume-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow with initial state
        const startResult = await execute(
          workflow,
          {},
          {
            runId,
            initialState: { count: 0, items: [] },
          },
        );

        expect(startResult.status).toBe('suspended');
        expect(stateValuesObserved).toHaveLength(1);
        expect(stateValuesObserved[0]).toEqual({
          step: 'step-1',
          state: { count: 0, items: [] },
        });

        // Resume workflow
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'step1',
          resumeData: { proceed: true },
        });

        expect(resumeResult.status).toBe('success');
        // After resume, step-1 runs again and step-2 runs
        expect(stateValuesObserved.length).toBeGreaterThanOrEqual(2);

        // Step-2 should see the updated state
        const step2Observation = stateValuesObserved.find(o => o.step === 'step-2');
        expect(step2Observation?.state).toEqual({
          count: 1,
          items: ['item-1'],
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeParallelMulti || !ctx.resume)(
      'should handle multiple suspend/resume cycles in parallel workflow',
      async () => {
        const { workflow, resetMocks } = registry!['multi-suspend-parallel-workflow']!;
        resetMocks?.();

        // Generate a unique run ID for this test
        const runId = `multi-parallel-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Initial start - both steps should suspend
        const startResult = await execute(workflow, { value: 10 }, { runId });
        expect(startResult.status).toBe('suspended');

        // First resume of step1 - should still be suspended since step2 also suspended
        const resume1 = await ctx.resume!(workflow, {
          runId,
          step: 'multi-resume-step-1',
          resumeData: { increment: 5 },
        });
        expect(resume1.status).toBe('suspended'); // Should remain suspended until both are done

        // Resume step2 - workflow should complete since both steps are now resolved
        const resume2 = await ctx.resume!(workflow, {
          runId,
          step: 'multi-resume-step-2',
          resumeData: { multiplier: 3 },
        });
        expect(resume2.status).toBe('success');
        if (resume2.status === 'success') {
          expect(resume2.result).toEqual({
            'multi-resume-step-1': { result: 15 },
            'multi-resume-step-2': { result: 30 },
          });
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeMultiSuspendError || !ctx.resume)(
      'should throw error when multiple steps are suspended and no step specified',
      async () => {
        const { workflow, resetMocks } = registry!['multi-suspend-branch-workflow']!;
        resetMocks?.();

        const runId = `multi-suspend-error-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - both branch steps should suspend
        const startResult = await execute(workflow, { value: 100 }, { runId });
        expect(startResult.status).toBe('suspended');

        if (startResult.status === 'suspended') {
          // Should have two suspended steps from different branches
          expect((startResult as any).suspended.length).toBeGreaterThan(1);
        }

        // Test auto-resume should fail with multiple suspended steps
        await expect(
          ctx.resume!(workflow, {
            runId,
            resumeData: { multiplier: 2 },
            // No step parameter - should fail with multiple suspended steps
          }),
        ).rejects.toThrow(/[Mm]ultiple.*suspend/);

        // Test explicit step parameter works correctly
        const explicitResumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'branch-step-1',
          resumeData: { multiplier: 2 },
        });

        // After resuming one step, there should still be another suspended
        expect(explicitResumeResult.status).toBe('suspended');
        if (explicitResumeResult.status === 'suspended') {
          expect((explicitResumeResult as any).suspended).toHaveLength(1);
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeAutoDetect || !ctx.resume)(
      'should support both explicit step resume and auto-resume',
      async () => {
        const { workflow, resetMocks } = registry!['auto-resume-test-workflow']!;
        resetMocks?.();

        // Test 1: Start workflow and suspend
        const runId1 = `auto-resume-explicit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const result1 = await execute(workflow, { value: 42 }, { runId: runId1 });
        expect(result1.status).toBe('suspended');

        // Check that 'suspended' array exists and contains the step
        if (result1.status === 'suspended') {
          expect((result1 as any).suspended).toBeDefined();
          expect((result1 as any).suspended[0]).toContain('suspend-step');
        }

        // Test 2: Resume with explicit step parameter (backwards compatibility)
        const explicitResumeResult = await ctx.resume!(workflow, {
          runId: runId1,
          step: 'suspend-step',
          resumeData: { extraData: 'explicit-resume' },
        });
        expect(explicitResumeResult.status).toBe('success');
        if (explicitResumeResult.status === 'success') {
          expect((explicitResumeResult.result as any).final).toBe('Completed: processed-explicit-resume');
        }

        // Test 3: Auto-resume without step parameter (new feature)
        resetMocks?.();
        const runId2 = `auto-resume-auto-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const result2 = await execute(workflow, { value: 100 }, { runId: runId2 });
        expect(result2.status).toBe('suspended');

        const autoResumeResult = await ctx.resume!(workflow, {
          runId: runId2,
          // No step parameter - should auto-detect
          resumeData: { extraData: 'auto-resume' },
        });
        expect(autoResumeResult.status).toBe('success');
        if (autoResumeResult.status === 'success') {
          expect((autoResumeResult.result as any).final).toBe('Completed: processed-auto-resume');
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeBranchingStatus || !ctx.resume)(
      'should maintain correct step status after resuming in branching workflows',
      async () => {
        const { workflow, resetMocks } = registry!['branching-resume-status-workflow']!;
        resetMocks?.();

        const runId = `branching-resume-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - both steps should suspend
        const initialResult = await execute(workflow, { value: 10 }, { runId });

        expect(initialResult.status).toBe('suspended');
        expect(initialResult.steps['branch-step-1']!.status).toBe('suspended');
        expect(initialResult.steps['branch-step-2']!.status).toBe('suspended');

        if (initialResult.status === 'suspended') {
          expect((initialResult as any).suspended).toHaveLength(2);
          expect((initialResult as any).suspended[0]).toContain('branch-step-1');
          expect((initialResult as any).suspended[1]).toContain('branch-step-2');
        }

        // Resume first branch
        const resumedResult1 = await ctx.resume!(workflow, {
          runId,
          step: 'branch-step-1',
          resumeData: { multiplier: 2 },
        });

        // Workflow should still be suspended (branch-step-2 not resumed yet)
        expect(resumedResult1.status).toBe('suspended');
        expect(resumedResult1.steps['branch-step-1']!.status).toBe('success');
        expect(resumedResult1.steps['branch-step-2']!.status).toBe('suspended');

        if (resumedResult1.status === 'suspended') {
          expect((resumedResult1 as any).suspended).toHaveLength(1);
          expect((resumedResult1 as any).suspended[0]).toContain('branch-step-2');
        }

        // Resume second branch - workflow should complete
        const finalResult = await ctx.resume!(workflow, {
          runId,
          step: 'branch-step-2',
          resumeData: { multiplier: 3 },
        });

        expect(finalResult.status).toBe('success');
        expect(finalResult.steps['branch-step-1']!.status).toBe('success');
        expect(finalResult.steps['branch-step-2']!.status).toBe('success');

        if (finalResult.status === 'success') {
          expect(finalResult.result).toEqual({
            'branch-step-1': { result: 20 }, // 10 * 2
            'branch-step-2': { result: 30 }, // 10 * 3
          });
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeDountil || !ctx.resume)(
      'should handle basic suspend and resume in a dountil workflow',
      async () => {
        const { workflow, nestedWorkflowId, resetMocks } = registry!['dountil-suspend-workflow']!;
        resetMocks?.();

        const runId = `dountil-suspend-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at nested workflow's resume step
        const startResult = await execute(workflow, { value: 0 }, { runId });

        expect(startResult.status).toBe('suspended');
        expect(startResult.steps[nestedWorkflowId]).toMatchObject({
          status: 'suspended',
        });

        // First resume - value is 1 (from increment), resumeData.value is 2
        // finalValue = 2 + 1 = 3, which is < 10, so should suspend again
        const resume1 = await ctx.resume!(workflow, {
          runId,
          step: [nestedWorkflowId, 'resume'],
          resumeData: { value: 2 },
        });

        expect(resume1.status).toBe('suspended');
        expect(resume1.steps[nestedWorkflowId]).toMatchObject({
          status: 'suspended',
        });

        // Second resume - provide value 21 which makes finalValue > 10
        // This should complete the nested workflow and exit the loop
        const resume2 = await ctx.resume!(workflow, {
          runId,
          step: [nestedWorkflowId, 'resume'],
          resumeData: { value: 21 },
        });

        expect(resume2.status).toBe('success');
        expect(resume2.steps[nestedWorkflowId]).toMatchObject({
          status: 'success',
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeLoopInput || !ctx.resume)(
      'should have access to the correct input value when resuming in a loop',
      async () => {
        const { workflow, resetMocks } = registry!['loop-resume-input-workflow']!;
        resetMocks?.();

        const runId = `loop-resume-input-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend immediately
        const startResult = await execute(workflow, { value: 0, condition: false }, { runId });
        expect(startResult.status).toBe('suspended');

        // First resume - should increment to 1 and suspend again
        const resume1 = await ctx.resume!(workflow, {
          runId,
          resumeData: { shouldContinue: true },
        });
        expect(resume1.status).toBe('suspended');
        expect((resume1.steps['step-1']!.payload as any).value).toBe(1);

        // Second resume - should increment to 2 and suspend again
        const resume2 = await ctx.resume!(workflow, {
          runId,
          resumeData: { shouldContinue: true },
        });
        expect(resume2.status).toBe('suspended');
        expect((resume2.steps['step-1']!.payload as any).value).toBe(2);

        // Third resume - should increment to 3 and suspend again
        const resume3 = await ctx.resume!(workflow, {
          runId,
          resumeData: { shouldContinue: true },
        });
        expect(resume3.status).toBe('suspended');
        expect((resume3.steps['step-1']!.payload as any).value).toBe(3);
      },
    );

    it.skipIf(ctx.skipTests.resumeMapStep || !ctx.resume)(
      'should have access to the correct inputValue when resuming a step preceded by a .map step',
      async () => {
        const { workflow, improveResponseStep, resetMocks } = registry!['map-step-resume-workflow']!;
        resetMocks?.();

        const runId = `map-step-resume-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at promptAgent
        const startResult = await execute(workflow, { input: 'test' }, { runId });
        expect(startResult.status).toBe('suspended');
        expect(startResult.steps.promptAgent!.status).toBe('suspended');
        expect(startResult.steps.getUserInput).toMatchObject({
          status: 'success',
          output: { userInput: 'test' },
        });

        // First resume - resume promptAgent, should proceed to map step then suspend at improveResponse
        const resume1 = await ctx.resume!(workflow, {
          runId,
          step: 'promptAgent',
          resumeData: { userInput: 'input for resumption' },
        });
        expect(resume1.status).toBe('suspended');
        expect(resume1.steps.promptAgent).toMatchObject({
          status: 'success',
          output: { modelOutput: 'test input for resumption' },
        });
        expect(resume1.steps.evaluateToneConsistency).toMatchObject({
          status: 'success',
          output: { toneScore: { score: 0.8 }, completenessScore: { score: 0.7 } },
        });
        expect(resume1.steps.improveResponse!.status).toBe('suspended');

        // Second resume - resume improveResponse, workflow should complete
        const resume2 = await ctx.resume!(workflow, {
          runId,
          step: improveResponseStep,
          resumeData: {
            toneScore: { score: 0.9 },
            completenessScore: { score: 0.8 },
          },
        });
        expect(resume2.status).toBe('success');
        expect(resume2.steps.improveResponse!.status).toBe('success');
        expect((resume2.steps.improveResponse!.output as any).improvedOutput).toBe('improved output');
        // Use approximate matching for floating point calculations
        const improveOutput = (resume2.steps.improveResponse!.output as any).overallScore;
        expect(improveOutput.toneScore.score).toBeCloseTo(0.85, 10); // (0.8 + 0.9) / 2
        expect(improveOutput.completenessScore.score).toBeCloseTo(0.75, 10); // (0.7 + 0.8) / 2

        expect(resume2.steps.evaluateImprovedResponse!.status).toBe('success');
        const evalOutput = resume2.steps.evaluateImprovedResponse!.output as any;
        expect(evalOutput.toneScore.score).toBeCloseTo(0.85, 10);
        expect(evalOutput.completenessScore.score).toBeCloseTo(0.75, 10);
      },
    );

    it.skipIf(ctx.skipTests.resumeForeach || !ctx.resume)('should suspend and resume in foreach loop', async () => {
      const { workflow, resetMocks } = registry!['foreach-suspend-workflow']!;
      resetMocks?.();

      const runId = `foreach-suspend-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Start workflow with 3 items - should suspend on first item
      const startResult = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }], { runId });
      expect(startResult.status).toBe('suspended');

      // Resume first item
      const resume1 = await ctx.resume!(workflow, {
        runId,
        resumeData: { resumeValue: 0 },
      });
      expect(resume1.status).toBe('suspended');

      // Resume second item
      const resume2 = await ctx.resume!(workflow, {
        runId,
        resumeData: { resumeValue: 5 },
      });
      expect(resume2.status).toBe('suspended');

      // Resume third item - workflow should complete
      const resume3 = await ctx.resume!(workflow, {
        runId,
        resumeData: { resumeValue: 0 },
      });
      expect(resume3.status).toBe('success');

      // Verify final result
      expect(resume3.steps.map).toMatchObject({
        status: 'success',
        output: [{ value: 12 }, { value: 38 }, { value: 344 }], // 1+11+0, 22+11+5, 333+11+0
      });
      expect(resume3.steps.final).toMatchObject({
        status: 'success',
        output: { finalValue: 12 + 38 + 344 }, // 394
      });
    });

    it.skipIf(ctx.skipTests.resumeForeachConcurrent || !ctx.resume)(
      'should suspend and resume when running concurrent foreach',
      async () => {
        const { workflow, resetMocks } = registry!['foreach-concurrent-suspend-workflow']!;
        resetMocks?.();

        const runId = `foreach-concurrent-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow with 3 items - value=1 completes, value=22 and value=333 suspend
        const startResult = await execute(workflow, [{ value: 22 }, { value: 1 }, { value: 333 }], { runId });
        expect(startResult.status).toBe('suspended');

        // Resume all suspended items at once (concurrent mode)
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          resumeData: { resumeValue: 5 },
        });
        expect(resumeResult.status).toBe('success');

        // value=22: 22+11+5=38, value=1: 1+11+0=12 (didn't suspend), value=333: 333+11+5=349
        expect(resumeResult.steps.map).toMatchObject({
          status: 'success',
          output: [{ value: 38 }, { value: 12 }, { value: 349 }],
        });
        expect(resumeResult.steps.final).toMatchObject({
          status: 'success',
          output: { finalValue: 38 + 12 + 349 }, // 399
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeForeachIndex || !ctx.resume)(
      'should suspend and resume with forEachIndex',
      async () => {
        const { workflow, resetMocks } = registry!['foreach-index-suspend-workflow']!;
        resetMocks?.();

        const runId = `foreach-index-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow with 3 items - all suspend (concurrent mode)
        const startResult = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }], { runId });
        expect(startResult.status).toBe('suspended');

        // Resume only index 0 with different value
        const resume1 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 0,
          resumeData: { resumeValue: 100 },
        });
        expect(resume1.status).toBe('suspended'); // Still suspended, other items not resumed

        // Resume index 1
        const resume2 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 1,
          resumeData: { resumeValue: 200 },
        });
        expect(resume2.status).toBe('suspended'); // Still suspended, one more item

        // Resume index 2 - workflow should complete
        const resume3 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 2,
          resumeData: { resumeValue: 300 },
        });
        expect(resume3.status).toBe('success');

        // value=1: 1+11+100=112, value=22: 22+11+200=233, value=333: 333+11+300=644
        expect(resume3.steps.map).toMatchObject({
          status: 'success',
          output: [{ value: 112 }, { value: 233 }, { value: 644 }],
        });
        expect(resume3.steps.final).toMatchObject({
          status: 'success',
          output: { finalValue: 112 + 233 + 644 }, // 989
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeForeachLabel || !ctx.resume)(
      'should suspend and resume provided label when running all items concurrency for loop',
      async () => {
        const { workflow, resetMocks } = registry!['foreach-label-suspend-workflow']!;
        resetMocks?.();

        const runId = `foreach-label-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow with 3 items - all suspend with labels (concurrent mode)
        const startResult = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }], { runId });
        expect(startResult.status).toBe('suspended');

        // Resume by label 2 (third item, index 2)
        const resume1 = await ctx.resume!(workflow, {
          runId,
          label: 'foreach-label-2',
          resumeData: { resumeValue: 5 },
        });
        expect(resume1.status).toBe('suspended');

        // Resume by label 1 (second item, index 1)
        const resume2 = await ctx.resume!(workflow, {
          runId,
          label: 'foreach-label-1',
          resumeData: { resumeValue: 0 },
        });
        expect(resume2.status).toBe('suspended');

        // Resume by label 0 (first item, index 0) - workflow should complete
        const resume3 = await ctx.resume!(workflow, {
          runId,
          label: 'foreach-label-0',
          resumeData: { resumeValue: 3 },
        });
        expect(resume3.status).toBe('success');

        // value=1: 1+11+3=15, value=22: 22+11+0=33, value=333: 333+11+5=349
        expect(resume3.steps.map).toMatchObject({
          status: 'success',
          output: [{ value: 15 }, { value: 33 }, { value: 349 }],
        });
        expect(resume3.steps.final).toMatchObject({
          status: 'success',
          output: { finalValue: 15 + 33 + 349 }, // 397
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeForeachPartial || !ctx.resume)(
      'should suspend and resume when running a partial item concurrency for loop',
      async () => {
        const { workflow, resetMocks } = registry!['foreach-partial-suspend-workflow']!;
        resetMocks?.();

        const runId = `foreach-partial-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start with 5 items, concurrency=2
        // Items with value > 5 will suspend: 22, 333, 444, 1000 (4 suspends)
        // Item with value=1 will complete immediately
        const startResult = await execute(
          workflow,
          [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
          { runId },
        );
        expect(startResult.status).toBe('suspended');

        // Resume - should resume batch of suspended items
        const resume1 = await ctx.resume!(workflow, {
          runId,
          resumeData: { resumeValue: 5 },
        });
        expect(resume1.status).toBe('suspended'); // Still more suspended items

        // Resume again to complete remaining suspended items
        const resume2 = await ctx.resume!(workflow, {
          runId,
          resumeData: { resumeValue: 5 },
        });
        expect(resume2.status).toBe('success');

        // All values completed: 22+11+5=38, 1+11=12, 333+11+5=349, 444+11+5=460, 1000+11+5=1016
        expect(resume2.steps.final).toMatchObject({
          status: 'success',
          output: { finalValue: 38 + 12 + 349 + 460 + 1016 }, // 1875
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeForeachPartialIndex || !ctx.resume)(
      'should suspend and resume provided index when running a partial item concurrency for loop',
      async () => {
        const { workflow, resetMocks } = registry!['foreach-partial-index-suspend-workflow']!;
        resetMocks?.();

        const runId = `foreach-partial-index-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start with 5 items, concurrency=3
        // Items with value > 5 will suspend: 22, 333, 444, 1000 (4 suspends)
        const startResult = await execute(
          workflow,
          [{ value: 22 }, { value: 1 }, { value: 333 }, { value: 444 }, { value: 1000 }],
          { runId },
        );
        expect(startResult.status).toBe('suspended');

        // Resume index 2 (value=333)
        const resume1 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 2,
          resumeData: { resumeValue: 5 },
        });
        expect(resume1.status).toBe('suspended');

        // Resume index 0 (value=22)
        const resume2 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 0,
          resumeData: { resumeValue: 3 },
        });
        expect(resume2.status).toBe('suspended');

        // Resume index 3 (value=444)
        const resume3 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 3,
          resumeData: { resumeValue: 2 },
        });
        expect(resume3.status).toBe('suspended');

        // Resume index 4 (value=1000) - workflow should complete
        const resume4 = await ctx.resume!(workflow, {
          runId,
          forEachIndex: 4,
          resumeData: { resumeValue: 8 },
        });
        expect(resume4.status).toBe('success');

        // 22+11+3=36, 1+11=12, 333+11+5=349, 444+11+2=457, 1000+11+8=1019
        expect(resume4.steps.final).toMatchObject({
          status: 'success',
          output: { finalValue: 36 + 12 + 349 + 457 + 1019 }, // 1873
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeNested || !ctx.resume)(
      'should be able to resume suspended nested workflow step',
      async () => {
        const { workflow, nestedWorkflowId, mocks, resetMocks } = registry!['nested-resume-workflow']!;
        resetMocks?.();

        const runId = `nested-resume-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at nested workflow's 'other' step
        const startResult = await execute(workflow, { startValue: 0 }, { runId });

        expect(startResult.status).toBe('suspended');
        expect(mocks.beginAction).toHaveBeenCalledTimes(1);
        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(1);
        expect(mocks.finalAction).toHaveBeenCalledTimes(0);
        expect(mocks.lastAction).toHaveBeenCalledTimes(0);

        expect(startResult.steps[nestedWorkflowId]).toMatchObject({
          status: 'suspended',
        });
        expect(startResult.steps['last-step']).toBeUndefined();

        // Resume nested workflow by specifying nested workflow ID
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: nestedWorkflowId,
          resumeData: { newValue: 0 },
        });

        expect(resumeResult.status).toBe('success');
        expect(resumeResult.steps[nestedWorkflowId]).toMatchObject({
          status: 'success',
          output: { finalValue: 27 }, // 1 (from start) + 26 (from other)
        });

        // Verify all steps were called correctly
        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(2); // Called on initial + resume
        expect(mocks.finalAction).toHaveBeenCalledTimes(1);
        expect(mocks.lastAction).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(ctx.skipTests.resumeConsecutiveNested || !ctx.resume)(
      'should handle consecutive nested workflows with suspend/resume',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['consecutive-nested-resume-workflow']!;
        resetMocks?.();

        const runId = `consecutive-nested-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at first nested workflow
        const startResult = await execute(workflow, { suspect: 'initial-suspect' }, { runId });

        expect(startResult.status).toBe('suspended');
        expect(mocks.step1Action).toHaveBeenCalledTimes(1);
        expect(mocks.step2Action).toHaveBeenCalledTimes(0);
        expect(startResult.steps['sub-workflow-1']).toMatchObject({
          status: 'suspended',
        });

        // Resume first nested workflow - should proceed to second and suspend there
        const resume1 = await ctx.resume!(workflow, {
          runId,
          step: ['sub-workflow-1', 'step-1'],
          resumeData: { suspect: 'first-suspect' },
        });

        expect(resume1.status).toBe('suspended');
        expect(mocks.step1Action).toHaveBeenCalledTimes(2);
        expect(mocks.step2Action).toHaveBeenCalledTimes(1);
        expect(resume1.steps['sub-workflow-1']).toMatchObject({
          status: 'success',
        });
        expect(resume1.steps['sub-workflow-2']).toMatchObject({
          status: 'suspended',
        });

        // Resume second nested workflow - workflow should complete
        const resume2 = await ctx.resume!(workflow, {
          runId,
          step: 'sub-workflow-2.step-2',
          resumeData: { suspect: 'second-suspect' },
        });

        expect(resume2.status).toBe('success');
        expect(mocks.step1Action).toHaveBeenCalledTimes(2);
        expect(mocks.step2Action).toHaveBeenCalledTimes(2);
        expect(resume2.steps['sub-workflow-1']).toMatchObject({
          status: 'success',
        });
        expect(resume2.steps['sub-workflow-2']).toMatchObject({
          status: 'success',
        });
        if (resume2.status === 'success') {
          expect(resume2.result).toEqual({ suspect: 'second-suspect' });
        }
      },
    );

    // Bug regression test #6418 - parallel suspended steps should remain suspended until all are resumed
    it.skipIf(ctx.skipTests.resumeParallelMulti || !ctx.resume)(
      'should remain suspended when only one of multiple parallel suspended steps is resumed - #6418',
      async () => {
        const { workflow, resetMocks } = registry!['parallel-suspension-bug-6418-workflow']!;
        resetMocks?.();

        const runId = `parallel-6418-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - both parallel steps should suspend
        const startResult = await execute(workflow, { value: 100 }, { runId });
        expect(startResult.status).toBe('suspended');
        if (startResult.status === 'suspended') {
          expect((startResult as any).suspended).toHaveLength(2);
        }

        // Resume ONLY the first parallel step
        const resumeResult1 = await ctx.resume!(workflow, {
          runId,
          step: 'parallel-step-1',
          resumeData: { multiplier: 2 },
        });
        expect(resumeResult1.status).toBe('suspended');
        if (resumeResult1.status === 'suspended') {
          expect((resumeResult1 as any).suspended).toHaveLength(1);
          expect((resumeResult1 as any).suspended[0]).toContain('parallel-step-2');
        }

        // Only after resuming the second step should the workflow complete
        const resumeResult2 = await ctx.resume!(workflow, {
          runId,
          step: 'parallel-step-2',
          resumeData: { divisor: 5 },
        });
        expect(resumeResult2.status).toBe('success');
        if (resumeResult2.status === 'success') {
          expect(resumeResult2.result).toEqual({
            'parallel-step-1': { result: 200 },
            'parallel-step-2': { result: 20 },
          });
        }
      },
    );

    // Bug regression test #4442 - requestContext should work during suspend/resume
    it.skipIf(ctx.skipTests.resumeWithState || !ctx.resume)('should work with requestContext - bug #4442', async () => {
      const { workflow, mocks, resetMocks } = registry!['requestcontext-bug-4442-workflow']!;
      resetMocks?.();

      const runId = `requestcontext-4442-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Start workflow - should suspend at promptAgent step
      const initialResult = await execute(workflow, { input: 'test' }, { runId });
      expect(initialResult.steps.promptAgent!.status).toBe('suspended');
      expect(mocks.promptAgentAction).toHaveBeenCalledTimes(1);

      // Resume with user input
      const resumeResult = await ctx.resume!(workflow, {
        runId,
        step: 'promptAgent',
        resumeData: { userInput: 'test input for resumption' },
      });

      expect(mocks.promptAgentAction).toHaveBeenCalledTimes(2);
      expect(resumeResult.steps.requestContextAction!.status).toBe('success');
      // @ts-expect-error - testing dynamic workflow result
      expect(resumeResult.steps.requestContextAction.output).toEqual(['first message', 'promptAgentAction']);
    });

    // Bug regression test #6419 - branching workflow step status after resume
    it.skipIf(ctx.skipTests.resumeBranchingStatus || !ctx.resume)(
      'should maintain correct step status after resuming in branching workflows - #6419',
      async () => {
        const { workflow, resetMocks } = registry!['branching-state-bug-6419-workflow']!;
        resetMocks?.();

        const runId = `branching-6419-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - both steps should suspend
        const initialResult = await execute(workflow, { value: 10 }, { runId });

        expect(initialResult.status).toBe('suspended');
        expect(initialResult.steps['branch-step-1']!.status).toBe('suspended');
        expect(initialResult.steps['branch-step-2']!.status).toBe('suspended');
        if (initialResult.status === 'suspended') {
          expect((initialResult as any).suspended).toHaveLength(2);
          expect((initialResult as any).suspended[0]).toContain('branch-step-1');
          expect((initialResult as any).suspended[1]).toContain('branch-step-2');
        }

        // Resume only branch-step-1
        const resumedResult1 = await ctx.resume!(workflow, {
          runId,
          step: 'branch-step-1',
          resumeData: { multiplier: 2 },
        });

        // Workflow should still be suspended (branch-step-2 not resumed yet)
        expect(resumedResult1.status).toBe('suspended');
        expect(resumedResult1.steps['branch-step-1']!.status).toBe('success');
        expect(resumedResult1.steps['branch-step-2']!.status).toBe('suspended');
        if (resumedResult1.status === 'suspended') {
          expect((resumedResult1 as any).suspended).toHaveLength(1);
          expect((resumedResult1 as any).suspended[0]).toContain('branch-step-2');
        }

        // Resume branch-step-2 to complete the workflow
        const finalResult = await ctx.resume!(workflow, {
          runId,
          step: 'branch-step-2',
          resumeData: { multiplier: 3 },
        });

        expect(finalResult.status).toBe('success');
        expect(finalResult.steps['branch-step-1']!.status).toBe('success');
        expect(finalResult.steps['branch-step-2']!.status).toBe('success');
        if (finalResult.status === 'success') {
          expect(finalResult.result).toEqual({
            'branch-step-1': { result: 20 }, // 10 * 2
            'branch-step-2': { result: 30 }, // 10 * 3
          });
        }
      },
    );

    // Bug regression test #6669 - correct input value when resuming in a loop
    it.skipIf(ctx.skipTests.resumeLoopInput || !ctx.resume)(
      'should have access to the correct input value when resuming in a loop - bug #6669',
      async () => {
        const { workflow, resetMocks } = registry!['loop-input-bug-6669-workflow']!;
        resetMocks?.();

        const runId = `loop-input-6669-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at first iteration
        const initialResult = await execute(workflow, { value: 0, condition: false }, { runId });

        expect(initialResult.status).toBe('suspended');

        // Resume first time - value becomes 1
        const firstResume = await ctx.resume!(workflow, {
          runId,
          resumeData: { shouldContinue: true },
        });

        expect((firstResume.steps['step-1']!.payload as any).value).toBe(1);

        // Resume second time - value becomes 2
        const secondResume = await ctx.resume!(workflow, {
          runId,
          resumeData: { shouldContinue: true },
        });
        expect((secondResume.steps['step-1']!.payload as any).value).toBe(2);

        // Resume third time - value becomes 3
        const thirdResume = await ctx.resume!(workflow, {
          runId,
          resumeData: { shouldContinue: true },
        });

        expect((thirdResume.steps['step-1']!.payload as any).value).toBe(3);
        expect(thirdResume.status).toBe('suspended');
      },
    );

    // Bug regression test #5650 - nested dountil suspend/resume
    it.skipIf(ctx.skipTests.resumeDountil || !ctx.resume)(
      'should handle basic suspend and resume in nested dountil workflow - bug #5650',
      async () => {
        const { workflow, nestedWorkflowId, resetMocks } = registry!['nested-dountil-bug-5650-workflow']!;
        resetMocks?.();

        const runId = `nested-dountil-5650-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - nested workflow should suspend at increment step
        const initialResult = await execute(workflow, { value: 2 }, { runId });

        expect(initialResult.steps[nestedWorkflowId!]).toMatchObject({
          status: 'suspended',
        });

        // Resume with increment of 2, value becomes 4
        // Since 4 < 10, the loop continues and the nested workflow suspends again
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          resumeData: { amountToIncrementBy: 2 },
          step: [nestedWorkflowId!, 'increment'],
        });

        // After resume with increment of 2, value becomes 4
        // Since 4 < 10, the loop continues and the nested workflow suspends again
        expect(resumeResult.steps[nestedWorkflowId!]).toMatchObject({
          status: 'suspended',
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeAutoNoStep || !ctx.resume)(
      'should auto-resume without specifying step parameter when only one step is suspended',
      async () => {
        const { workflow, resetMocks } = registry!['suspend-resume-auto-nonstep-workflow']!;
        resetMocks?.();

        const runId = `auto-nonstep-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Execute workflow - should suspend at step1
        const initialResult = await execute(workflow, { value: 10 }, { runId });
        expect(initialResult.status).toBe('suspended');

        // Resume WITHOUT specifying step - engine should auto-detect the single suspended step
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          resumeData: { multiplier: 5 },
        });

        expect(resumeResult.status).toBe('success');
        if (resumeResult.status === 'success') {
          expect((resumeResult.result as any).result).toBe(50);
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeSchemaDefaults || !ctx.resume)(
      'should use resumeSchema defaults when resuming with empty data',
      async () => {
        const { workflow, resetMocks } = registry!['suspend-resume-schema-defaults-workflow']!;
        resetMocks?.();

        const runId = `schema-defaults-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Execute with value: 0 - increment produces value: 1, resume step suspends since 1 < 10
        const initialResult = await execute(workflow, { value: 0 }, { runId });
        expect(initialResult.status).toBe('suspended');

        // Resume with empty object - resumeSchema default of 21 should be used
        // resume step computes: resumeData.value (21) + inputData.value (1) = 22
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'resume',
          resumeData: {},
        });

        expect(resumeResult.status).toBe('success');
        if (resumeResult.status === 'success') {
          expect((resumeResult.result as any).value).toBe(22);
        }
      },
    );

    it.skipIf(ctx.skipTests.consecutiveParallel)(
      'should handle consecutive parallel chains with merged outputs',
      async () => {
        const { workflow, resetMocks } = registry!['suspend-resume-consecutive-parallel-workflow']!;
        resetMocks?.();

        const result = await execute(workflow, { input: 'test' });

        expect(result.status).toBe('success');

        // Verify first parallel group outputs
        expect((result.steps['step1']?.output as any)?.result1).toBe('processed-test');
        expect((result.steps['step2']?.output as any)?.result2).toBe('transformed-test');

        // Verify second parallel group received merged outputs from first group
        expect((result.steps['step3']?.output as any)?.result3).toBe('combined-processed-test-transformed-test');
        expect((result.steps['step4']?.output as any)?.result4).toBe('final-processed-test-transformed-test');
      },
    );

    it.skipIf(ctx.skipTests.resumeNotSuspendedWorkflow || !ctx.resume)(
      'should throw error when resuming a non-suspended workflow',
      async () => {
        const { workflow, resetMocks } = registry!['suspend-resume-not-suspended-workflow']!;
        resetMocks?.();

        const runId = `not-suspended-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Execute workflow - should complete successfully (no suspend)
        const initialResult = await execute(workflow, { value: 0 }, { runId });
        expect(initialResult.status).toBe('success');

        // Try to resume a non-suspended workflow - should throw or return failed
        try {
          const resumeResult = await ctx.resume!(workflow, {
            runId,
            step: 'increment',
            resumeData: { value: 2 },
          });
          // If it doesn't throw, it should return a failed status
          expect(resumeResult.status).toBe('failed');
        } catch (error: any) {
          // If it throws, the error message should indicate the workflow is not suspended
          expect(error.message).toMatch(/[Ss]uspend|[Nn]ot.*paused|[Nn]ot.*suspended|[Cc]annot.*resume/);
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeInvalidData || !ctx.resume)(
      'should throw error when resuming with invalid data then succeed with valid data',
      async () => {
        const { workflow, resetMocks } = registry!['suspend-resume-invalid-data-workflow']!;
        resetMocks?.();

        const runId = `invalid-data-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Execute with value: 0 - increment produces value: 1, resume step suspends
        const initialResult = await execute(workflow, { value: 0 }, { runId });
        expect(initialResult.status).toBe('suspended');

        // Resume with wrong field name {number: 2} instead of {value: 2} - should fail
        try {
          const invalidResumeResult = await ctx.resume!(workflow, {
            runId,
            step: 'resume',
            resumeData: { number: 2 },
          });
          // If it doesn't throw, it should return a failed status
          expect(invalidResumeResult.status).toBe('failed');
        } catch (error: any) {
          // If it throws, that's expected for schema validation failure
          expect(error).toBeDefined();
        }

        // Resume with correct data {value: 21} - should succeed
        // resume step computes: resumeData.value (21) + inputData.value (1) = 22
        const validResumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'resume',
          resumeData: { value: 21 },
        });

        expect(validResumeResult.status).toBe('success');
        if (validResumeResult.status === 'success') {
          expect((validResumeResult.result as any).value).toBe(22);
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeNonSuspendedStep || !ctx.resume)(
      'should throw error when you try to resume a workflow step that is not suspended',
      async () => {
        const { workflow, resetMocks } = registry!['suspend-resume-non-suspended-step-workflow']!;
        resetMocks?.();

        const runId = `non-suspended-step-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Execute with value: 0 - increment produces value: 1, resume step suspends
        const initialResult = await execute(workflow, { value: 0 }, { runId });
        expect(initialResult.status).toBe('suspended');

        // Try to resume the 'increment' step which is NOT suspended (the 'resume' step is)
        try {
          const wrongStepResult = await ctx.resume!(workflow, {
            runId,
            step: 'increment',
            resumeData: { value: 2 },
          });
          // If it doesn't throw, it should return a failed status
          expect(wrongStepResult.status).toBe('failed');
        } catch (error: any) {
          // If it throws, the error message should indicate the step is not suspended
          expect(error.message).toMatch(/[Ss]uspend|[Nn]ot.*paused|[Nn]ot.*suspended|[Cc]annot.*resume|increment/);
        }

        // Now resume correctly with the 'resume' step
        // resume step computes: resumeData.value (21) + inputData.value (1) = 22
        const correctResult = await ctx.resume!(workflow, {
          runId,
          step: 'resume',
          resumeData: { value: 21 },
        });

        expect(correctResult.status).toBe('success');
        if (correctResult.status === 'success') {
          expect((correctResult.result as any).value).toBe(22);
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeNestedWithPath || !ctx.resume)(
      'should be able to suspend nested workflow step',
      async () => {
        const { workflow, nestedWorkflow, otherStep, mocks, resetMocks } =
          registry!['sr-suspend-nested-step-workflow']!;
        resetMocks?.();

        const runId = `suspend-nested-step-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at nested workflow's 'other' step
        const result = await execute(workflow, { startValue: 0 }, { runId });
        expect(mocks.beginAction).toHaveBeenCalledTimes(1);
        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(1);
        expect(mocks.finalAction).toHaveBeenCalledTimes(0);
        expect(mocks.lastAction).toHaveBeenCalledTimes(0);
        expect(result.steps['sr-nested-wf-suspend-step']).toMatchObject({
          status: 'suspended',
        });
        expect(result.steps['last-step']).toEqual(undefined);

        // Resume nested workflow by specifying [nestedWorkflow, otherStep] path
        const resumedResults = await ctx.resume!(workflow, {
          runId,
          step: [nestedWorkflow, otherStep],
          resumeData: { newValue: 0 },
        });

        expect(resumedResults.steps['sr-nested-wf-suspend-step']).toMatchObject({
          status: 'success',
          output: { finalValue: 26 + 1 },
        });

        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(2);
        expect(mocks.finalAction).toHaveBeenCalledTimes(1);
        expect(mocks.lastAction).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(ctx.skipTests.resumeNestedOnlyWfStep || !ctx.resume)(
      'should be able to resume suspended nested workflow step with only nested workflow step provided',
      async () => {
        const { workflow, nestedWorkflowId, mocks, resetMocks } = registry!['sr-suspend-nested-step-workflow']!;
        resetMocks?.();

        const runId = `resume-nested-only-wf-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at nested workflow's 'other' step
        const result = await execute(workflow, { startValue: 0 }, { runId });
        expect(mocks.beginAction).toHaveBeenCalledTimes(1);
        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(1);
        expect(mocks.finalAction).toHaveBeenCalledTimes(0);
        expect(mocks.lastAction).toHaveBeenCalledTimes(0);
        expect(result.steps[nestedWorkflowId]).toMatchObject({
          status: 'suspended',
        });
        expect(result.steps['last-step']).toEqual(undefined);

        // Resume nested workflow by specifying only the nested workflow step ID (string)
        const resumedResults = await ctx.resume!(workflow, {
          runId,
          step: nestedWorkflowId,
          resumeData: { newValue: 0 },
        });

        expect(resumedResults.steps[nestedWorkflowId]).toMatchObject({
          status: 'success',
          output: { finalValue: 26 + 1 },
        });

        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(2);
        expect(mocks.finalAction).toHaveBeenCalledTimes(1);
        expect(mocks.lastAction).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(ctx.skipTests.resumeNestedRequestContext || !ctx.resume)(
      'should preserve request context in nested workflows after suspend/resume',
      async () => {
        const { workflow, resetMocks } = registry!['sr-request-context-nested-suspend-workflow']!;
        resetMocks?.();

        const runId = `request-context-nested-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow (should suspend)
        const suspendResult = await execute(workflow, {}, { runId });
        expect(suspendResult.status).toBe('suspended');

        // Resume workflow
        const resumeResult = await ctx.resume!(workflow, {
          runId,
          step: 'suspend-step',
          resumeData: { confirmed: true },
        });

        expect(resumeResult.status).toBe('success');
        if (resumeResult.status === 'success') {
          expect((resumeResult.result as any).success).toBe(true);
          expect((resumeResult.result as any).hasTestData).toBe(true);
        }
      },
    );

    it.skipIf(ctx.skipTests.resumeDeepNested || !ctx.resume)(
      'should be able to suspend nested workflow step in a nested workflow step',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['sr-deep-nested-suspend-workflow']!;
        resetMocks?.();

        const runId = `deep-nested-suspend-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const result = await execute(workflow, { startValue: 0 }, { runId });
        expect(mocks.passthroughAction).toHaveBeenCalledTimes(2);
        expect(result.steps['sr-deep-nested-wf-c']).toMatchObject({
          status: 'suspended',
          suspendPayload: {
            __workflow_meta: {
              path: ['sr-deep-nested-wf-b', 'sr-deep-nested-wf-a', 'other'],
            },
          },
        });

        expect(result.steps['last-step']).toEqual(undefined);

        if (result.status !== 'suspended') {
          expect.fail('Workflow should be suspended');
        }
        expect((result as any).suspended[0]).toEqual([
          'sr-deep-nested-wf-c',
          'sr-deep-nested-wf-b',
          'sr-deep-nested-wf-a',
          'other',
        ]);
        const resumedResults = await ctx.resume!(workflow, {
          runId,
          step: (result as any).suspended[0],
          resumeData: { newValue: 0 },
        });

        expect(resumedResults.steps['sr-deep-nested-wf-c']).toMatchObject({
          status: 'success',
          output: { finalValue: 26 + 1 },
        });

        expect(mocks.startAction).toHaveBeenCalledTimes(1);
        expect(mocks.otherAction).toHaveBeenCalledTimes(2);
        expect(mocks.finalAction).toHaveBeenCalledTimes(1);
        expect(mocks.lastAction).toHaveBeenCalledTimes(1);
        expect(mocks.passthroughAction).toHaveBeenCalledTimes(2);
      },
    );

    it.skipIf(ctx.skipTests.resumeIncorrectBranches || !ctx.resume)(
      'should not execute incorrect branches after resuming from suspended nested workflow',
      async () => {
        const { workflow, mocks, resetMocks } = registry!['sr-incorrect-branches-resume-workflow']!;
        resetMocks?.();

        const runId = `incorrect-branches-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow - should suspend at select-item
        const initialResult = await execute(workflow, {}, { runId });
        expect(initialResult.status).toBe('suspended');
        expect(mocks.selectItemAction).toHaveBeenCalledTimes(1);

        if (initialResult.status !== 'suspended') {
          expect.fail('Expected workflow to be suspended');
        }

        // Resume with "second" item selection
        const resumedResult = await ctx.resume!(workflow, {
          runId,
          step: (initialResult as any).suspended[0],
          resumeData: { id: '2', name: 'Item 2', type: 'second' },
        });

        expect(resumedResult.status).toBe('suspended');
        expect(mocks.selectItemAction).toHaveBeenCalledTimes(2);
        expect(mocks.secondItemDateAction).toHaveBeenCalledTimes(1);

        if (resumedResult.status !== 'suspended') {
          expect.fail('Expected workflow to be suspended');
        }

        // Resume with date for second item
        const finalResult = await ctx.resume!(workflow, {
          runId,
          step: (resumedResult as any).suspended[0],
          resumeData: new Date('2024-12-31'),
        });
        expect(finalResult.status).toBe('success');
        expect(mocks.secondItemDateAction).toHaveBeenCalledTimes(2);

        // BUG CHECK: Only the second workflow should have executed
        expect(mocks.firstItemAction).not.toHaveBeenCalled();
        expect(mocks.thirdItemAction).not.toHaveBeenCalled();

        // Only the correct steps should be present in the result
        expect(finalResult.steps['first-item-step']).toBeUndefined();
        expect(finalResult.steps['third-item-step']).toBeUndefined();
        expect(finalResult.steps['sr-second-item-workflow']).toBeDefined();
        expect(finalResult.steps['sr-second-item-workflow']!.status).toBe('success');

        // The final processing step should have been called exactly once
        expect(mocks.finalProcessingAction).toHaveBeenCalledTimes(1);

        // The final processing should only receive the result from the second workflow
        const finalProcessingCall = mocks.finalProcessingAction.mock.calls[0][0];
        expect(finalProcessingCall.inputData).toEqual({
          processed: 'second',
          date: new Date('2024-12-31'),
        });
      },
    );

    it.skipIf(ctx.skipTests.resumeMapBranchCondition || !ctx.resume)(
      'should pass correct inputData to branch condition when resuming after map',
      async () => {
        const { workflow, buildWorkflow, mocks, resetMocks } = registry!['sr-map-branch-suspend-workflow']!;
        resetMocks?.();

        const runId = `map-branch-condition-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start workflow with value=10 (mapped to mappedValue=20, which is > 10, triggers nested wf)
        const initialResult = await execute(workflow, { value: 10 }, { runId });

        expect(initialResult.status).toBe('suspended');
        expect(mocks.conditionSpy).toHaveBeenCalledWith({ mappedValue: 20 });
        mocks.conditionSpy.mockClear();

        // Simulate server restart by building a new workflow
        // (this tests that branch conditions are not re-evaluated with stale map UUIDs)
        const { mainWorkflow: wf2 } = buildWorkflow();

        // Resume using the suspended path from initial result
        if (initialResult.status !== 'suspended') {
          expect.fail('Expected workflow to be suspended');
        }
        const resumedResult = await ctx.resume!(wf2, {
          runId,
          step: (initialResult as any).suspended[0],
          resumeData: { answer: 'hello' },
        });

        // Branch conditions should NOT be re-evaluated during resume
        expect(mocks.conditionSpy).not.toHaveBeenCalled();

        expect(resumedResult.status).toBe('success');
        expect(resumedResult.steps['sr-nested-wf-with-suspend']!.status).toBe('success');
      },
    );

    it.skipIf(ctx.skipTests.suspendDataAccess || !ctx.resume)(
      'should provide access to suspendData in workflow step on resume',
      async () => {
        const { workflow, suspendDataAccessStep } = registry!['suspend-data-access-workflow']!;

        const runId = `suspend-data-access-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start the workflow - should suspend
        const initialResult = await execute(workflow, { value: 'test-value' }, { runId });

        expect(initialResult.status).toBe('suspended');

        // Resume the workflow with confirmation
        const resumedResult = await ctx.resume!(workflow, {
          runId,
          step: suspendDataAccessStep,
          resumeData: { confirm: true },
        });

        expect(resumedResult.status).toBe('success');
        if (resumedResult.status === 'success') {
          expect((resumedResult.result as any).suspendReason).toBe('User confirmation required');
          expect((resumedResult.result as any).result).toBe('Processed test-value after User confirmation required');
        }
      },
    );
  });
}
