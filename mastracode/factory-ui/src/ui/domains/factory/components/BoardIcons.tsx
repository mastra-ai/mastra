import type { BoardPhaseKind } from '@mastra/factory/boards';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentType } from 'react';

import { phaseKindOf } from '../boardFlow';
import type { BoardInfo } from '../boardFlow';
import { CARD_SOURCES } from '../cardSources';
import type { WorkItemSource } from '../services/workItems';
import { boardStage, stageTone } from '../stages';
import type { BuiltinStageId, StageTone } from '../stages';
import { IntakeIcon } from './IntakeIcon';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconCircleX } from '@mastra/playground-ui/icons/central/IconCircleX';
import { IconEyeOpen } from '@mastra/playground-ui/icons/central/IconEyeOpen';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';
import { IconPlay } from '@mastra/playground-ui/icons/central/IconPlay';
import { IconHammer } from '@mastra/playground-ui/icons/central/IconHammer';
import { IconCircleCheck } from '@mastra/playground-ui/icons/central/IconCircleCheck';
import { IconClipboard2 } from '@mastra/playground-ui/icons/central/IconClipboard2';

export function SourceIcon({ source, className }: { source: WorkItemSource; className?: string }) {
  const { Icon, iconClassName } = CARD_SOURCES[source];
  return <Icon data-source={source} className={cn('size-4 shrink-0', iconClassName, className)} aria-hidden />;
}

/** Icon for each known run-action label; `Play` is the fallback for anything else. */
const ACTION_ICONS: Record<string, ComponentType> = {
  Investigate: IconMagnifyingGlass,
  Build: IconHammer,
  'Prepare approval': IconClipboard2,
  Review: IconEyeOpen,
};

export function actionIcon(label: string) {
  const Icon = ACTION_ICONS[label] ?? IconPlay;
  return <Icon aria-hidden />;
}

type BoardTone = StageTone | 'success';

const PHASE_KIND_TONES: Record<BoardPhaseKind, BoardTone> = {
  resting: 'neutral',
  working: 'info',
  terminal: 'success',
};

const TONE_CLASSES: Record<BoardTone, { icon: string; tint: string; strongTint: string; gradientFrom: string }> = {
  neutral: {
    icon: 'text-muted-foreground',
    tint: 'bg-fill-subtle',
    strongTint: 'bg-fill-strong',
    gradientFrom: 'from-fill-subtle',
  },
  orange: {
    icon: 'text-(--orange-500) dark:text-(--orange-400)',
    tint: 'bg-badge-orange-subtle',
    strongTint: 'bg-badge-orange-strong',
    gradientFrom: 'from-badge-orange-subtle',
  },
  cyan: {
    icon: 'text-(--cyan-500) dark:text-(--cyan-400)',
    tint: 'bg-badge-cyan-subtle',
    strongTint: 'bg-badge-cyan-strong',
    gradientFrom: 'from-badge-cyan-subtle',
  },
  info: {
    icon: 'text-info-indicator',
    tint: 'bg-info-subtle',
    strongTint: 'bg-badge-blue-strong',
    gradientFrom: 'from-badge-blue-subtle',
  },
  green: {
    icon: 'text-badge-green-indicator',
    tint: 'bg-badge-green-subtle',
    strongTint: 'bg-badge-green-strong',
    gradientFrom: 'from-badge-green-subtle',
  },
  purple: {
    icon: 'text-badge-purple-indicator',
    tint: 'bg-badge-purple-subtle',
    strongTint: 'bg-badge-purple-strong',
    gradientFrom: 'from-badge-purple-subtle',
  },
  success: {
    icon: 'text-(--green-500) dark:text-(--green-400)',
    tint: 'bg-success-subtle',
    strongTint: 'bg-badge-green-strong',
    gradientFrom: 'from-badge-green-subtle',
  },
  destructive: {
    icon: 'text-destructive-indicator',
    tint: 'bg-destructive-subtle',
    strongTint: 'bg-badge-red-strong',
    gradientFrom: 'from-badge-red-subtle',
  },
};

function MaskedArt({ source, className }: { source: string; className: string }) {
  return (
    <span
      aria-hidden
      style={{ maskImage: `url(${source})` }}
      className={cn('size-4 shrink-0 bg-current mask-center mask-no-repeat mask-contain', className)}
    />
  );
}

