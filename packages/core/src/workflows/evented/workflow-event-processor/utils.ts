import type { Step, StepFlowEntry, Workflow } from '../..';
import type { Mastra } from '../../../mastra';
import { isSingleStepEntry } from '../../utils';
import { EventedWorkflow } from '../workflow';
import type { ParentWorkflow } from '.';

export { getInnerStepId, materializeInnerStep } from '../../inner-step';

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
  { workflowId, executionPath, parentWorkflow, runId }: ParentWorkflow,
): Workflow | null {
  let workflow: Workflow | null = null;

  if (parentWorkflow) {
    const nestedWorkflow = getNestedWorkflow(mastra, parentWorkflow);
    if (!nestedWorkflow) {
      return null;
    }

    workflow = nestedWorkflow;
  }

  // Internal workflows (registered via `Mastra.__registerInternalWorkflow`)
  // aren't visible to `Mastra.getWorkflow` — it only sees the public registry.
  // Prefer the internal registry first so nested-workflow resolution works
  // for callers like the bg-tasks `__background-task` workflow. When `runId`
  // is set we hand it to the registry so concurrent invocations sharing the
  // same workflow id (e.g. parent + sub-agent each owning their own
  // `agentic-loop` instance with distinct closures) resolve to the right
  // closure-bound instance instead of whichever one happened to register last.
  workflow =
    workflow ??
    (mastra.__hasInternalWorkflow(workflowId, runId)
      ? mastra.__getInternalWorkflow(workflowId, runId)
      : mastra.getWorkflow(workflowId));
  const stepGraph = workflow.stepGraph;
  let parentStep = stepGraph[executionPath[0]!];
  if (parentStep?.type === 'parallel' || parentStep?.type === 'conditional') {
    parentStep = parentStep.steps[executionPath[1]!];
  }

  if (parentStep?.type === 'step') {
    // Validate that the inner step is actually a Workflow before returning
    if (isWorkflowStep(parentStep.step)) {
      return parentStep.step;
    }
    // Not a workflow - this is a regular step, return null
    return null;
  }

  // Handle loop / foreach - validate that the inner step is actually a Workflow.
  // The inner step is now a SingleStepEntry; only the `type: 'step'` variant
  // can wrap a live Workflow. Declarative agent/tool/mapping entries never
  // nest a workflow.
  if (parentStep?.type === 'loop' || parentStep?.type === 'foreach') {
    if (parentStep.step.type === 'step' && isWorkflowStep(parentStep.step.step)) {
      return parentStep.step.step;
    }
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
    // Foreach inner step is a SingleStepEntry; expose a lightweight handle so
    // callers that only need the id (or `.step` for the classic `type: 'step'`
    // case) keep working without a `mastra` handle in scope.
    if (parentStep.step.type === 'step') {
      return parentStep.step.step;
    }
    return { id: parentStep.step.id } as Step<string, any, any, any, any, any>;
  }

  if (!(parentStep && (isSingleStepEntry(parentStep) || parentStep.type === 'loop'))) {
    return null;
  }

  if (parentStep instanceof EventedWorkflow) {
    return getStep(parentStep, executionPath.slice(idx + 1));
  }

  if (parentStep.type === 'step') {
    return parentStep.step;
  }

  if (parentStep.type === 'loop') {
    if (parentStep.step.type === 'step') {
      return parentStep.step.step;
    }
    return { id: parentStep.step.id } as Step<string, any, any, any, any, any>;
  }

  // Declarative agent / tool / mapping entries are not nested workflows; expose a
  // lightweight id-bearing handle so callers that only need the step id keep working.
  return { id: parentStep.id } as Step<string, any, any, any, any, any>;
}

export function isExecutableStep(step: StepFlowEntry<any>) {
  return isSingleStepEntry(step) || step.type === 'loop' || step.type === 'foreach';
}
