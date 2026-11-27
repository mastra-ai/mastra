import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import type { BoardPhaseKind } from '../../board/board-icons';
import { InlineText } from '../inline-text';
import type { PanelPhase } from './types';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconLock } from '@/ds/icons/central/IconLock';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

const KINDS: Record<BoardPhaseKind, { label: string; meaning: string }> = {
  resting: { label: 'Resting', meaning: 'No agent works here. Cards wait for a person or an event to move them.' },
  working: { label: 'Working', meaning: 'An agent works on each card here, following the steps below.' },
  terminal: { label: 'Terminal', meaning: 'Cards are finished here. Their agent sessions stop.' },
};

const KIND_ORDER: readonly BoardPhaseKind[] = ['resting', 'working', 'terminal'];

/** The phase's icon, name, kind and card count, its description below, and the panel's close button. */
export function PhaseHeader({
  phase,
  boardId,
  total,
  readOnly,
  kindLocked,
  onName,
  onDescription,
  onKind,
  onClose,
}: {
  phase: PanelPhase;
  boardId: string;
  total: number | undefined;
  readOnly: boolean;
  kindLocked: boolean;
  onName: (name: string) => void;
  onDescription: (description: string | null) => void;
  onKind: (kind: BoardPhaseKind) => void;
  onClose: () => void;
}) {
  const kind = KINDS[phase.kind];
  const description = phase.description ?? '';

  return (
    <div className="flex flex-col gap-0.5">
      {/* The icon sits in the steps' column, so the title, the description and each step's settings share one edge. */}
      <div className="flex min-h-7 min-w-0 items-center gap-2 pl-1">
        <span className="grid size-icon-md shrink-0 place-items-center">
          <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
        </span>
        <Txt as="h2" variant="card-title-strong" className="min-w-0 truncate">
          <InlineText
            value={phase.name}
            label="Phase name"
            required
            readOnly={readOnly}
            variant="card-title-strong"
            tone="ink"
            onChange={onName}
          />
        </Txt>
        {readOnly || kindLocked ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  role="img"
                  tabIndex={0}
                  aria-label={`${kind.label}. ${kindLocked ? `${kind.meaning} This phase keeps its kind.` : kind.meaning}`}
                  className={cn('inline-flex shrink-0 rounded-sm', focusRing)}
                >
                  <Badge size="sm" icon={kindLocked ? <IconLock /> : undefined}>
                    {kind.label}
                  </Badge>
                </span>
              }
            />
            <TooltipContent side="bottom" className="max-w-72">
              {kindLocked
                ? `${kind.meaning} The first phase and phases Factory's code declares keep their kind.`
                : kind.meaning}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Select
            value={phase.kind}
            onValueChange={value => {
              const next = KIND_ORDER.find(candidate => candidate === value);
              if (next && next !== phase.kind) onKind(next);
            }}
          >
            <SelectTrigger size="sm" variant="ghost" aria-label="Phase kind" className="w-auto shrink-0">
              {kind.label}
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map(candidate => (
                <SelectItem key={candidate} value={candidate}>
                  <span className="flex max-w-56 flex-col gap-0.5">
                    <Txt as="span" variant="label">
                      {KINDS[candidate].label}
                    </Txt>
                    <Txt as="span" variant="caption" tone="muted">
                      {KINDS[candidate].meaning}
                    </Txt>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Txt as="span" variant="caption" tone="muted" className="ml-auto shrink-0 tabular-nums">
          {total === undefined ? null : (
            <>
              {total}
              <span className="sr-only"> {total === 1 ? 'card' : 'cards'}</span>
            </>
          )}
        </Txt>
        <Button size="icon-sm" variant="ghost" tooltip={`Close ${phase.name}`} onClick={onClose}>
          <IconCrossMedium />
        </Button>
      </div>
      {(description || !readOnly) && (
        <div className="pl-7.5">
          <InlineText
            value={description}
            label="Phase description"
            placeholder="Add a description"
            multiline
            readOnly={readOnly}
            variant="caption"
            tone="muted"
            className="w-full"
            onChange={next => onDescription(next || null)}
          />
        </div>
      )}
    </div>
  );
}
