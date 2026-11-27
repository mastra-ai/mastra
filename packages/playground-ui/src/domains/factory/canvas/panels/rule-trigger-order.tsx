import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import type { RuleOrderLine, RuleTargetBoard } from './types';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconArrowCornerDownRight } from '@/ds/icons/central/IconArrowCornerDownRight';
import { IconArrowDown } from '@/ds/icons/central/IconArrowDown';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { cn } from '@/utils/cn';

function listed(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** One trigger the rule listens on: every rule of the board on it, in the order Factory checks them. */
export function TriggerOrder({
  label,
  after,
  fallback,
  lines,
  ruleId,
  board,
  boards,
  canEdit,
  pending,
  onOpen,
  onMove,
  onAdd,
}: {
  /** The trigger's name. */
  label: string;
  /** The boards whose rules Factory checks first; empty when none do or the order doesn't apply. */
  after: readonly string[];
  /** What happens to what no rule takes; undefined when a rule takes everything. */
  fallback: string | undefined;
  /** The board's rules on this trigger, in order. */
  lines: readonly RuleOrderLine[];
  /** The rule the panel shows. */
  ruleId: string;
  board: RuleTargetBoard;
  boards: readonly RuleTargetBoard[];
  canEdit: boolean;
  /** A change to the rules is saving: the arrows wait, as they move from the order it will replace. */
  pending: boolean;
  onOpen: (ruleId: string) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <Txt as="h3" variant="caption" tone="muted">
        {label}
      </Txt>
      {after.length > 0 && (
        <Txt as="p" variant="caption" tone="muted" className="flex items-center gap-1.5">
          <IconArrowCornerDownRight className="size-icon-xs shrink-0" aria-hidden />
          After {listed(after)}
        </Txt>
      )}
      <ol className="flex flex-col">
        {lines.map((line, index) => {
          const current = line.rule.id === ruleId;
          const target = line.rule.target;
          const away = target.moveToBoardKey
            ? boards.find(candidate => candidate.id === target.moveToBoardKey)
            : undefined;
          const where = away ?? board;
          const stage = target.phaseKey ?? where.initialPhase;
          const phase = where.phases.find(candidate => candidate.id === stage);
          const kind = phase?.kind;
          const content = (
            <>
              <Txt as="span" variant="caption" tone="muted" className="w-3 shrink-0 tabular-nums">
                {line.rank}
              </Txt>
              <Txt
                as="span"
                variant={current ? 'label' : 'body-sm'}
                tone={current ? undefined : 'muted'}
                className="min-w-0 flex-1 truncate text-left"
              >
                {line.label}
              </Txt>
              <Txt as="span" variant="caption" tone="muted" className="flex min-w-0 shrink items-center gap-1">
                {away ? (
                  <>
                    <IconArrowUpRight className="size-icon-xs shrink-0" aria-hidden />
                    <span className="truncate">{away.name}</span>
                  </>
                ) : (
                  <>
                    {kind && <BoardStageIcon stage={stage} kind={phaseIconKind(where.id, kind)} decorative />}
                    <span className="truncate">{phase?.name ?? stage}</span>
                  </>
                )}
              </Txt>
            </>
          );
          return (
            <li
              key={line.rule.id}
              aria-current={current ? 'true' : undefined}
              className={cn('flex h-7.5 items-center gap-2 rounded-[10px] px-2', current && 'bg-fill-active')}
            >
              {current ? (
                content
              ) : (
                <button
                  type="button"
                  className="-mx-2 flex h-full min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2 hover:bg-fill-hover"
                  onClick={() => onOpen(line.rule.id)}
                >
                  {content}
                </button>
              )}
              {canEdit && lines.length > 1 && (
                <span className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    tooltip="Check earlier"
                    aria-label="Check earlier"
                    disabled={pending || index === 0}
                    onClick={() => onMove(index, index - 1)}
                  >
                    <IconArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    tooltip="Check later"
                    aria-label="Check later"
                    disabled={pending || index === lines.length - 1}
                    onClick={() => onMove(index, index + 1)}
                  >
                    <IconArrowDown />
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {(fallback || canEdit) && (
        <div className="flex min-h-7.5 items-center gap-2 px-2">
          {fallback && (
            <Txt as="p" variant="caption" tone="muted" className="flex min-w-0 flex-1 items-center gap-1.5">
              <IconArrowCornerDownRight className="size-icon-xs shrink-0" aria-hidden />
              <span className="truncate">{fallback}</span>
            </Txt>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              icon={<IconPlusMedium />}
              className="ml-auto shrink-0"
              aria-label={`Add rule on ${label}`}
              onClick={onAdd}
            >
              Rule
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
