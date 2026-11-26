import { BOARD_LIST_GROUP_HEADER_SURFACE_CLASS } from './board-layout';
import { IntakeIcon } from './intake-icon';
import type { BadgeVariant } from '@/ds/components/Badge';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { IconCircleX } from '@/ds/icons/central/IconCircleX';
import { cn } from '@/utils/cn';

/** How a phase behaves: waiting on someone, being worked, or finished. Mirrors `@mastra/factory/boards`. */
export type BoardPhaseKind = 'resting' | 'working' | 'terminal';

/** A board phase id. Built-in ids get their own art and colour; any other id is drawn by its kind. */
export type BoardStageId = string;

export interface BoardStage {
  id: BoardStageId;
  label: string;
}

const WORK_STAGES = ['intake', 'triage', 'planning', 'execute', 'review', 'pr-review', 'done', 'canceled'] as const;

type BuiltinStageId = (typeof WORK_STAGES)[number];

const STAGE_TONES = {
  intake: 'neutral',
  triage: 'orange',
  planning: 'cyan',
  execute: 'info',
  review: 'green',
  'pr-review': 'green',
  done: 'purple',
  canceled: 'destructive',
} as const satisfies Record<BuiltinStageId, BadgeVariant>;

export type StageTone = (typeof STAGE_TONES)[BuiltinStageId];

type BoardTone = StageTone | 'success';

function boardStage(stage: string): BuiltinStageId | undefined {
  return WORK_STAGES.find(builtin => builtin === stage);
}

// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function stageTone(stage: string): StageTone {
  const builtin = boardStage(stage);
  return builtin ? STAGE_TONES[builtin] : 'neutral';
}

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

const TRIAGE_PATH =
  'M7.49512 10.9072C7.88154 10.9074 8.1952 11.221 8.19531 11.6074V13.9053C8.19531 14.2918 7.8816 14.6053 7.49512 14.6055C7.10852 14.6055 6.79492 14.2919 6.79492 13.9053V11.6074C6.79503 11.2209 7.10859 10.9072 7.49512 10.9072ZM3.84375 9.90039C4.11701 9.62739 4.55969 9.62748 4.83301 9.90039C5.10637 10.1738 5.10637 10.6173 4.83301 10.8906L3.14355 12.5801C2.87019 12.8534 2.42669 12.8534 2.15332 12.5801C1.88047 12.3068 1.88051 11.8641 2.15332 11.5908L3.84375 9.90039ZM10.0166 9.76172C10.29 9.48835 10.7335 9.48835 11.0068 9.76172L12.7012 11.4551C12.9745 11.7284 12.9744 12.1719 12.7012 12.4453C12.4278 12.7187 11.9843 12.7187 11.7109 12.4453L10.0166 10.751C9.74372 10.4777 9.74372 10.035 10.0166 9.76172ZM7.44043 5.30957C8.52235 5.30957 9.39941 6.18664 9.39941 7.26855C9.39941 8.35047 8.52235 9.22754 7.44043 9.22754C6.59445 9.22754 5.87568 8.69058 5.60156 7.93945H0.700195C0.313596 7.93945 0 7.62586 0 7.23926C9.01695e-06 6.85267 0.313602 6.53906 0.700195 6.53906H5.62305C5.91249 5.81865 6.61651 5.30957 7.44043 5.30957ZM14.0107 6.53906C14.3973 6.53911 14.7109 6.8527 14.7109 7.23926C14.7109 7.62583 14.3973 7.93941 14.0107 7.93945H11.7373C11.3507 7.93945 11.0371 7.62586 11.0371 7.23926C11.0371 6.85267 11.3507 6.53906 11.7373 6.53906H14.0107ZM11.6289 2.11523C11.9023 1.84204 12.3458 1.84192 12.6191 2.11523C12.8923 2.38855 12.8923 2.83213 12.6191 3.10547L10.8613 4.86328C10.588 5.13661 10.1445 5.13653 9.87109 4.86328C9.59773 4.58991 9.59773 4.14641 9.87109 3.87305L11.6289 2.11523ZM2.37207 2.11621C2.64543 1.843 3.088 1.84295 3.36133 2.11621L4.93945 3.69434C5.2127 3.96767 5.21266 4.41024 4.93945 4.68359C4.66609 4.95696 4.22259 4.95696 3.94922 4.68359L2.37207 3.10645C2.0987 2.83308 2.0987 2.38958 2.37207 2.11621ZM7.49512 0C7.8816 0.000131874 8.19531 0.313677 8.19531 0.700195V3.00391C8.19515 3.39029 7.8815 3.70299 7.49512 3.70312C7.10862 3.70312 6.79509 3.39037 6.79492 3.00391V0.700195C6.79492 0.313596 7.10852 0 7.49512 0Z';
