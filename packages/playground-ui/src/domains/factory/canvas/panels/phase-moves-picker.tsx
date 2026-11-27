import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import type { PanelPhase } from './types';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconLock } from '@/ds/icons/central/IconLock';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { menuItemClass } from '@/ds/primitives/menu-item';
import { cn } from '@/utils/cn';

const LOCKED = "Factory's code makes this move";

/**
 * Where cards in this phase can go, as chips, and a picker listing every phase in board order: pressing one allows or
 * stops the move. Moves Factory's code makes are locked on.
 */
export function PhaseMovesPicker({
  phase,
  phases,
  next,
  required,
  boardId,
  disabled,
  onChange,
}: {
  phase: PanelPhase;
  phases: readonly PanelPhase[];
  /** Where cards in this phase may go now. */
  next: readonly string[];
  required: readonly string[];
  boardId: string;
  disabled: boolean;
  onChange: (nextPhases: string[]) => void;
}) {
  const allowed = phases.filter(other => other.key !== phase.key && next.includes(other.key));
  const toggle = (key: string) =>
    onChange(
      next.includes(key)
        ? next.filter(other => other !== key)
        : phases.filter(other => other.key === key || next.includes(other.key)).map(other => other.key),
    );

  return (
    <div className="flex flex-wrap items-center gap-1.25">
      {allowed.length === 0 && (
        <Txt as="p" variant="caption" tone="muted">
          Cards stay here; no move is allowed.
        </Txt>
      )}
      {allowed.length > 0 && (
        <ul aria-label={`Allowed moves from ${phase.name}`} className="contents">
          {allowed.map(other => {
            const locked = required.includes(other.key);
            const chip = (
              <span
                tabIndex={locked ? 0 : undefined}
                className="inline-flex h-6 max-w-full min-w-0 items-center gap-1.25 rounded-xl bg-fill pr-2 pl-1.5 text-foreground"
              >
                <PhaseIcon phase={other} boardId={boardId} />
                <Txt as="span" variant="caption" className="truncate">
                  {other.name}
                </Txt>
                {locked && (
                  <>
                    <IconLock aria-hidden className="size-icon-xs shrink-0 text-muted-foreground" />
                    <span className="sr-only">(locked)</span>
                  </>
                )}
              </span>
            );
            return (
              <li key={other.key} className="min-w-0">
                {locked ? (
                  <Tooltip>
                    <TooltipTrigger render={chip} />
                    <TooltipContent>{LOCKED}</TooltipContent>
                  </Tooltip>
                ) : (
                  chip
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && (
        <Popover>
          <PopoverTrigger size="icon-sm" variant="ghost" tooltip={`Change moves from ${phase.name}`}>
            <IconPlusMedium />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-1.5">
            <Txt as="p" variant="caption" tone="muted" className="px-2 pt-0.5 pb-1.5">
              {phase.name} can move cards to
            </Txt>
            <ul aria-label={`Moves from ${phase.name}`} className="flex flex-col gap-0.5">
              {phases.map(other => {
                if (other.key === phase.key) {
                  return (
                    <li key={other.key} className="flex h-7.5 items-center gap-2 px-2">
                      <PhaseIcon phase={other} boardId={boardId} />
                      <Txt as="span" variant="body-sm" tone="muted" className="truncate">
                        {other.name}
                      </Txt>
                      <Txt as="span" variant="caption" tone="muted" className="ml-auto shrink-0">
                        this phase
                      </Txt>
                    </li>
                  );
                }
                const on = next.includes(other.key);
                const locked = on && required.includes(other.key);
                return (
                  <li key={other.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={locked ? `${other.name} (locked)` : undefined}
                      aria-disabled={locked || undefined}
                      title={locked ? LOCKED : undefined}
                      onClick={locked ? undefined : () => toggle(other.key)}
                      className={cn(menuItemClass, 'w-full', locked && 'cursor-default')}
                    >
                      <PhaseIcon phase={other} boardId={boardId} />
                      <Txt as="span" variant="body-sm" tone={on ? 'ink' : 'muted'} className="truncate">
                        {other.name}
                      </Txt>
                      <span aria-hidden className="ml-auto grid shrink-0 place-items-center text-muted-foreground">
                        {locked ? (
                          <IconLock className="size-icon-sm" />
                        ) : on ? (
                          <IconCheckmark2Medium className="size-icon-sm" />
                        ) : (
                          <IconPlusMedium className="size-icon-sm" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Txt as="p" variant="caption" tone="muted" className="px-2 pt-1.5">
              Waits for the board's Save.
            </Txt>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function PhaseIcon({ phase, boardId }: { phase: PanelPhase; boardId: string }) {
  return <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />;
}
