import { useState } from 'react';
import { buildDefaultExperimentName, createExperimentNameSuffix } from './default-experiment-name';
import { useTargetOptions } from './use-target-options';
import type { TargetType } from './use-target-options';

/**
 * Experiment name state for the Run experiment dialog. The name defaults to the target name plus a
 * short id and follows the target until the user types. An `initialName` (rerun) counts as typed.
 */
export function useExperimentName(targetType: TargetType | '', targetId: string, initialName?: string) {
  const [typedName, setTypedName] = useState(initialName);
  const [suffix, setSuffix] = useState(createExperimentNameSuffix);
  const { targetOptions } = useTargetOptions(targetType);

  const targetName = targetOptions.find(option => option.value === targetId)?.label;
  const defaultName = targetName ? buildDefaultExperimentName(targetName, suffix) : '';
  const name = typedName ?? defaultName;
  // A cleared field still runs, under the default name it shows as its placeholder.
  const runName = name.trim() || defaultName;

  const resetName = () => {
    setTypedName(initialName);
    setSuffix(createExperimentNameSuffix());
  };

  return { name, defaultName, runName, setName: setTypedName, resetName };
}
