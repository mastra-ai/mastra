import type { ReactNode } from 'react';
import { BoardStageIcon, phaseIconKind } from './board-icons';
import { PhaseWalkthrough } from './phase-walkthrough';
import type { PhaseOutline } from './phase-walkthrough';
import { Txt } from '@/ds/components/Txt';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** A centered settings block, 42rem wide. */
export const BOARD_SETTINGS_COLUMN = 'mx-auto w-full max-w-2xl';
/** The scroll surface the Overview map sits in; its width is what the pinned blocks span. */
export const BOARD_OVERVIEW_SURFACE =
  '[container-type:inline-size] h-full min-h-0 overflow-auto overscroll-x-contain [scrollbar-gutter:stable]';
const PINNED = 'sticky left-0 w-[100cqw] px-4';

/**
 * Lines the first column's content up with the settings column above it (42rem wide, centered), and leaves the same
 * gutter after the last one. A column's content sits 1.25rem inside its edge.
 */
export const BOARD_MAP_PHASES = 'mx-auto flex w-max px-[max(0.75rem,calc((100cqw_-_42rem)/2_-_1.25rem))]';
export const BOARD_MAP_PHASE =
  'relative flex w-64 shrink-0 flex-col px-2 before:via-border-strong not-first:before:absolute not-first:before:inset-y-0 not-first:before:left-0 not-first:before:w-px not-first:before:bg-linear-to-b not-first:before:from-transparent not-first:before:to-transparent';
export const BOARD_MAP_PHASE_TITLE = 'flex items-center gap-2 px-3 pt-3 pb-1';
export const BOARD_MAP_PHASE_BODY = 'p-3';

/** A settings block. Pinned, it stays in view while the Overview map scrolls sideways. */
export function BoardSettingsColumn({
  pinned,
  sticky,
  className,
  children,
}: {
  pinned?: boolean;
  sticky?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const stuck = sticky && 'sticky bottom-4 z-10';
  if (!pinned) return <div className={cn(BOARD_SETTINGS_COLUMN, stuck, className)}>{children}</div>;
  return (
    <div className={cn(PINNED, stuck)}>
      <div className={cn(BOARD_SETTINGS_COLUMN, className)}>{children}</div>
    </div>
  );
}

export interface BoardMapColumn {
  /** Opens the phase's own settings page. */
  href: string;
  arrivals: ReactNode;
  starts: ReactNode;
  agent: ReactNode;
}

/**
 * A board as a map: its phases as columns, in board order, each reading top to bottom as a card's way through it:
 * how cards get in, who works them, how the work ends, and where they can go next.
 */
export function BoardMap({
  boardId,
  phases,
  column,
  action,
  notice,
  leaving,
  LinkComponent: Link = 'a',
}: {
  boardId: string;
  phases: readonly PhaseOutline[];
  column: (phase: PhaseOutline) => BoardMapColumn;
  action?: ReactNode;
  notice?: ReactNode;
  /** A line about cards leaving for other boards, shown above the map. */
  leaving?: ReactNode;
  LinkComponent?: LinkComponent;
}) {
  return (
    <section aria-label="Board map" className="flex flex-col gap-3">
      {action && (
        <BoardSettingsColumn pinned className="flex justify-end">
          {action}
        </BoardSettingsColumn>
      )}
      {notice && <BoardSettingsColumn pinned>{notice}</BoardSettingsColumn>}
      {leaving && (
        <BoardSettingsColumn pinned className="mb-4">
          <Txt as="p" variant="caption" tone="muted">
            {leaving}
          </Txt>
        </BoardSettingsColumn>
      )}
      <ol aria-label="Phases" className={BOARD_MAP_PHASES}>
        {phases.map(phase => {
          const parts = column(phase);
          return (
            <li key={phase.key} aria-label={phase.name} className={BOARD_MAP_PHASE}>
              <div className={BOARD_MAP_PHASE_TITLE}>
                <Link
                  href={parts.href}
                  className="flex min-w-0 items-center gap-2 hover:underline focus-visible:underline focus-visible:outline-hidden"
                >
                  <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
                  <Txt as="span" variant="label" tone="ink" className="truncate">
                    {phase.name}
                  </Txt>
                </Link>
              </div>
              <div className={BOARD_MAP_PHASE_BODY}>
                <PhaseWalkthrough
                  boardId={boardId}
                  phase={phase}
                  phases={phases}
                  arrivals={parts.arrivals}
                  starts={parts.starts}
                  agent={parts.agent}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