const PROGRESS_PIE_RADIUS = 2.25;
const PROGRESS_PIE_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_PIE_RADIUS;

function ProgressPieIcon({ progress, className }: { progress: number; className: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden className={cn('shrink-0', className)}>
      <circle cx={8} cy={8} r={6} stroke="currentColor" strokeWidth={1.5} />
      <circle
        cx={8}
        cy={8}
        r={PROGRESS_PIE_RADIUS}
        stroke="currentColor"
        strokeWidth={PROGRESS_PIE_RADIUS * 2}
        strokeDasharray={`${progress * PROGRESS_PIE_CIRCUMFERENCE} ${PROGRESS_PIE_CIRCUMFERENCE}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

// Custom boards pass `kind` and may reuse a built-in id with another meaning, so `kind` wins over the id.
function builtinStageFor(stage: string, kind?: BoardPhaseKind): BuiltinStageId | undefined {
  return kind ? undefined : boardStage(stage);
}

/** The `kind` to draw a phase with: built-in boards get each phase's own art, other boards are drawn by kind. */
export function phaseIconKind(boardId: string, kind: BoardPhaseKind): BoardPhaseKind | undefined {
  return boardId === 'work' || boardId === 'review' ? undefined : kind;
}

export function boardPhaseIconKind(board: BoardInfo | undefined, stage: string): BoardPhaseKind | undefined {
  const kind = phaseKindOf(board, stage);
  return board && kind ? phaseIconKind(board.id, kind) : undefined;
}

function stageToneFor(stage: string, kind?: BoardPhaseKind): BoardTone {
  const builtin = builtinStageFor(stage, kind);
  return builtin ? stageTone(builtin) : PHASE_KIND_TONES[kind ?? 'resting'];
}

function StageArt({ stage, kind, className }: { stage: string; kind?: BoardPhaseKind; className: string }) {
  const lucideClassName = cn('shrink-0', className);
  switch (builtinStageFor(stage, kind) ?? kind ?? 'resting') {
    case 'intake':
      return <IntakeIcon className={lucideClassName} />;
    case 'triage':
      return <MaskedArt source="/factory-stage-icons/triage.svg" className={className} />;
    case 'planning':
      return <ProgressPieIcon progress={0.25} className={className} />;
    case 'execute':
    case 'working':
      return <ProgressPieIcon progress={0.5} className={className} />;
    case 'review':
    case 'pr-review':
      return <MaskedArt source="/factory-stage-icons/review.svg" className={className} />;
    case 'done':
    case 'terminal':
      return <IconCircleCheck aria-hidden className={cn('size-icon-md', lucideClassName)} />;
    case 'canceled':
      return <IconCircleX aria-hidden className={cn('size-icon-md', lucideClassName)} />;
    case 'resting':
      return <IconCircleDashed aria-hidden className={cn('size-icon-md', lucideClassName)} />;
  }
}

export function stageTintClass(stage: string, kind?: BoardPhaseKind): string {
  return TONE_CLASSES[stageToneFor(stage, kind)].tint;
}

/** Lane headers fade a translucent status tint into a band: raised card in dark, a fill in light where card is white. */
export function stageHeaderTintClass(stage: string, kind?: BoardPhaseKind): string {
  return cn(
    'bg-fill-subtle dark:bg-card bg-linear-to-r to-transparent',
    TONE_CLASSES[stageToneFor(stage, kind)].gradientFrom,
  );
}

export function stageStrongTintClass(stage: string, kind?: BoardPhaseKind): string {
  return TONE_CLASSES[stageToneFor(stage, kind)].strongTint;
}

export function stageColorClass(stage: string, kind?: BoardPhaseKind): string {
  return TONE_CLASSES[stageToneFor(stage, kind)].icon;
}

export const unfocusedStageClass = 'opacity-30';

export function BoardStageIcon({
  stage,
  kind,
  decorative = false,
}: {
  stage: string;
  kind?: BoardPhaseKind;
  /** Beside text that already names the phase, the icon adds nothing to the accessible name. */
  decorative?: boolean;
}) {
  const icon = <StageArt stage={stage} kind={kind} className={TONE_CLASSES[stageToneFor(stage, kind)].icon} />;
  if (decorative || !kind) return icon;
  return (
    <span role="img" aria-label={`${kind} phase`} className="inline-flex shrink-0">
      {icon}
    </span>
  );
}
