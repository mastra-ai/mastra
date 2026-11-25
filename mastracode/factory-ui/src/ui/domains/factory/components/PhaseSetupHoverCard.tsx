import { HoverCard, HoverCardContent } from '@mastra/playground-ui/components/HoverCard';
import type { createHoverCardHandle } from '@mastra/playground-ui/components/HoverCard';

import type { InstalledPhaseInfo } from '../../../../api/types';
import { usePhaseArrivals } from '../hooks/usePhaseArrivals';
import { PhaseSetupCard } from './PhaseSetupCard';

export type PhaseSetupHandle = ReturnType<typeof createHoverCardHandle<string>>;

/**
 * The one card every column header's setup opens, showing the hovered phase: moving to the next header swaps what it
 * shows instead of opening a second card.
 */
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
    <HoverCard handle={handle}>
      {({ payload }) => {
        const phase = phases.find(candidate => candidate.id === payload);
        if (!phase) return null;
        const label = phase.name ?? phase.title;
        return (
          <HoverCardContent
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={8}
            showArrow={false}
            className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
          >
            <PhaseSetupCard
              factoryId={factoryId}
              boardId={boardId}
              phase={phase}
              phases={phases}
              label={label}
              start={arrivals.start}
              arriving={arrivals.into && (arrivals.into.get(phase.id) ?? [])}
              rulesLoading={arrivals.loading}
              boards={arrivals.boards}
            />
          </HoverCardContent>
        );
      }}
    </HoverCard>
  );
}
