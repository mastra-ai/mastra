import type { BaseIterationState } from './schemas';

type AccumulatedSteps = NonNullable<BaseIterationState['accumulatedSteps']>;
type StepsCarrier = { accumulatedSteps?: AccumulatedSteps };

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

/**
 * Stores updated step records where this run keeps them. Returns the fields to
 * spread into the step output: nothing when they went to workflow state,
 * `{ accumulatedSteps }` when the run threads them through step payloads.
 */
export async function storeAccumulatedSteps(
  params: { state: unknown; setState(state: unknown): Promise<void> },
  accumulatedSteps: AccumulatedSteps,
): Promise<StepsCarrier> {
  const workflowState = params.state as StepsCarrier | undefined;
  if (workflowState?.accumulatedSteps === undefined) {
    return { accumulatedSteps };
  }
  // The default engine replaces state wholesale on setState.
  await params.setState({ ...workflowState, accumulatedSteps });
  return {};
}
