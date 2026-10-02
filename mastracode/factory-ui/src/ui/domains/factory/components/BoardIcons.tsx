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
import type { ComponentType, ReactElement, SVGProps } from 'react';

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

type PhaseKind = 'resting' | 'working' | 'terminal';

type StageArt = (props: { className: string }) => ReactElement;

const TONE_CLASSES: Record<StageTone, { icon: string; tint: string }> = {
  neutral: { icon: 'text-muted-foreground', tint: 'bg-fill-subtle' },
  orange: { icon: 'text-badge-orange-indicator', tint: 'bg-badge-orange-indicator/5' },
  cyan: { icon: 'text-badge-cyan-indicator', tint: 'bg-badge-cyan-indicator/5' },
  info: { icon: 'text-info-indicator', tint: 'bg-info-indicator/5' },
  purple: { icon: 'text-badge-purple-indicator', tint: 'bg-badge-purple-indicator/5' },
  success: { icon: 'text-success-indicator', tint: 'bg-success-indicator/5' },
  destructive: { icon: 'text-destructive-indicator', tint: 'bg-destructive-indicator/5' },
};

// The artwork is a grey file; masking it lets the stage's colour paint through.
function MaskedArt({ source, className }: { source: string; className: string }) {
  return (
    <span
      aria-hidden
      style={{ maskImage: `url(${source})` }}
      className={cn(
        'size-4 shrink-0 bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]',
        className,
      )}
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

const lucideArt =
  (Icon: ComponentType<SVGProps<SVGSVGElement>>): StageArt =>
  ({ className }) => <Icon width={16} height={16} aria-hidden className={cn('shrink-0', className)} />;

const BUILTIN_STAGE_ART: Record<BuiltinStageId, StageArt> = {
  intake: ({ className }) => <IntakeIcon className={cn('shrink-0', className)} />,
  triage: ({ className }) => <MaskedArt source="/factory-stage-icons/triage.svg" className={className} />,
  planning: ({ className }) => <ProgressPieIcon progress={0.25} className={className} />,
  execute: ({ className }) => <ProgressPieIcon progress={0.5} className={className} />,
  review: ({ className }) => <MaskedArt source="/factory-stage-icons/review.svg" className={className} />,
  done: lucideArt(CheckCircle2),
  canceled: lucideArt(CircleX),
};

const PHASE_KIND_STYLES: Record<PhaseKind, { art: StageArt; tone: StageTone }> = {
  resting: { art: lucideArt(CircleDashed), tone: 'neutral' },
  working: { art: ({ className }) => <ProgressPieIcon progress={0.5} className={className} />, tone: 'info' },
  terminal: { art: lucideArt(CheckCircle2), tone: 'success' },
};

// Custom boards pass `kind` and may reuse a built-in id with another meaning, so `kind` wins over the id.
function stageStyle(stage: string, kind?: PhaseKind): { art: StageArt; tone: StageTone } {
  if (kind) return PHASE_KIND_STYLES[kind];
  const builtin = boardStage(stage);
  if (!builtin) return PHASE_KIND_STYLES.resting;
  return { art: BUILTIN_STAGE_ART[builtin], tone: stageTone(builtin) };
}

export function stageTintClass(stage: string, kind?: PhaseKind): string {
  return TONE_CLASSES[stageStyle(stage, kind).tone].tint;
}

export function BoardStageIcon({
  stage,
  kind,
  decorative = false,
}: {
  stage: string;
  kind?: PhaseKind;
  /** Beside text that already names the phase; a custom phase's icon otherwise announces its kind. */
  decorative?: boolean;
}) {
  const { art: Art, tone } = stageStyle(stage, kind);
  const icon = <Art className={TONE_CLASSES[tone].icon} />;
  if (decorative || !kind) return icon;
  return (
    <span role="img" aria-label={`${kind} phase`} className="inline-flex shrink-0">
      {icon}
    </span>
  );
}
