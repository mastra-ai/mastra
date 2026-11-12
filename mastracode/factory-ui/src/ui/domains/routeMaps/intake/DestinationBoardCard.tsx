import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SquareKanban } from 'lucide-react';
import type { Ref } from 'react';

import type { InstalledBoardInfo, InstalledPhaseInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { destinationKey } from './intakeMap';

/** A board new cards can land on, with one row per phase a route sends them to. */
export function DestinationBoardCard({
  board,
  phases,
  tone,
  active,
  anchorRef,
}: {
  board: InstalledBoardInfo;
  phases: InstalledPhaseInfo[];
  tone: string;
  /** The destination of the route being looked at, which stays lit. */
  active: string | undefined;
  anchorRef: (phaseKey: string) => Ref<HTMLLIElement>;
}) {
  const name = board.name ?? board.title;
  return (
    <section aria-label={name} className="bg-card flex flex-col gap-2 rounded-xl p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn('bg-fill-subtle flex size-8 shrink-0 items-center justify-center rounded-lg', tone)}>
          <SquareKanban className="size-4" aria-hidden="true" />
        </span>
        <Txt as="h3" variant="label">
          {name}
        </Txt>
      </div>
      <ul aria-label={`${name} phases`} className="flex flex-col gap-1">
        {phases.map(phase => (
          <li
            key={phase.id}
            ref={anchorRef(phase.id)}
            data-dimmed={(active !== undefined && active !== destinationKey(board.id, phase.id)) || undefined}
            className="bg-fill-subtle flex items-center gap-2 rounded-lg px-2 py-1.5 transition-opacity data-dimmed:opacity-40"
          >
            <BoardStageIcon stage={phase.id} kind={phaseIconKind(board.id, phase.kind)} decorative />
            <Txt as="span" variant="caption">
              {phase.name ?? phase.title}
            </Txt>
          </li>
        ))}
      </ul>
    </section>
  );
}
