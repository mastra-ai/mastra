import { getEntryId } from '../../step-entry';
import type { RestartExecutionParams, StepFlowEntry, StepResult } from '../../types';
import { getStepIds } from '../../utils';
import { resolveCurrentState } from '../helpers';

/**
 * The id of a finished sleep the run lists as active at its current path
 * `[index]`. A sleep declared without an `id` gets a new generated id in every
 * process that builds the workflow, so its result may be stored under an id
 * this process's graph does not use.
 */
function finishedSleepAt(restart: RestartExecutionParams, index: number): string | undefined {
  // Only the top-level entry the run is at: a sleep inside a parallel or nested branch has a longer path.
  if (restart.activePaths.length !== 1 || restart.activePaths[0] !== index) {
    return undefined;
  }

  return Object.entries(restart.activeStepsPath ?? {}).find(
    ([id, path]) => path?.length === 1 && path[0] === index && restart.stepResults[id]?.status === 'success',
  )?.[0];
}

/**
 * The id the result of the sleep `entry` at `[index]` is stored under: this
 * process's id when a finished result is stored under it, otherwise the id of
 * a finished sleep at that path (see {@link finishedSleepAt}), since another
 * process may have stored the sleep under its own id.
 */
function storedSleepId(
  entry: Extract<StepFlowEntry, { type: 'sleep' | 'sleepUntil' }>,
  restart: RestartExecutionParams,
  index: number,
): string {
  if (restart.stepResults[entry.id]?.status === 'success') {
    return entry.id;
  }

  return finishedSleepAt(restart, index) ?? entry.id;
}

/** Recognize only the captured occurrence; a saved ID may also occur later in the graph. */
export function resolveCompletedRestartEntry(
  graph: StepFlowEntry[],
  restart: RestartExecutionParams,
  state: Record<string, any>,
) {
  if (restart.isPreFirstStepRestart) return;
  const index = restart.activePaths[0] ?? 0;
  const entry = graph[index];
  if (!entry) return;
  // An empty cursor is possible before dispatching an all-skipped first conditional.
  if (restart.activePaths.length === 0 && entry.type !== 'conditional') return;

  const results = restart.stepResults;
  let output: unknown;
  let stepResults = results;
  let nextState = resolveCurrentState({ stepResults: results, state });
  if (entry.type === 'parallel' || entry.type === 'conditional') {
    const ids = getStepIds(entry);
    if (
      !ids.length ||
      !ids.every(
        id => results[id]?.status === 'success' || (entry.type === 'conditional' && results[id]?.status === 'skipped'),
      )
    )
      return;
    const outputs: Record<string, unknown> = {};
    nextState = { ...nextState };
    stepResults = { ...results };
    for (const id of ids) {
      const result = results[id]!;
      if (result.status === 'success') outputs[id] = result.output;
      // Match aggregateBranchResults, consuming deltas in declaration order.
      const { __stateDelta, ...cleaned } = result as typeof result & { __stateDelta?: Record<string, any> };
      Object.assign(nextState, __stateDelta);
      stepResults[id] = cleaned;
    }
    output = outputs;
  } else {
    const id =
      entry.type === 'foreach' || entry.type === 'loop'
        ? getEntryId(entry.step)
        : entry.type === 'sleep' || entry.type === 'sleepUntil'
          ? storedSleepId(entry, restart, index)
          : getEntryId(entry);
    const result = results[id];
    if (result?.status !== 'success') return;
    if (entry.type === 'foreach') {
      const items: unknown[] = result.output;
      const records: StepResult<any, any, any, any>[] | undefined =
        result.suspendPayload?.__workflow_meta?.foreachOutput;
      if (!Array.isArray(result.payload) || !Array.isArray(items) || items.length !== result.payload.length) return;
      // Public outputs may themselves contain status/null fields. Completion is
      // recorded separately from user values in the foreach resume metadata.
      for (let i = 0; i < result.payload.length; i++) {
        if (!(i in items) || records?.[i]?.status !== 'success') return;
      }
      output = items;
    } else {
      output = result.output;
    }
  }
  return { executionPath: [index + 1], output, state: nextState, stepResults };
}
