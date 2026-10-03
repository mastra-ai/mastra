import { useState } from 'react';

import type { InstalledBoardInfo } from '../../../../api/types';
import type { FactoryProject } from '../../workspaces/services/github';
import { useCardRepositorySlug } from './useCardRepositorySlug';

export function useRepositoryChoice(factory: FactoryProject, definition: InstalledBoardInfo) {
  const repositorySlugFor = useCardRepositorySlug();
  const [pendingSelect, setPendingSelect] = useState<(slug: string) => void>();

  const choose = async (
    source: string,
    metadata: Record<string, unknown> | undefined,
    stage: string,
    onSelect: (slug: string) => void,
    onResolved: () => void,
  ) => {
    const knownSlug = await repositorySlugFor(source, metadata);
    const entersWorkingPhase = definition.phases.find(phase => phase.id === stage)?.kind === 'working';
    const hasLinkedRepository = factory.repositories.some(repository => repository.slug === knownSlug);
    const needsRepositoryChoice = factory.repositories.length > 1 && entersWorkingPhase && !hasLinkedRepository;
    if (needsRepositoryChoice) {
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
