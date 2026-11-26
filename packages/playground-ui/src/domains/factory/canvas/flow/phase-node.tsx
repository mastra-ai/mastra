import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import type { BoardPhaseKind } from '../../board/board-icons';
import { CANVAS_SELECTED_RING } from './rule-chip';
import type { FlowEmphasis } from './rule-chip';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconArrowSplitUp } from '@/ds/icons/central/IconArrowSplitUp';
import { IconFlag2 } from '@/ds/icons/central/IconFlag2';
import { IconHammer } from '@/ds/icons/central/IconHammer';
import { IconHand5Finger } from '@/ds/icons/central/IconHand5Finger';
import { IconLock } from '@/ds/icons/central/IconLock';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { IconRobot } from '@/ds/icons/central/IconRobot';
import { IconTarget } from '@/ds/icons/central/IconTarget';
import { IconZap } from '@/ds/icons/central/IconZap';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import { focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** A phase as the canvas draws it. */
export interface FlowPhase {
  key: string;
  name: string;
  kind: BoardPhaseKind;
}

/** Who works a working phase's cards and how they leave, as its card lists it. */
export interface FlowPhaseWork {
  skill: string | undefined;
  /** Why its skill can't run, such as "Skill not found"; unset while the project's skills load. */
  skillProblem: string | undefined;
  autoStart: boolean;
  /** The exit tool, and who approves it. */
  exit: { id: string; approval: string } | undefined;
  goal: { maxRuns?: number } | undefined;
  /** The phase's tools by name, comma-separated; empty when it has none. */
  tools: string;
}

interface PhaseNodeProps {
  boardId: string;
  phase: FlowPhase;
  phases: readonly FlowPhase[];
  /** The phases its cards can move to, itself left out. */
  next: readonly string[];
  /** The moves its agent makes on its own. */
  automatic: ReadonlySet<string>;
  /** What its agent does; unset unless the phase is a working one. */
  work: FlowPhaseWork | undefined;
  /** Cards in the phase now; unknown until the board's cards load. */
  total: number | undefined;
  /** Selects the phase. */
  href: string;
  emphasis: FlowEmphasis;
  problem: boolean;
  unreached: boolean;
  /** New cards start in this phase. */
  start: boolean;
  /** It moves up and down the board with Alt+Up and Alt+Down. */
  movable: boolean;
  /** Absent when the board can't be changed here. */
  moves?: { required: ReadonlySet<string>; onChange: (nextPhases: string[]) => void };
  LinkComponent: LinkComponent;
}

/** A phase card's box, shared with the canvas skeleton so a loading board holds the same shape. */
export const PHASE_CARD = 'relative flex w-75 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3 max-sm:w-full';

/** A phase on the canvas: who works its cards, how they leave, and where they can go next. */
export function PhaseNode({
  boardId,
  phase,
  phases,
  next,
  automatic,
  work,
  total,
  href,
  emphasis,
  problem,
  unreached,
  start,
  movable,
  moves,
  LinkComponent: Link,
}: PhaseNodeProps) {
  const count = total === undefined ? undefined : total.toLocaleString();
  const terminal = phase.kind === 'terminal';
  const selected = emphasis === 'selected';
  const ref = useRef<HTMLElement>(null);

  // A phase opened from a link or "+ Phase" may sit below the fold; the scroll margins keep it clear of the bars.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <article
      ref={ref}
      aria-label={phase.name}
      className={cn(
        raisedSurfaceStyle,
        surfaceStateLayerStyle,
        'group/node scroll-mt-20 scroll-mb-40',
        PHASE_CARD,
        'transition-[opacity,box-shadow] duration-normal ease-out-custom motion-reduce:transition-none',
        'group-data-dragging/row:shadow-overlay has-focus-visible:[--surface-rim:var(--border-focus)]',
        emphasis === 'selected' && CANVAS_SELECTED_RING,
        emphasis === 'dimmed' && 'opacity-35',
        problem && emphasis !== 'selected' && 'ring-1 ring-warning-indicator',
      )}
    >
      <div data-inlet-at="" className="flex min-w-0 items-center gap-2">
        <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
        <Link
          href={href}
          aria-current={emphasis === 'selected' ? 'true' : undefined}
          aria-description={movable ? 'Alt+Up or Alt+Down moves this phase.' : undefined}
          className={cn(
            'truncate rounded-sm text-card-title-strong text-foreground',
            'after:absolute after:inset-0 after:rounded-2xl',
            focusRing,
          )}
        >
          {phase.name}
        </Link>
        {problem && (
          <TriangleAlert
            className="size-icon-xs shrink-0 text-warning-indicator"
            aria-label="This phase has problems"
          />
        )}
        {!terminal && count !== undefined && (
          <span className="ml-auto shrink-0 text-caption text-muted-foreground tabular-nums">{count}</span>
        )}
      </div>
      {terminal && count !== undefined && (
        <span className="text-caption text-muted-foreground tabular-nums">{count}</span>
      )}
      {start && <span className="text-caption text-muted-foreground">New cards start here</span>}
      <PhaseWork kind={phase.kind} work={work} />
      {unreached && (
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <TriangleAlert className="size-icon-xs shrink-0 text-warning-indicator" aria-hidden />
          No rule or move leads here
        </span>
      )}
      {(next.length > 0 || moves) && (
        <div className="flex gap-2 border-t border-border pt-2.5">
          {moves ? (
            <MovesPicker
              boardId={boardId}
              phase={phase}
              phases={phases}
              next={next}
              shown={emphasis === 'selected'}
              {...moves}
            />
          ) : (
            <IconArrowSplitUp className="mt-1.25 size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
          )}
          <ul aria-label="Moves to" className="flex min-w-0 flex-wrap gap-1.5">
            {next.map(key => {
              const target = phases.find(other => other.key === key);
              return (
                <li key={key} className="flex h-6 min-w-0 items-center gap-1 rounded-lg bg-background px-1.5">
                  {target && <BoardStageIcon stage={key} kind={phaseIconKind(boardId, target.kind)} decorative />}
                  <span className="truncate text-body-sm text-foreground">{target?.name ?? key}</span>
                  {automatic.has(key) && (
                    <IconZap className="size-icon-xs shrink-0 text-muted-foreground" aria-label="on its own" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

function PhaseWork({ kind, work }: { kind: BoardPhaseKind; work: FlowPhaseWork | undefined }) {
  if (kind === 'resting') return <WorkRow icon={IconHand5Finger} label="Waits for someone" />;
  if (kind !== 'working' || !work) return null;
  const { goal, tools } = work;
  return (
    <>
      <WorkRow
        icon={IconRobot}
        label={work.skill ?? 'No skill'}
        broken={work.skillProblem !== undefined}
        detailIcon={work.autoStart ? IconZap : IconHand5Finger}
        detail={work.autoStart ? 'On its own' : 'By hand'}
      />
      {work.skillProblem && (
        <span className="flex items-center gap-1.5 text-caption text-destructive-foreground">
          <TriangleAlert className="size-icon-xs shrink-0" aria-hidden />
          {work.skillProblem}
        </span>
      )}
      {work.exit && <WorkRow icon={IconFlag2} label={work.exit.id} detail={work.exit.approval} />}
      {goal && (
        <WorkRow
          icon={IconTarget}
          label="Goal"
          detail={goal.maxRuns === undefined ? undefined : `Pauses after ${goal.maxRuns} runs`}
        />
      )}
      {tools && <WorkRow icon={IconHammer} label={tools} />}
    </>
  );
}

/**
 * What a phase does, and how, on the right. A detail too long to sit beside the label wraps under it, two lines at
 * most, so neither one is cut to a few letters.
 */
function WorkRow({
  icon: Icon,
  label,
  broken = false,
  detail,
  detailIcon: DetailIcon,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** The label names something that can't run. */
  broken?: boolean;
  detail?: string;
  detailIcon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="mt-0.75 size-icon-xs shrink-0 text-muted-foreground" />
      {/* Spread apart while both fit on a line; the detail alone on the next line starts under the label. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3">
        <span
          className={cn('min-w-0 truncate text-body-sm', broken ? 'text-destructive-foreground' : 'text-foreground')}
        >
          {label}
        </span>
        {detail && (
          <span className="flex max-w-full min-w-0 items-center gap-1 text-caption text-muted-foreground">
            {DetailIcon && <DetailIcon className="size-icon-xs shrink-0" />}
            <span className="line-clamp-2">{detail}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Cross-fades the moves icon and the "+" that replaces it. */
const SWAP =
  'col-start-1 row-start-1 size-icon-xs duration-normal ease-out-custom transition-opacity motion-reduce:transition-none';

/**
 * The moves' icon, which turns into a "+" on the selected phase, on hover or on focus: allows or stops a move; moves
 * Factory's code makes stay on. Sitting in the icon's place, it never takes room from the moves or wraps to a line
 * of its own.
 */
function MovesPicker({
  boardId,
  phase,
  phases,
  next,
  shown,
  required,
  onChange,
}: {
  boardId: string;
  phase: FlowPhase;
  phases: readonly FlowPhase[];
  /** The phases its cards can move to now, itself left out. */
  next: readonly string[];
  /** Always shown on the selected phase; on the others, on hover or focus. */
  shown: boolean;
  required: ReadonlySet<string>;
  onChange: (nextPhases: string[]) => void;
}) {
  const toggle = (key: string) =>
    onChange(
      next.includes(key)
        ? next.filter(other => other !== key)
        : phases.filter(other => other.key === key || next.includes(other.key)).map(other => other.key),
    );

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            aria-label={`Change moves from ${phase.name}`}
            className={cn(
              'group/moves relative z-10 -mx-1.25 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-fill-hover hover:text-foreground',
              'data-popup-open:bg-fill-hover data-popup-open:text-foreground',
              focusRing,
            )}
          >
            <IconArrowSplitUp
              className={cn(
                SWAP,
                shown
                  ? 'opacity-0'
                  : 'group-hover/node:opacity-0 group-focus-visible/moves:opacity-0 group-data-popup-open/moves:opacity-0',
              )}
            />
            <IconPlusMedium
              className={cn(
                SWAP,
                !shown &&
                  'opacity-0 group-hover/node:opacity-100 group-focus-visible/moves:opacity-100 group-data-popup-open/moves:opacity-100',
              )}
            />
          </button>
        }
      />
      <DropdownMenu.Content align="start" className="w-56">
        <DropdownMenu.Label>Cards can move to</DropdownMenu.Label>
        {phases
          .filter(other => other.key !== phase.key)
          .map(other => {
            const locked = next.includes(other.key) && required.has(other.key);
            return (
              <DropdownMenu.CheckboxItem
                key={other.key}
                checked={next.includes(other.key)}
                disabled={locked}
                onCheckedChange={() => toggle(other.key)}
              >
                <BoardStageIcon stage={other.key} kind={phaseIconKind(boardId, other.kind)} decorative />
                <span className="truncate">{other.name}</span>
                {locked && <IconLock className="ml-auto size-icon-xs" aria-label="Factory makes this move" />}
              </DropdownMenu.CheckboxItem>
            );
          })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
