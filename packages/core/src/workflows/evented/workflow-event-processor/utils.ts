import type { Step, StepFlowEntry, Workflow } from '../..';
import type { Mastra } from '../../../mastra';
import { EventedWorkflow } from '../workflow';
import type { ParentWorkflow } from '.';

/**
 * Type guard to check if a step is actually a Workflow.
 * A step is a Workflow if it's an EventedWorkflow instance or has component === 'WORKFLOW'.
 */
function isWorkflowStep(step: unknown): step is Workflow {
  if (!step || typeof step !== 'object') {
    return false;
  }
  // Check for EventedWorkflow instance first (most specific)
  if (step instanceof EventedWorkflow) {
    return true;
  }
  // Check for the 'WORKFLOW' component discriminator (used for nested workflows)
  if ('component' in step && (step as { component?: string }).component === 'WORKFLOW') {
    return true;
  }
  return false;
}

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
    // Validate that the inner step is actually a Workflow before returning
    if (isWorkflowStep(parentStep.step)) {
      return parentStep.step;
    }
    // Not a workflow - this is a regular step, return null
    return null;
  }

  // Handle foreach - validate that the inner step is actually a Workflow
  if (parentStep?.type === 'foreach') {
    if (isWorkflowStep(parentStep.step)) {
      return parentStep.step;
    }
    // Not a workflow - this is a regular step in a foreach, return null
    return null;
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

  if (!(parentStep?.type === 'step' || parentStep?.type === 'loop')) {
    return null;
  }

  if (parentStep instanceof EventedWorkflow) {
    return getStep(parentStep, executionPath.slice(idx + 1));
  }

  return parentStep.step;
}

export function isExecutableStep(step: StepFlowEntry<any>) {
  return step.type === 'step' || step.type === 'loop' || step.type === 'foreach';
}
