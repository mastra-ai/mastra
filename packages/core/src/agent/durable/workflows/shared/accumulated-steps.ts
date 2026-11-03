import type { BaseIterationState } from './schemas';

type AccumulatedSteps = NonNullable<BaseIterationState['accumulatedSteps']>;

type StepsCarrier = { accumulatedSteps?: AccumulatedSteps };

type StateParams = { getState(keys?: readonly string[]): Promise<unknown> };

/**
 * Where the run's step records (`accumulatedSteps`) live between steps. Same
 * rule as the transcript (see `readMessageListState`): the durable loop seeds
 * them into workflow state once (`init-iteration-state`), so a persisted
 * snapshot carries one copy (in `value`) instead of one per step payload. Runs
 * that never seeded them — those persisted before the move, or workflows
 * composing these steps without seeding — keep threading them through step
 * input/output unchanged.
 */
export function readAccumulatedSteps(workflowState: unknown, stepPayload: unknown): AccumulatedSteps {
  return (
    (workflowState as StepsCarrier | undefined)?.accumulatedSteps ??
    (stepPayload as StepsCarrier | undefined)?.accumulatedSteps ??
    []
  );
}

/** Loads the run's step records, and nothing else from workflow state. */
export async function loadAccumulatedSteps(params: StateParams, stepPayload: unknown): Promise<AccumulatedSteps> {
  return readAccumulatedSteps(await params.getState(['accumulatedSteps']), stepPayload);
}

/**
 * Stores updated step records where this run keeps them. Returns the fields to
 * spread into the step output: nothing when they went to workflow state,
 * `{ accumulatedSteps }` when the run threads them through step payloads.
 */
export async function storeAccumulatedSteps(
  params: StateParams & { setState(state: unknown): Promise<void> },
  accumulatedSteps: AccumulatedSteps,
): Promise<{ accumulatedSteps?: AccumulatedSteps }> {
  const stored = (await params.getState(['accumulatedSteps'])) as StepsCarrier | undefined;
  if (stored?.accumulatedSteps === undefined) {
    return { accumulatedSteps };
  }
  await params.setState({ accumulatedSteps });
  return {};
}
