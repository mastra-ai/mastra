import type { BoardPhaseKind } from '@mastra/factory/boards';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { LinearIcon } from '@mastra/playground-ui/icons/LinearIcon';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  CircleX,
  ClipboardCheck,
  Eye,
  GitPullRequest,
  Hammer,
  Play,
  Search,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { WorkItemSource } from '../services/workItems';
import { boardStage, stageTone } from '../stages';
import type { BuiltinStageId, StageTone } from '../stages';
import { GitLabIcon, IncidentIoIcon, JiraIcon } from '../../../ui/icons';
import { IntakeIcon } from './IntakeIcon';

// GitHub keeps issue vs PR distinct — card meta shows #N for both
const SOURCE_ICONS: Record<WorkItemSource, { icon: ComponentType<SVGProps<SVGSVGElement>>; className: string }> = {
  'github-issue': { icon: GithubIcon, className: 'text-foreground' },
  'github-pr': { icon: GitPullRequest, className: 'text-badge-green-indicator' },
  'gitlab-issue': { icon: GitLabIcon, className: 'text-badge-red-indicator' },
  'gitlab-pr': { icon: GitLabIcon, className: 'text-badge-red-indicator' },
  'linear-issue': { icon: LinearIcon, className: 'text-badge-blue-indicator' },
  'jira-issue': { icon: JiraIcon, className: 'text-badge-blue-indicator' },
  'incidentio-follow-up': { icon: IncidentIoIcon, className: 'text-badge-red-indicator' },
  'slack-thread': { icon: SlackIcon, className: '' },
  manual: { icon: CircleDot, className: 'text-muted-foreground' },
};

export function SourceIcon({ source, className }: { source: WorkItemSource; className?: string }) {
  const { icon: Icon, className: sourceClassName } = SOURCE_ICONS[source];
  return <Icon data-source={source} className={cn('size-4 shrink-0', sourceClassName, className)} aria-hidden />;
}

/** Icon for each known run-action label; `Play` is the fallback for anything else. */
const ACTION_ICONS: Record<string, ComponentType> = {
  Investigate: Search,
  Build: Hammer,
  'Prepare approval': ClipboardCheck,
  Review: Eye,
};

export function actionIcon(label: string) {
  const Icon = ACTION_ICONS[label] ?? Play;
  return <Icon aria-hidden />;
}

const PHASE_KIND_TONES: Record<BoardPhaseKind, StageTone> = {
  resting: 'neutral',
  working: 'info',
  terminal: 'success',
};

const TONE_CLASSES: Record<StageTone, { icon: string; tint: string }> = {
  neutral: { icon: 'text-muted-foreground', tint: 'bg-fill-subtle' },
  orange: { icon: 'text-(--orange-500) dark:text-(--orange-400)', tint: 'bg-badge-orange-subtle' },
  cyan: { icon: 'text-(--cyan-500) dark:text-(--cyan-400)', tint: 'bg-badge-cyan-subtle' },
  info: { icon: 'text-info-indicator', tint: 'bg-info-subtle' },
  green: { icon: 'text-badge-green-indicator', tint: 'bg-badge-green-subtle' },
  success: { icon: 'text-(--green-500) dark:text-(--green-400)', tint: 'bg-success-subtle' },
  destructive: { icon: 'text-destructive-indicator', tint: 'bg-destructive-subtle' },
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

function stageToneFor(stage: string, kind?: BoardPhaseKind): StageTone {
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
      return <MaskedArt source="/factory-stage-icons/review.svg" className={className} />;
    case 'done':
    case 'terminal':
      return <CheckCircle2 width={16} height={16} aria-hidden className={lucideClassName} />;
    case 'canceled':
      return <CircleX width={16} height={16} aria-hidden className={lucideClassName} />;
    case 'resting':
      return <CircleDashed width={16} height={16} aria-hidden className={lucideClassName} />;
  }
}

export function stageTintClass(stage: string, kind?: BoardPhaseKind): string {
  return TONE_CLASSES[stageToneFor(stage, kind)].tint;
}

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
