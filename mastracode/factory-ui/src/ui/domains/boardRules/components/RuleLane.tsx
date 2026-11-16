import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  ArrowDown,
  ArrowUp,
  CircleDashed,
  Filter,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo, IntakeSkippedResponse } from '../../../../api/types';
import { useRowDrag } from '../../settings/components/useRowDrag';
import { catchAllIndex, isLegacyOpened, shadowedBy, isOpenedLane, LEGACY_OPENED_EVENT, laneText } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { ConditionChips } from './ConditionChips';
import { RuleTarget } from './RuleTarget';

/** The part of a rule the builder opens at: its conditions or its destination. */
export type RuleFocus = 'conditions' | 'action';

const DROP_LINE = cn(
  'relative before:pointer-events-none before:absolute before:right-0 before:left-0 before:z-20 before:hidden before:h-0.5 before:rounded-full before:bg-border-focus',
  'data-[drop=before]:before:-top-1 data-[drop=before]:before:block data-[drop=after]:before:-bottom-1 data-[drop=after]:before:block',
);

/**
 * One trigger's rules, checked top to bottom: the first match moves the card, otherwise the next rule is tried. A rule
 * below one that takes every card is never reached.
 */
export function RuleLane({
  event,
  rules,
  board,
  boards,
  phaseOptions,
  canEdit,
  skips,
  note,
  footer,
  onEdit,
  onAdd,
  onMove,
  onToggle,
  onDelete,
}: {
  event: RuleEvent;
  rules: IntakeRouteInfo[];
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
  phaseOptions: Record<string, FilterBarOption[]>;
  canEdit: boolean;
  /** Each rule's skips in the last 30 days, by rule id. */
  skips?: ReadonlyMap<string, RuleSkips>;
  /** Said under the lane's name, such as where the board sits in intake order. */
  note?: ReactNode;
  /** What happens when no rule matches; by default the card stays where it is. */
  footer?: string;
  onEdit: (rule: IntakeRouteInfo, focus: RuleFocus) => void;
  onAdd: () => void;
  onMove: (from: number, to: number) => void;
  onToggle: (rule: IntakeRouteInfo, enabled: boolean) => void;
  onDelete: (rule: IntakeRouteInfo) => void;
}) {
  const text = laneText(event);
  const Icon = text.icon;
  const catchAll = catchAllIndex(rules, event);
  const opened = isOpenedLane(event);
  const drag = useRowDrag({ min: 0, max: rules.length - 1, onDrop: onMove });
  const fallback =
    footer ?? (rules.length ? 'Otherwise, the card stays where it is' : 'No rules: the card stays where it is');

  return (
    <section
      aria-label={text.label}
      className={cn(
        'grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[13rem_1fr] md:gap-6',
        !rules.length && 'opacity-60 focus-within:opacity-100 hover:opacity-100',
      )}
    >
      <div className="flex flex-col gap-1 md:pt-1.5">
        <span className="flex items-center gap-1.5">
          <Icon className="text-badge-amber-indicator size-3.5 shrink-0" aria-hidden />
          <Txt as="h3" variant="label" tone="ink">
            {text.label}
          </Txt>
        </span>
        {text.description && (
          <Txt as="p" variant="caption" tone="muted">
            {text.description}
          </Txt>
        )}
        {note}
      </div>

      <ol aria-label={`${text.label} rules`} className="flex min-w-0 flex-col">
        {rules.map((rule, index) => {
          const unreachable = shadowedBy(rules, event, index) >= 0;
          const skipped = !rule.enabled || unreachable;
          const dragging = drag.drag?.from === index;
          const skip = skips?.get(rule.id);
          return (
            <li
              key={rule.id}
              aria-label={rule.name}
              data-drop={drag.dropAt(index)}
              style={dragging ? { transform: `translateY(${drag.drag?.offset ?? 0}px)` } : undefined}
              onPointerDown={canEdit && rules.length > 1 ? pointer => drag.onPointerDown(pointer, index) : undefined}
              className={cn('group flex flex-col', DROP_LINE, dragging && 'z-10 opacity-90')}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <button
                  type="button"
                  aria-label={`Edit conditions of ${rule.name}`}
                  onClick={() => onEdit(rule, 'conditions')}
                  onKeyDown={canEdit ? key => drag.onKeyDown(key, index) : undefined}
                  className={cn(
                    'flex w-full shrink-0 items-start gap-2.5 rounded-lg border bg-fill-subtle px-3 py-2 text-left transition-colors hover:border-border-hover sm:w-80',
                    skipped ? 'border-dashed border-border opacity-50' : 'border-border',
                  )}
                >
                  <Txt
                    as="span"
                    variant="meta"
                    tone="muted"
                    className="bg-fill mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full tabular-nums"
                  >
                    {index + 1}
                  </Txt>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Filter className="text-muted-foreground size-3 shrink-0" aria-hidden />
                      <Txt as="span" variant="caption" tone="ink" className="truncate font-medium">
                        {rule.name}
                      </Txt>
                    </span>
                    <ConditionChips
                      when={rule.when}
                      options={phaseOptions}
                      everything={opened ? 'Every new item' : 'Every card'}
                    />
                  </span>
                </button>

                <div className={cn('flex min-w-0 flex-1 items-center gap-2', skipped && 'opacity-40')}>
                  <Txt as="span" variant="meta" tone="muted">
                    yes
                  </Txt>
                  <span
                    aria-hidden
                    className={cn(
                      'h-px min-w-6 flex-1',
                      skipped ? 'border-t border-dashed border-border-strong' : 'bg-muted-foreground',
                    )}
                  />
                  <button
                    type="button"
                    aria-label={`Edit where ${rule.name} moves the card`}
                    onClick={() => onEdit(rule, 'action')}
                    className="border-border bg-fill-subtle hover:border-border-hover flex w-40 shrink-0 rounded-lg border px-3 py-2 text-left sm:w-48"
                  >
                    <RuleTarget
                      boards={boards}
                      ownBoard={board.id}
                      boardKey={rule.target.moveToBoardKey ?? rule.target.boardKey}
                      phaseKey={rule.target.phaseKey}
                    />
                  </button>
                </div>

                {canEdit && (
                  <div className="flex shrink-0 items-center justify-end gap-0.5">
                    <div className="flex transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
                      {rules.length > 1 && (
                        <span
                          data-grip
                          aria-hidden
                          className="text-muted-foreground hidden cursor-grab touch-none items-center px-1 pointer-fine:flex"
                        >
                          <GripVertical className="size-3.5" />
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        tooltip="Check earlier"
                        disabled={index === 0}
                        onClick={() => onMove(index, index - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        tooltip="Check later"
                        disabled={index === rules.length - 1}
                        onClick={() => onMove(index, index + 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                    <Switch
                      aria-label={`${rule.name} on`}
                      checked={rule.enabled}
                      onCheckedChange={enabled => onToggle(rule, enabled)}
                    />
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button variant="ghost" size="icon-sm" tooltip={`More for ${rule.name}`}>
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item variant="destructive" onClick={() => onDelete(rule)}>
                          <Trash2 />
                          Delete rule
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {skipped && (
                <Txt as="span" variant="caption" tone="muted" className="mt-1 ml-3 flex items-center gap-1.5">
                  {unreachable ? (
                    <>
                      <TriangleAlert className="text-warning-indicator size-3" aria-hidden />
                      Never reached: rule {catchAll + 1} above matches every {opened ? 'item' : 'card'}.
                    </>
                  ) : (
                    'Off, skipped'
                  )}
                </Txt>
              )}
              {rule.problems.map(problem => (
                <Txt
                  key={problem}
                  as="span"
                  variant="caption"
                  tone="muted"
                  className="mt-1 ml-3 flex items-center gap-1.5"
                >
                  <TriangleAlert className="text-warning-indicator size-3 shrink-0" aria-hidden />
                  {problem}
                </Txt>
              ))}
              {skip && <SkipWarning skips={skip} />}
              {opened && isLegacyOpened(rule) && (
                <Txt as="span" variant="caption" tone="muted" className="mt-1 ml-3">
                  {laneText(LEGACY_OPENED_EVENT).label}
                </Txt>
              )}

              {index !== catchAll && (
                <div aria-hidden className="flex h-7 items-center pl-5.5">
                  <span className="bg-border-strong h-full w-px" />
                  <Txt as="span" variant="meta" tone="muted" className="ml-2">
                    no
                  </Txt>
                </div>
              )}
            </li>
          );
        })}

        <li className="flex flex-wrap items-center gap-3">
          {catchAll < 0 && (
            <Txt as="span" variant="caption" tone="muted" className="flex items-center gap-2.5 px-3 py-1.5 sm:w-80">
              <CircleDashed className="size-4 shrink-0" aria-hidden />
              {fallback}
            </Txt>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" icon={<Plus />} onClick={onAdd}>
              Add rule
            </Button>
          )}
        </li>
      </ol>
    </section>
  );
}

type RuleSkips = IntakeSkippedResponse['skipped'][number];

/** The skip's reason without the sentence the server wraps it in. */
function skipReason(reason: string | null) {
  const match = reason?.match(/was skipped: (.+?)\.?$/);
  return match?.[1] ?? reason ?? 'its target couldn’t take the card';
}

/** A card-move rule that matched, but whose target couldn't take the card, so the card stayed put. */
function SkipWarning({ skips }: { skips: RuleSkips }) {
  const { count, latest } = skips;
  return (
    <Txt as="span" variant="caption" tone="muted" className="mt-1 ml-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <TriangleAlert className="text-warning-indicator size-3 shrink-0" aria-hidden />
      <span>
        Skipped {count === 1 ? 'once' : `${count} times`} in the last 30 days: {skipReason(latest.reason)}.
      </span>
      {latest.url ? (
        <a href={latest.url} target="_blank" rel="noreferrer" className="underline">
          Latest: {latest.title}
        </a>
      ) : (
        <span>Latest: {latest.title}</span>
      )}
    </Txt>
  );
}
