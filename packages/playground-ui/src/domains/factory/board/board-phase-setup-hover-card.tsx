import type { InstalledPhaseInfo } from '@mastra/client-js';
import { BoardPhaseSetupCard } from './board-phase-setup-card';
import { PhaseSetupHoverCard } from './phase-setup';
import type { PhaseSetupHandle } from './phase-setup';
import { usePhaseArrivals } from './use-phase-arrivals';

export function BoardPhaseSetupHoverCard({
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
    <PhaseSetupHoverCard handle={handle}>
      {payload => {
        const phase = phases.find(candidate => candidate.id === payload);
        if (!phase) return null;
        return (
          <BoardPhaseSetupCard
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
    </PhaseSetupHoverCard>
  );
}
