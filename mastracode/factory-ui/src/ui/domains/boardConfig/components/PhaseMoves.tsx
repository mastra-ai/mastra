import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, LockKeyhole, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import type { StoredPhaseInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';

const TILE = 'inline-flex h-8 max-w-48 min-w-0 items-center gap-1.5 rounded-lg border px-2.5';

/**
 * The board's phases in board order, the way the board lays them out, each showing whether cards in this phase can
 * go there. Pressing a phase allows or stops the move; moves Factory's code makes are locked on.
 */
export function PhaseMoves({
  phase,
  phases,
  next,
  required,
  boardId,
  disabled,
  onChange,
}: {
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  next: string[];
  required: Set<string>;
  boardId: string;
  disabled: boolean;
  onChange: (nextPhases: string[]) => void;
}) {
  const toggle = (key: string) =>
    onChange(
      next.includes(key)
        ? next.filter(other => other !== key)
        : phases.filter(other => other.key === key || next.includes(other.key)).map(other => other.key),
    );

  return (
    <ul aria-label={`Allowed moves from ${phase.name}`} className="flex flex-wrap gap-1.5">
      {phases.map(other => {
        const icon = <BoardStageIcon stage={other.key} kind={phaseIconKind(boardId, other.kind)} decorative />;

        if (other.key === phase.key) {
          return (
            <li key={other.key} className={cn(TILE, 'border-border-strong bg-card shadow-raised dark:bg-muted')}>
              {icon}
              <Name>{other.name}</Name>
              <span className="sr-only">(this phase)</span>
            </li>
          );
        }

        const allowed = next.includes(other.key);
        const locked = allowed && required.has(other.key);
        const inert = locked || disabled;
        const tile = (
          <button
            type="button"
            aria-pressed={allowed}
            aria-label={locked ? `${other.name} (locked)` : undefined}
            aria-disabled={inert || undefined}
            onClick={inert ? undefined : () => toggle(other.key)}
            className={cn(
              TILE,
              'group/move transition-colors',
              allowed
                ? 'bg-fill text-foreground border-transparent'
                : 'border-border text-muted-foreground border-dashed',
              !inert && (allowed ? 'hover:bg-fill-hover' : 'hover:text-foreground hover:border-border-strong'),
              inert && !locked && 'cursor-default',
              focusRing,
            )}
          >
            <span className={cn('grid place-items-center', !allowed && 'opacity-50')}>{icon}</span>
            <Name>{other.name}</Name>
            <span className="text-muted-foreground grid size-3.5 shrink-0 place-items-center">
              {locked ? (
                <LockKeyhole className="size-3.5" aria-hidden />
              ) : allowed ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                !disabled && (
                  <Plus
                    className="invisible size-3.5 group-hover/move:visible group-focus-visible/move:visible"
                    aria-hidden
                  />
                )
              )}
            </span>
          </button>
        );

        return (
          <li key={other.key} className="min-w-0">
            {locked ? (
              <Tooltip>
                <TooltipTrigger render={tile} />
                <TooltipContent>Factory&apos;s code makes this move</TooltipContent>
              </Tooltip>
            ) : (
              tile
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Name({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="label" className="truncate">
      {children}
    </Txt>
  );
}
