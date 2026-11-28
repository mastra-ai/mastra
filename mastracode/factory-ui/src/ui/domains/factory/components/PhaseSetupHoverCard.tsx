import { PhaseSetupHoverCard as SharedPhaseSetupHoverCard } from '@mastra/playground-ui/domains/factory';
import type { PhaseSetupHandle } from '@mastra/playground-ui/domains/factory';

import type { InstalledPhaseInfo } from '../../../../api/types';
import { usePhaseArrivals } from '../hooks/usePhaseArrivals';
import { PhaseSetupCard } from './PhaseSetupCard';

export type { PhaseSetupHandle };

export function PhaseSetupHoverCard({
  handle,
  factoryId,
  boardId,
  phases,
}: {
  handle: PhaseSetupHandle;
  factoryId: string;
  boardId: string;
  phases: readonly InstalledPhaseInfo[];
}) {
  const arrivals = usePhaseArrivals(factoryId, boardId, phases[0]?.id);
  return (
    <SharedPhaseSetupHoverCard handle={handle}>
      {payload => {
        const phase = phases.find(candidate => candidate.id === payload);
        if (!phase) return null;
        return (
          <PhaseSetupCard
            factoryId={factoryId}
            boardId={boardId}
            phase={phase}
            phases={phases}
            label={phase.name ?? phase.title}
            start={arrivals.start}
            arriving={arrivals.into && (arrivals.into.get(phase.id) ?? [])}
            rulesLoading={arrivals.loading}
            boards={arrivals.boards}
          />
        );
      }}
    </SharedPhaseSetupHoverCard>
  );
}
