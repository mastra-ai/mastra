import type { ReactNode } from 'react';
import type { IntakeTestBoardAnswer, IntakeTestRuleAnswer } from './types';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconMinusMedium } from '@/ds/icons/central/IconMinusMedium';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { cn } from '@/utils/cn';

/** Rules that matched the item, whether or not they won: the ones worth opening. */
function matched(rule: IntakeTestRuleAnswer) {
  return rule.outcome === 'took' || rule.outcome === 'lost' || rule.outcome === 'phase_refuses';
}

function boardStatus(board: IntakeTestBoardAnswer): { icon: ReactNode; text: string } {
  if (board.rules.length === 0) return { icon: <IconMinusMedium />, text: 'No rule for new items' };
  if (board.rules.some(rule => rule.outcome === 'took')) return { icon: <IconCheckmark2Medium />, text: 'Takes it' };
  const hits = board.rules.filter(matched).length;
  if (hits > 0) {
    return {
      icon: <IconArrowUpRight />,
      text: hits === 1 ? '1 rule matched, taken first' : `${hits} rules matched, taken first`,
    };
  }
  if (board.rules.every(rule => rule.outcome === 'disabled'))
    return { icon: <IconMinusMedium />, text: 'Its rules are off' };
  return { icon: <IconCrossMedium />, text: 'No rule matched' };
}

/** What each board answered for a new item, in the order intake asks them, with what each of its rules said. */
export function BoardAnswers({
  boards,
  boardId,
  onEditRule,
}: {
  boards: readonly IntakeTestBoardAnswer[];
  /** The board on the canvas, marked current. */
  boardId: string;
  onEditRule: (routeId: string) => void;
}) {
  return (
    <section aria-label="What each board answered" className="flex flex-col gap-2">
      <div className="flex justify-between">
        <Txt as="h3" variant="body-sm" tone="muted">
          New items
        </Txt>
        <Txt as="span" variant="body-sm" tone="muted">
          asked in order
        </Txt>
      </div>
      <ol className="flex flex-col gap-1">
        {boards.map((board, index) => {
          const status = boardStatus(board);
          const took = board.rules.some(rule => rule.outcome === 'took');
          return (
            <li
              key={board.boardKey}
              aria-label={board.name}
              aria-current={board.boardKey === boardId ? 'true' : undefined}
              className={cn('flex flex-col gap-2 rounded-2xl px-3 py-2.5', took && 'bg-fill')}
            >
              <div className="flex gap-2.5">
                <Txt as="span" variant="body-sm" tone="muted" className="w-3 shrink-0">
                  {index + 1}
                </Txt>
                <span className="mt-0.5 size-icon-sm shrink-0" aria-hidden>
                  {status.icon}
                </span>
                <div className="flex min-w-0 flex-col">
                  <Txt as="span" variant="body-sm" tone="ink">
                    {board.name}
                  </Txt>
                  <Txt as="span" variant="caption" tone="muted">
                    {status.text}
                  </Txt>
                </div>
              </div>
              {board.rules.length > 0 && (
                <ul aria-label={`${board.name} rules`} className="flex flex-col gap-1">
                  {board.rules.map((rule, ruleIndex) => (
                    <li
                      key={rule.routeId}
                      aria-label={rule.name ?? 'Unnamed rule'}
                      className={cn(
                        'flex items-start gap-2 rounded-xl px-2.5 py-2',
                        rule.outcome === 'took' && 'bg-fill-hover',
                      )}
                    >
                      <Txt as="span" variant="caption" tone="muted" className="w-3 shrink-0">
                        {ruleIndex + 1}
                      </Txt>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Txt as="span" variant="body-sm" tone={matched(rule) ? 'ink' : 'muted'}>
                          {rule.name ?? 'Unnamed rule'}
                        </Txt>
                        <Txt as="span" variant="caption" tone="muted">
                          {rule.verdict}
                        </Txt>
                      </div>
                      {matched(rule) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          tooltip="Edit rule"
                          aria-label={`Edit ${rule.name ?? 'Unnamed rule'}`}
                          onClick={() => onEditRule(rule.routeId)}
                        >
                          <IconPencil />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