const REVIEW_PATH =
  'M10.667 3.30078C11.7899 3.30078 12.7 4.21116 12.7002 5.33398V9.39551C13.8516 9.7042 14.7002 10.7522 14.7002 12.001C14.7002 13.4922 13.4912 14.7012 12 14.7012C10.5088 14.7012 9.2998 13.4922 9.2998 12.001C9.2998 10.7518 10.1488 9.70283 11.3008 9.39453V5.33398C11.3006 4.98435 11.0167 4.70117 10.667 4.70117H8.66699C8.28039 4.70117 7.9668 4.38758 7.9668 4.00098C7.9668 3.61438 8.28039 3.30078 8.66699 3.30078H10.667ZM4 1.30078C5.49117 1.30078 6.7002 2.50981 6.7002 4.00098C6.7002 5.24962 5.85146 6.29669 4.7002 6.60547V13.668C4.70002 14.0544 4.38649 14.3672 4 14.3672C3.61351 14.3672 3.29998 14.0544 3.2998 13.668V6.60547C2.14854 6.29669 1.2998 5.24962 1.2998 4.00098C1.2998 2.50981 2.50883 1.30078 4 1.30078ZM12 10.7012C11.282 10.7012 10.7002 11.283 10.7002 12.001C10.7002 12.719 11.282 13.3008 12 13.3008C12.718 13.3008 13.2998 12.719 13.2998 12.001C13.2998 11.283 12.718 10.7012 12 10.7012ZM4 2.70117C3.28203 2.70117 2.7002 3.28301 2.7002 4.00098C2.7002 4.71894 3.28203 5.30078 4 5.30078C4.71797 5.30078 5.2998 4.71894 5.2998 4.00098C5.2998 3.28301 4.71797 2.70117 4 2.70117Z';

function svgMask(viewBox: string, d: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="${viewBox}"><path d="${d}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const TRIAGE_MASK = svgMask('0 0 14.7109 14.6055', TRIAGE_PATH);
const REVIEW_MASK = svgMask('0 0 16 16', REVIEW_PATH);

function MaskedArt({ mask, className }: { mask: string; className: string }) {
  return (
    <span
      aria-hidden
      style={{ maskImage: mask }}
      className={cn('size-4 shrink-0 bg-current mask-contain mask-center mask-no-repeat', className)}
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
// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function phaseIconKind(boardId: string, kind: BoardPhaseKind): BoardPhaseKind | undefined {
  return boardId === 'work' || boardId === 'review' ? undefined : kind;
}

function stageToneFor(stage: string, kind?: BoardPhaseKind): BoardTone {
  const builtin = builtinStageFor(stage, kind);
  return builtin ? STAGE_TONES[builtin] : PHASE_KIND_TONES[kind ?? 'resting'];
}

function StageArt({ stage, kind, className }: { stage: string; kind?: BoardPhaseKind; className: string }) {
  const lucideClassName = cn('shrink-0', className);
  switch (builtinStageFor(stage, kind) ?? kind ?? 'resting') {
    case 'intake':
      return <IntakeIcon className={lucideClassName} />;
    case 'triage':
      return <MaskedArt mask={TRIAGE_MASK} className={className} />;
    case 'planning':
      return <ProgressPieIcon progress={0.25} className={className} />;
    case 'execute':
    case 'working':
      return <ProgressPieIcon progress={0.5} className={className} />;
    case 'review':
    case 'pr-review':
      return <MaskedArt mask={REVIEW_MASK} className={className} />;
    case 'done':
    case 'terminal':
      return <IconCircleCheck aria-hidden className={cn('size-icon-md', lucideClassName)} />;
    case 'canceled':
      return <IconCircleX aria-hidden className={cn('size-icon-md', lucideClassName)} />;
    case 'resting':
      return <IconCircleDashed aria-hidden className={cn('size-icon-md', lucideClassName)} />;
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function stageTintClass(stage: string, kind?: BoardPhaseKind): string {
  return TONE_CLASSES[stageToneFor(stage, kind)].tint;
}

/** Lane headers fade a translucent status tint into a band: raised card in dark, a fill in light where card is white. */
// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function stageHeaderTintClass(stage: string, kind?: BoardPhaseKind): string {
  return cn(
    BOARD_LIST_GROUP_HEADER_SURFACE_CLASS,
    'bg-linear-to-r to-transparent',
    TONE_CLASSES[stageToneFor(stage, kind)].gradientFrom,
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
export function stageStrongTintClass(stage: string, kind?: BoardPhaseKind): string {
  return TONE_CLASSES[stageToneFor(stage, kind)].strongTint;
}

// eslint-disable-next-line react-refresh/only-export-components -- helper intentionally co-located with the components that use it
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
