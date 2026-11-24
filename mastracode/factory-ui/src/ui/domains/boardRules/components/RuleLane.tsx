import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CircleDashed,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo, IntakeSkippedResponse } from '../../../../api/types';
import { describeRule } from '../../settings/components/conditionFields';
import { useRowDrag } from '../../settings/components/useRowDrag';
import {
  catchAllIndex,
  everythingOn,
  isLegacyOpened,
  isOpenedLane,
  laneText,
  LEGACY_OPENED_EVENT,
  movesCardsOnly,
  nameRepeats,
  shadowedBy,
  skipsOutsidersOn,
} from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { boardName, phaseName } from '../ruleTargets';
import { ConditionChips } from './ConditionChips';
import { GithubOnlyBadge } from './GithubOnlyBadge';
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
  footer,
  incoming,
  only,
  onEdit,
  onAdd,
  onMove,
  onToggle,
  onDelete,
  onUngate,
}: {
  event: RuleEvent;
  rules: IntakeRouteInfo[];
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
  phaseOptions: Record<string, FilterBarOption[]>;
  canEdit: boolean;
  /** Each rule's skips in the last 30 days, by rule id. */
  skips?: ReadonlyMap<string, RuleSkips>;
  /** What happens when no rule matches; by default the card stays where it is. */
  footer?: string;
  /** Other boards' rules that move their cards onto this board on the same trigger. */
  incoming?: ReactNode;
  /** Shows only these rules, keeping their numbers; the lane can't be reordered while some are hidden. */
  only?: ReadonlySet<string>;
  onEdit: (rule: IntakeRouteInfo, focus: RuleFocus) => void;
  onAdd: () => void;
  onMove: (from: number, to: number) => void;
  onToggle: (rule: IntakeRouteInfo, enabled: boolean) => void;
  onDelete: (rule: IntakeRouteInfo) => void;
  /** Lets an older rule's card moves match outside authors' pull requests, like every newer rule. */
  onUngate: (rule: IntakeRouteInfo) => void;
}) {
  const text = laneText(event);
  const Icon = text.icon;
  const catchAll = catchAllIndex(rules, event);
  const opened = isOpenedLane(event);
  const everything = everythingOn(event);
  const drag = useRowDrag({ min: 0, max: rules.length - 1, onDrop: onMove });
  const sortable = canEdit && rules.length > 1 && !only;
  const fallback =
    footer ??
    (rules.length
      ? 'Otherwise, the card stays where it is'
      : incoming
        ? 'No rules: this board’s cards stay where they are'
        : 'No rules: the card stays where it is');

  return (
    <section
      aria-label={text.label}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        !rules.length && !incoming && 'opacity-60 focus-within:opacity-100 hover:opacity-100',
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <Icon className="text-badge-amber-indicator size-3.5 shrink-0" aria-hidden />
          <Txt as="h3" variant="label" tone="ink">
            {text.label}
          </Txt>
          {text.githubOnly && <GithubOnlyBadge />}
        </span>
        {text.description && (
          <Txt as="p" variant="caption" tone="muted">
            {text.description}
          </Txt>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <ol aria-label={`${text.label} rules`} className="flex min-w-0 flex-col">
          {rules.map((rule, index) => {
            if (only && !only.has(rule.id)) return null;
            const hiddenBy = shadowedBy(rules, event, index);
            const unreachable = hiddenBy >= 0;
            const skipped = !rule.enabled || unreachable;
            const dragging = drag.drag?.from === index;
            const skip = skips?.get(rule.id);
            const destination = boards.find(
              candidate => candidate.id === (rule.target.moveToBoardKey ?? rule.target.boardKey),
            );
            const showsName = !nameRepeats(
              rule.name,
              [
                text.label,
                describeRule(rule.when, phaseOptions),
                destination && boardName(destination),
                phaseName(destination, rule.target.phaseKey),
              ].join(' '),
            );
            return (
              <li
                key={rule.id}
                aria-label={rule.name}
                data-drop={drag.dropAt(index)}
                style={dragging ? { transform: `translateY(${drag.drag?.offset ?? 0}px)` } : undefined}
                onPointerDown={sortable ? pointer => drag.onPointerDown(pointer, index) : undefined}
                className={cn('group/rule flex flex-col', DROP_LINE, dragging && 'z-10 opacity-90')}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="relative min-w-0 sm:flex-1">
                    <button
                      type="button"
                      aria-label={`Edit conditions of ${rule.name}`}
                      onClick={() => onEdit(rule, 'conditions')}
                      onKeyDown={sortable ? key => drag.onKeyDown(key, index) : undefined}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg border bg-fill-subtle px-3 py-2 text-left transition-colors hover:border-border-hover',
                        skipped ? 'border-dashed border-border opacity-50' : 'border-border',
                      )}
                    >
                      <Txt
                        as="span"
                        variant="meta"
                        tone="muted"
                        className="bg-fill mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full tabular-nums"
                      >
                        <span className={cn(sortable && 'pointer-fine:group-hover/rule:hidden', dragging && 'hidden')}>
                          {index + 1}
                        </span>
                        {sortable && (
                          <span
                            data-grip
                            aria-hidden
                            className={cn(
                              'hidden cursor-grab touch-none pointer-fine:group-hover/rule:flex',
                              dragging && 'flex',
                            )}
                          >
                            <GripVertical className="size-icon-sm" />
                          </span>
                        )}
                      </Txt>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        {showsName && (
                          <Txt as="span" variant="caption" tone="ink" className="truncate font-medium">
                            {rule.name}
                          </Txt>
                        )}
                        <ConditionChips when={rule.when} options={phaseOptions} everything={everything} />
                      </span>
                    </button>
                    {sortable && (
                      <div className="border-border bg-card absolute top-0 right-2 flex -translate-y-1/2 rounded-md border shadow-sm transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within/rule:opacity-100 pointer-fine:group-hover/rule:opacity-100">
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
                    )}
                  </div>

                  <div className="flex min-w-0 items-center gap-3 sm:shrink-0">
                    <div className={cn('flex min-w-0 items-center', skipped && 'opacity-40')}>
                      <span
                        aria-hidden
                        className={cn(
                          'h-px w-8 shrink-0',
                          skipped ? 'border-t border-dashed border-border-strong' : 'bg-muted-foreground',
                        )}
                      />
                      <ArrowRight aria-hidden className="text-muted-foreground size-icon-sm mr-2 -ml-1.5 shrink-0" />
                      <button
                        type="button"
                        aria-label={`Edit where ${rule.name} moves the card`}
                        onClick={() => onEdit(rule, 'action')}
                        className="border-border bg-fill-subtle hover:border-border-hover flex w-44 shrink-0 rounded-lg border px-3 py-2 text-left"
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
                      <div className="ml-auto flex shrink-0 items-center gap-0.5">
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
                </div>

                {skipped && (
                  <Txt as="span" variant="caption" tone="muted" className="mt-1 ml-3 flex items-center gap-1.5">
                    {unreachable ? (
                      <>
                        <TriangleAlert className="text-warning-indicator size-icon-xs" aria-hidden />
                        Never reached: rule {hiddenBy + 1} above matches {everything.toLowerCase()}.
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
                    <TriangleAlert className="text-warning-indicator size-icon-xs shrink-0" aria-hidden />
                    {problem}
                  </Txt>
                ))}
                {skip && <SkipWarning skips={skip} />}
                {skipsOutsidersOn(rule, event) && (
                  <Txt
                    as="span"
                    variant="caption"
                    tone="muted"
                    className="mt-1 ml-3 flex flex-wrap items-center gap-x-1.5 gap-y-1"
                  >
                    Skips outside authors’ pull requests (older rule).
                    {canEdit && (
                      <button type="button" onClick={() => onUngate(rule)} className="underline">
                        Let outside authors match
                      </button>
                    )}
                  </Txt>
                )}
                {movesCardsOnly(rule, event) && (
                  <Txt as="span" variant="caption" tone="muted" className="mt-1 ml-3">
                    Moves cards only: files no new pull requests
                  </Txt>
                )}
                {opened && isLegacyOpened(rule) && (
                  <Txt as="span" variant="caption" tone="muted" className="mt-1 ml-3">
                    {laneText(LEGACY_OPENED_EVENT).label}
                  </Txt>
                )}

                {index !== catchAll && !only && (
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

          {!only && (
            <li className="flex flex-wrap items-center gap-3">
              {catchAll < 0 && (
                <Txt as="span" variant="caption" tone="muted" className="flex flex-1 items-center gap-2.5 px-3 py-1.5">
                  <CircleDashed className="size-icon-md shrink-0" aria-hidden />
                  {fallback}
                </Txt>
              )}
              {canEdit && (
                <Button variant="ghost" size="sm" icon={<Plus />} onClick={onAdd}>
                  Add rule
                </Button>
              )}
            </li>
          )}
        </ol>
        {incoming}
      </div>
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
      <TriangleAlert className="text-warning-indicator size-icon-xs shrink-0" aria-hidden />
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
