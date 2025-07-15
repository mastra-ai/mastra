import type { Workflow } from '../..';
import type { Mastra, Step } from '../../..';
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
    return parentStep.step as Workflow; // TODO: this is wrong
  }

  return null;
}

export function getStep(workflow: Workflow, executionPath: number[]): Step<string, any, any, any, any, any> | null {
  console.log('getStep', workflow.id, executionPath);
  let idx = 0;
  const stepGraph = workflow.stepGraph;
  let parentStep = stepGraph[executionPath[0]!];
  if (parentStep?.type === 'parallel' || parentStep?.type === 'conditional') {
    parentStep = parentStep.steps[executionPath[1]!];
    idx++;
  }

  if (!(parentStep?.type === 'step' || parentStep?.type === 'loop')) {
    return null;
  }

  if (parentStep instanceof EventedWorkflow) {
    return getStep(parentStep, executionPath.slice(idx + 1));
  }

  return parentStep.step;
}
