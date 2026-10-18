import { useState } from 'react';
import { toTargetValue } from './experiment-trigger-options';
import type { ExperimentTriggerInitialValues, TargetOption } from './experiment-trigger-options';
import { useTargetOptions } from './use-target-options';

type InitialTarget = Pick<ExperimentTriggerInitialValues, 'initialTargetType' | 'initialTargetId'>;

function initialTargetValue({ initialTargetType, initialTargetId }: InitialTarget) {
  if (!initialTargetType || !initialTargetId) return '';
  return toTargetValue(initialTargetType, initialTargetId);
}

/** The picked option, or a preselected target (rerun) named after its id until its display name loads. */
function findTarget(
  options: TargetOption[],
  targetValue: string,
  { initialTargetType, initialTargetId }: InitialTarget,
): TargetOption | undefined {
  const option = options.find(candidate => candidate.value === targetValue);
  if (option) return option;
  if (!initialTargetType || !initialTargetId || !targetValue) return undefined;
  return { value: targetValue, label: initialTargetId, type: initialTargetType, id: initialTargetId };
}

/** What the experiment runs on each item: an agent, a workflow or a scorer. */
export function useTargetChoice(initial: InitialTarget) {
  const { options, isLoading } = useTargetOptions();
  const [targetValue, setTargetValue] = useState(() => initialTargetValue(initial));

  return {
    options,
    isLoading,
    target: findTarget(options, targetValue, initial),
    setTargetValue,
  };
}
