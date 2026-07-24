import type { StepFlowEntry, Workflow } from '../..';
import type { Mastra } from '../../../mastra';
import { getEntryId, getEntryWorkflow } from '../../step-entry';
import type { SingleStepEntry } from '../../types';
import { isSingleStepEntry } from '../../utils';
import type { ParentWorkflow } from '.';

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

  // `loop` / `foreach` carry their body as a SingleStepEntry.
  if (parentStep?.type === 'loop' || parentStep?.type === 'foreach') {
    return getEntryWorkflow(parentStep.step);
  }

  if (parentStep && isSingleStepEntry(parentStep)) {
    return getEntryWorkflow(parentStep);
  }

  return null;
}

/**
 * Resolves the single-step entry addressed by an execution path, or null when
 * the path doesn't land on a single-step-like entry. For `loop` / `foreach`
 * the body entry is returned.
 */
export function getStepEntry(workflow: Workflow, executionPath: number[]): SingleStepEntry | null {
  const stepGraph = workflow.stepGraph;
  let parentStep = stepGraph[executionPath[0]!];
  if (parentStep?.type === 'parallel' || parentStep?.type === 'conditional') {
    parentStep = parentStep.steps[executionPath[1]!];
  }

  if (parentStep?.type === 'loop' || parentStep?.type === 'foreach') {
    return parentStep.step;
  }

  if (parentStep && isSingleStepEntry(parentStep)) {
    return parentStep;
  }

  return null;
}

/**
 * Resolves the id of the entry addressed by an execution path, or null when the
 * path doesn't land on a single-step-like entry. For `loop` / `foreach` the id
 * of the body entry is returned.
 */
export function getStepId(workflow: Workflow, executionPath: number[]): string | null {
  const entry = getStepEntry(workflow, executionPath);
  return entry ? getEntryId(entry) : null;
}

export function isExecutableStep(step: StepFlowEntry<any>) {
  return isSingleStepEntry(step) || step.type === 'loop' || step.type === 'foreach';
}
