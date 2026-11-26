import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowCornerDownRight } from '@mastra/playground-ui/icons/central/IconArrowCornerDownRight';
import { IconArrowDown } from '@mastra/playground-ui/icons/central/IconArrowDown';
import { IconArrowUp } from '@mastra/playground-ui/icons/central/IconArrowUp';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { InstalledBoardInfo, IntakeOrderResponse, IntakeRouteInfo } from '../../../../../api/types';
import { isOpenedLane, laneText } from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';
import { boardName, phaseName } from '../../../boardRules/ruleTargets';
import { BoardStageIcon, phaseIconKind } from '../../../factory/components/BoardIcons';
import { triggerFallback } from '../../canvasModel';
import type { RuleLine } from '../../canvasModel';

function listed(names: readonly string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** One trigger the rule listens on: every rule of the board on it, in the order Factory checks them. */
export function TriggerOrder({
  event,
  lines,
  rule,
  board,
  boards,
  boardRules,
  order,
  canEdit,
  pending,
  onOpen,
  onMove,
  onAdd,
}: {
  event: RuleEvent;
  /** The board's rules on this trigger, in order. */
  lines: readonly RuleLine[];
  rule: IntakeRouteInfo;
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
  boardRules: readonly IntakeRouteInfo[];
  order: IntakeOrderResponse | undefined;
  canEdit: boolean;
  /** A change to the rules is saving: the arrows wait, as they move from the order it will replace. */
  pending: boolean;
  onOpen: (ruleId: string) => void;
  onMove: (from: number, to: number) => void;
  onAdd: () => void;
}) {
  const at = order?.boards.findIndex(candidate => candidate.boardKey === board.id) ?? -1;
  const before = at > 0 && order ? order.boards.slice(0, at).map(candidate => candidate.name) : [];
  const fallback = triggerFallback(event, {
    boardKey: board.id,
    boardRules,
    order: order?.boards,
    evaluator: order?.evaluator,
    phaseName: key => phaseName(board, key ?? null),
    flow: board.flow,
  });
  const label = laneText(event).label;

  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <Txt as="h3" variant="caption" tone="muted">
        {label}
      </Txt>
      {isOpenedLane(event) && order?.evaluator === 'intake-order' && before.length > 0 && (
        <Txt as="p" variant="caption" tone="muted" className="flex items-center gap-1.5">
          <IconArrowCornerDownRight className="size-icon-xs shrink-0" aria-hidden />
          After {listed(before)}
        </Txt>
      )}
      <ol className="flex flex-col">
        {lines.map((line, index) => {
          const current = line.rule.id === rule.id;
          const target = line.rule.target;
          const away = target.moveToBoardKey
            ? boards.find(candidate => candidate.id === target.moveToBoardKey)
            : undefined;
          const where = away ?? board;
          const stage = target.phaseKey ?? where.initialPhase;
          const kind = where.phases.find(phase => phase.id === stage)?.kind;
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
                    <span className="truncate">{boardName(away)}</span>
                  </>
                ) : (
                  <>
                    {kind && <BoardStageIcon stage={stage} kind={phaseIconKind(where.id, kind)} decorative />}
                    <span className="truncate">{phaseName(where, stage) ?? stage}</span>
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
                <>
                  {content}
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
                </>
              ) : (
                <button
                  type="button"
                  className="hover:bg-fill-hover -mx-2 flex h-full min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2"
                  onClick={() => onOpen(line.rule.id)}
                >
                  {content}
                </button>
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
