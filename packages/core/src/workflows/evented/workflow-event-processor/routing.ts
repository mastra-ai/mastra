import type { RestartExecutionParams, SingleStepEntry, StepFlowEntry } from '../../types';

/** A step graph entry a `workflow.step.run` executes as a step: a single step, or a loop or foreach body. */
export type LeafEntry = SingleStepEntry | Extract<StepFlowEntry, { type: 'loop' | 'foreach' }>;

/** A step graph entry whose `workflow.step.run` goes to its dispatcher instead of running a step. */
type DispatchedEntry = Extract<
  StepFlowEntry,
  { type: 'parallel' | 'conditional' | 'sleep' | 'sleepUntil' | 'foreach' }
>;

export type StepRunRoute =
  | { kind: 'missing' }
  | { kind: 'leaf'; leaf: LeafEntry }
  | { kind: 'dispatch'; container: DispatchedEntry };

/**
 * The one place that decides whether a `workflow.step.run` at `executionPath`
 * runs a leaf or is handed to a dispatcher. A parallel or conditional entry
 * runs its branch at the path's second index, and a foreach runs its body for
 * the item at that index; without the index they dispatch. A restart's event
 * for such an entry carries the index only when the restart flags say it
 * targets that branch or item, so otherwise it dispatches too. `missing` is a
 * path that names no entry or no branch.
 */
export function routeStepRun(
  stepGraph: StepFlowEntry[],
  { executionPath, restart }: { executionPath: number[]; restart?: RestartExecutionParams },
): StepRunRoute {
  const entry = stepGraph[executionPath[0]!];
  if (!entry) {
    return { kind: 'missing' };
  }

  const branch = executionPath[1];
  switch (entry.type) {
    case 'parallel':
    case 'conditional': {
      if (branch === undefined || (restart && !restart.isParallelOrConditionalRestarted)) {
        return { kind: 'dispatch', container: entry };
      }

      const leaf = entry.steps[branch];
      return leaf ? { kind: 'leaf', leaf } : { kind: 'missing' };
    }
    case 'foreach': {
      if (branch === undefined || (restart && !restart.isForeachRestarted)) {
        return { kind: 'dispatch', container: entry };
      }

      return { kind: 'leaf', leaf: entry };
    }
    case 'sleep':
    case 'sleepUntil':
      return { kind: 'dispatch', container: entry };
    case 'step':
    case 'agent':
    case 'tool':
    case 'classifier':
    case 'mapping':
    case 'loop':
      return { kind: 'leaf', leaf: entry };
    default: {
      const unrouted: never = entry;
      return unrouted;
    }
  }
}
