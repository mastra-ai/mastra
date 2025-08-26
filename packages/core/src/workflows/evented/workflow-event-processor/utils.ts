import type { Workflow } from '../..';
import type { Mastra, Step, StepFlowEntry } from '../../..';
import { EventedWorkflow } from '../workflow';
import type { ParentWorkflow } from '.';

export function getNestedWorkflow(
  mastra: Mastra,
  { workflowId, executionPath, parentWorkflow }: ParentWorkflow,
): Workflow | null {
  let workflow: Workflow | null = null;

  if (parentWorkflow) {
    const nestedWorkflow = getNestedWorkflow(mastra, parentWorkflow);
    if (!nestedWorkflow) {
      return null;
    }

    workflow = nestedWorkflow;
  }

  workflow = workflow ?? mastra.getWorkflow(workflowId);
  const stepGraph = workflow.stepGraph;
  let parentStep = stepGraph[executionPath[0]!];
  if (parentStep?.type === 'parallel' || parentStep?.type === 'conditional') {
    parentStep = parentStep.steps[executionPath[1]!];
  }

  if (parentStep?.type === 'step' || parentStep?.type === 'loop') {
    return parentStep.step as Workflow;
  }

  return null;
}

export function getStep(workflow: Workflow, executionPath: number[]): Step<string, any, any, any, any, any> | null {
  let idx = 0;
  const stepGraph = workflow.stepGraph;
  let parentStep = stepGraph[executionPath[0]!];
  if (parentStep?.type === 'parallel' || parentStep?.type === 'conditional') {
    parentStep = parentStep.steps[executionPath[1]!];
    idx++;
  } else if (parentStep?.type === 'foreach') {
    return parentStep.step;
  }

  if (!(parentStep?.type === 'step' || parentStep?.type === 'loop' || parentStep?.type === 'waitForEvent')) {
    return null;
  }

  if (parentStep instanceof EventedWorkflow) {
    return getStep(parentStep, executionPath.slice(idx + 1));
  }

  return parentStep.step;
}

export function isExecutableStep(step: StepFlowEntry<any>) {
  return step.type === 'step' || step.type === 'loop' || step.type === 'waitForEvent' || step.type === 'foreach';
}
