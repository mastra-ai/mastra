import { useState } from 'react';
import { buildDefaultExperimentName, createNameSuffix } from '../../utils/default-names';

/**
 * Experiment name state for the Run experiment dialog. The name defaults to the target name plus a
 * short id and follows the target until the user types. An `initialName` (rerun) counts as typed.
 */
export function useExperimentName(targetName?: string, initialName?: string) {
  const [typedName, setTypedName] = useState(initialName);
  const [suffix, setSuffix] = useState(createNameSuffix);

  const defaultName = targetName ? buildDefaultExperimentName(targetName, suffix) : '';
  const name = typedName ?? defaultName;
  // A cleared field still runs, under the default name it shows as its placeholder.
  const runName = name.trim() || defaultName;

  const resetName = () => {
    setTypedName(initialName);
    setSuffix(createNameSuffix());
  };

  return { name, defaultName, runName, setName: setTypedName, resetName };
}
