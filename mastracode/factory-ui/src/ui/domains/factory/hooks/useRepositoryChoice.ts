import { useState } from 'react';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import type { FactoryProject } from '../../workspaces/services/github';

/** Asks which repository a card belongs to before it enters a working phase, when the card does not say. */
export function useRepositoryChoice(factory: FactoryProject, definition: InstalledBoardInfo) {
  const intakeConfig = useIntakeConfigQuery();
  const [pendingSelect, setPendingSelect] = useState<(slug: string) => void>();

  const choose = (
    source: string,
    metadata: Record<string, unknown> | undefined,
    stage: string,
    onSelect: (slug: string) => void,
    onResolved: () => void,
  ) => {
    const mappedSlug =
      source === 'linear-issue' && typeof metadata?.linearProjectId === 'string'
        ? intakeConfig.data?.linear.repositoryByLinearProject?.[metadata.linearProjectId]
        : undefined;
    const knownSlug = typeof metadata?.repository === 'string' ? metadata.repository : mappedSlug;
    if (
      factory.repositories.length > 1 &&
      definition.phases.find(phase => phase.id === stage)?.kind === 'working' &&
      !factory.repositories.some(repo => repo.slug === knownSlug)
    ) {
      setPendingSelect(() => onSelect);
      return;
    }
    onResolved();
  };

  return {
    choose,
    pending: pendingSelect !== undefined,
    cancel: () => setPendingSelect(undefined),
    select: (slug: string) => {
      setPendingSelect(undefined);
      pendingSelect?.(slug);
    },
  };
}
