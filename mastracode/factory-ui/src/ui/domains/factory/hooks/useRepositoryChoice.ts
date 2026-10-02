import { useState } from 'react';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import type { FactoryProject } from '../../workspaces/services/github';
import { cardRepositorySlug } from '../boardRepository';

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
    const knownSlug = cardRepositorySlug(source, metadata, intakeConfig.data);
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
