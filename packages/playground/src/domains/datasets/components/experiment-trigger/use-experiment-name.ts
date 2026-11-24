import { buildDefaultExperimentName, createNameSuffix } from '@mastra/playground-ui/domains/datasets';
import { useState } from 'react';

/**
 * The experiment's name: empty until the user types one. Meanwhile the target's name plus a short id
 * shows as the placeholder and is used on Run.
 */
export function useExperimentName({ initialName, targetLabel }: { initialName?: string; targetLabel?: string }) {
  const [name, setName] = useState(initialName ?? '');
  const [suffix] = useState(createNameSuffix);
  const defaultName = buildDefaultExperimentName(targetLabel ?? 'experiment', suffix);

  return {
    name,
    setName,
    defaultName,
    runName: name.trim() || defaultName,
  };
}
