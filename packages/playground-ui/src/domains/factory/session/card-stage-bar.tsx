import { BoardStageIcon } from '../board/board-icons';
import type { BoardPhaseKind } from '../board/board-icons';
import { elapsedLabel, headerCapsuleClass } from './session-layout';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Txt } from '@/ds/components/Txt';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconChevronLeftMedium } from '@/ds/icons/central/IconChevronLeftMedium';
import { IconChevronRightMedium } from '@/ds/icons/central/IconChevronRightMedium';
import { useClock } from '@/hooks/use-clock';

export interface CardStagePhase {
  id: string;
  name: string;
  /** Icon kind; leave unset where the board draws its own stage art. */
  kind?: BoardPhaseKind;
  /** What moving there does; shown under the option. */
  description?: string;
  /** Why the card can't move there right now. Disables the option. */
  blockedReason?: string;
}

export interface CardStageBarProps {
  current: CardStagePhase;
  /** Phases on the card's track, then the stop phases (cancel and the like) below a separator. */
  track: readonly CardStagePhase[];
  stop?: readonly CardStagePhase[];
  previous?: CardStagePhase;
  next?: CardStagePhase;
  /** When the card entered a working phase; shows the time spent there. */
  enteredAt?: number;
  moving?: boolean;
  /** How the time in phase reads; defaults to `<1m`, `20m`, `2h 5m`. */
  elapsed?: (from: number, to: number) => string;
  onMove: (phaseId: string) => void;
}

/** The header pill that shows a card's phase and moves it: back, pick any phase, forward. */
export function CardStageBar({
  current,
  track,
  stop = [],
  previous,
  next,
  enteredAt,
  moving = false,
  elapsed: formatElapsed = elapsedLabel,
  onMove,
}: CardStageBarProps) {
  const elapsed = useClock(now => (enteredAt === undefined ? undefined : formatElapsed(enteredAt, now)));
  const icon = (phase: CardStagePhase) => <BoardStageIcon stage={phase.id} kind={phase.kind} decorative />;
  const option = (phase: CardStagePhase) => {
    const own = phase.id === current.id;
    return (
      <DropdownMenu.RadioItem
        key={phase.id}
        value={phase.id}
        closeOnClick
        aria-label={own ? `${phase.name}, current stage` : `Move to ${phase.name}`}
        className="items-start"
        disabled={!own && phase.blockedReason !== undefined}
      >
        {icon(phase)}
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{phase.name}</span>
          {own ? null : (
            <Txt as="span" variant="meta" tone="muted">
              {phase.blockedReason ?? phase.description}
            </Txt>
          )}
        </div>
      </DropdownMenu.RadioItem>
    );
  };

  return (
    <div role="group" aria-label="Card stage" className={headerCapsuleClass}>
      {previous ? <NeighbourButton direction="previous" phase={previous} disabled={moving} onMove={onMove} /> : null}
      <DropdownMenu>
        <DropdownMenu.Trigger
          variant="subtle"
          size="sm"
          aria-label={`Change stage from ${current.name}`}
          disabled={moving}
        >
          {icon(current)}
          <span>{current.name}</span>
          {elapsed ? (
            <Txt as="span" variant="meta" tone="muted" font="mono">
              {elapsed}
            </Txt>
          ) : null}
          <IconChevronDownMedium aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="center" className="max-h-(--available-height) w-72">
          <DropdownMenu.RadioGroup
            value={current.id}
            onValueChange={(stage: string) => {
              if (stage !== current.id) onMove(stage);
            }}
          >
            {track.map(option)}
            {track.length > 0 && stop.length > 0 ? <DropdownMenu.Separator /> : null}
            {stop.map(option)}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu>
      {next ? <NeighbourButton direction="next" phase={next} disabled={moving} onMove={onMove} /> : null}
    </div>
  );
}

function NeighbourButton({
  direction,
  phase,
  disabled,
  onMove,
}: {
  direction: 'previous' | 'next';
  phase: CardStagePhase;
  disabled: boolean;
  onMove: (phaseId: string) => void;
}) {
  const action = direction === 'previous' ? `Move back to ${phase.name}` : `Move to ${phase.name}`;
  const reason = phase.blockedReason;
  return (
    <Button
      iconEnd={direction === 'next' ? <IconChevronRightMedium /> : undefined}
      icon={direction === 'previous' ? <IconChevronLeftMedium /> : undefined}
      variant="ghost"
      size="sm"
      aria-label={reason ? `${action}, ${reason}` : action}
      tooltip={reason ?? action}
      disabled={disabled || reason !== undefined}
      onClick={() => onMove(phase.id)}
    >
      <span className="hidden @2xl:inline">{phase.name}</span>
    </Button>
  );
}

/** Read-only stage pill for cards the viewer can't move. */
export function CardStageSummary({ phase, note }: { phase: CardStagePhase; note?: string }) {
  return (
    <div role="group" aria-label="Card stage" className={headerCapsuleClass}>
      <span className="flex min-w-0 items-center gap-1.5 px-2 py-1">
        <BoardStageIcon stage={phase.id} kind={phase.kind} decorative />
        <Txt as="span" variant="label" className="truncate">
          {phase.name}
        </Txt>
        {note ? (
          <Txt as="span" variant="meta" tone="muted" className="truncate">
            {note}
          </Txt>
        ) : null}
      </span>
    </div>
  );
}
