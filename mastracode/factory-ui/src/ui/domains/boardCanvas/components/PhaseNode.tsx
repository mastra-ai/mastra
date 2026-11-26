import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { IconArrowSplitUp } from '@mastra/playground-ui/icons/central/IconArrowSplitUp';
import { IconFlag2 } from '@mastra/playground-ui/icons/central/IconFlag2';
import { IconHammer } from '@mastra/playground-ui/icons/central/IconHammer';
import { IconHand5Finger } from '@mastra/playground-ui/icons/central/IconHand5Finger';
import { IconLock } from '@mastra/playground-ui/icons/central/IconLock';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { IconRobot } from '@mastra/playground-ui/icons/central/IconRobot';
import { IconTarget } from '@mastra/playground-ui/icons/central/IconTarget';
import { IconZap } from '@mastra/playground-ui/icons/central/IconZap';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router';

import type { StoredPhaseInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { nextPhasesOf } from '../../boardConfig/boardDraft';
import { approvalText, toolLabel } from '../../boardConfig/phaseSummary';
import { movesOnItsOwn } from '../canvasModel';
import type { Emphasis } from '../canvasModel';
import { SELECTED_RING } from './RuleChip';

interface PhaseNodeProps {
  boardId: string;
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  /** Cards in the phase now; unknown until the board's cards load. */
  total: number | undefined;
  /** Selects the phase. */
  to: string;
  emphasis: Emphasis;
  problem: boolean;
  unreached: boolean;
  /** Absent when the board can't be changed here. */
  moves?: { required: ReadonlySet<string>; onChange: (nextPhases: string[]) => void };
}

/** A phase on the canvas: who works its cards, how they leave, and where they can go next. */
export function PhaseNode({ boardId, phase, phases, total, to, emphasis, problem, unreached, moves }: PhaseNodeProps) {
  const next = nextPhasesOf(phase, phases).filter(key => key !== phase.key);
  const automatic = movesOnItsOwn(phase, phases);
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
        'group/node relative flex w-75 scroll-mt-20 scroll-mb-40 flex-col gap-1.75 rounded-2xl px-3.25 pt-2.75 pb-3 max-sm:w-full',
        'duration-normal ease-out-custom transition-[opacity,box-shadow] motion-reduce:transition-none',
        'has-focus-visible:[--surface-rim:var(--border-focus)] group-data-dragging/row:shadow-overlay',
        emphasis === 'selected' && SELECTED_RING,
        emphasis === 'dimmed' && 'opacity-35',
        problem && emphasis !== 'selected' && 'ring-warning-indicator ring-1',
      )}
    >
      <div data-inlet-at="" className="flex min-w-0 items-center gap-2">
        <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />
        <Link
          to={to}
          aria-current={emphasis === 'selected' ? 'true' : undefined}
          className={cn(
            'text-card-title-strong text-foreground truncate rounded-sm',
            'after:absolute after:inset-0 after:rounded-2xl',
            focusRing,
          )}
        >
          {phase.name}
        </Link>
        {problem && (
          <TriangleAlert
            className="text-warning-indicator size-icon-xs shrink-0"
            aria-label="This phase has problems"
          />
        )}
        {!terminal && count !== undefined && (
          <span className="text-caption text-muted-foreground ml-auto shrink-0 tabular-nums">{count}</span>
        )}
      </div>
      {terminal && count !== undefined && (
        <span className="text-caption text-muted-foreground tabular-nums">{count}</span>
      )}
      <PhaseWork phase={phase} />
      {unreached && (
        <span className="text-caption text-muted-foreground flex items-center gap-1.5">
          <TriangleAlert className="text-warning-indicator size-icon-xs shrink-0" aria-hidden />
          No rule or move leads here
        </span>
      )}
      {(next.length > 0 || moves) && (
        <div className="border-border flex gap-2 border-t pt-2.5">
          {moves ? (
            <MovesPicker boardId={boardId} phase={phase} phases={phases} shown={emphasis === 'selected'} {...moves} />
          ) : (
            <IconArrowSplitUp className="text-muted-foreground size-icon-xs mt-1.25 shrink-0" aria-hidden />
          )}
          <ul aria-label="Moves to" className="flex min-w-0 flex-wrap gap-1.5">
            {next.map(key => {
              const target = phases.find(other => other.key === key);
              return (
                <li key={key} className="bg-background flex h-6 min-w-0 items-center gap-1 rounded-lg px-1.5">
                  {target && <BoardStageIcon stage={key} kind={phaseIconKind(boardId, target.kind)} decorative />}
                  <span className="text-body-sm text-foreground truncate">{target?.name ?? key}</span>
                  {automatic.has(key) && (
                    <IconZap className="text-muted-foreground size-icon-xs shrink-0" aria-label="on its own" />
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

function PhaseWork({ phase }: { phase: StoredPhaseInfo }) {
  if (phase.kind === 'resting') return <WorkRow icon={IconHand5Finger} label="Waits for someone" />;
  if (phase.kind !== 'working') return null;
  const goal = phase.runner?.goal;
  const tools = (phase.tools ?? []).map(toolLabel).join(', ');
  return (
    <>
      <WorkRow
        icon={IconRobot}
        label={phase.runner?.skill ?? 'No skill'}
        detailIcon={phase.autoStart ? IconZap : IconHand5Finger}
        detail={phase.autoStart ? 'On its own' : 'By hand'}
      />
      {phase.exitTool && <WorkRow icon={IconFlag2} label={phase.exitTool.id} detail={approvalText(phase.exitTool)} />}
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
  detail,
  detailIcon: DetailIcon,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
  detailIcon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon className="text-muted-foreground size-icon-xs mt-0.75 shrink-0" />
      {/* Spread apart while both fit on a line; the detail alone on the next line starts under the label. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3">
        <span className="text-body-sm text-foreground min-w-0 truncate">{label}</span>
        {detail && (
          <span className="text-caption text-muted-foreground flex max-w-full min-w-0 items-center gap-1">
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
  shown,
  required,
  onChange,
}: {
  boardId: string;
  phase: StoredPhaseInfo;
  phases: StoredPhaseInfo[];
  /** Always shown on the selected phase; on the others, on hover or focus. */
  shown: boolean;
  required: ReadonlySet<string>;
  onChange: (nextPhases: string[]) => void;
}) {
  const next = nextPhasesOf(phase, phases).filter(key => key !== phase.key);
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
              'group/moves text-muted-foreground hover:text-foreground hover:bg-fill-hover relative z-10 -mx-1.25 grid size-6 shrink-0 place-items-center rounded-full',
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
                {locked && <IconLock className="size-icon-xs ml-auto" aria-label="Factory makes this move" />}
              </DropdownMenu.CheckboxItem>
            );
          })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
