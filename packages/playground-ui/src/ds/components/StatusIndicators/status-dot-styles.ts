import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'progress' | 'error' | 'neutral';
export type StatusDotGlyph = 'filled' | 'ring';

export type StatusPresentation = {
  label: string;
  tone: StatusTone;
  glyph?: StatusDotGlyph;
  description: string;
};

export type StatusPresentationFn<T> = (status: T | null) => StatusPresentation;

export type DeployState = 'ready' | 'building' | 'idle' | 'queued' | 'stopped' | 'error';

export const deployStates = {
  ready: { label: 'Ready', tone: 'success' },
  building: { label: 'Building', tone: 'progress' },
  idle: { label: 'Idle', tone: 'neutral', glyph: 'ring' },
  queued: { label: 'Queued', tone: 'neutral', glyph: 'ring' },
  stopped: { label: 'Stopped', tone: 'neutral' },
  error: { label: 'Error', tone: 'error' },
} satisfies Record<DeployState, Omit<StatusPresentation, 'description'>>;

const TONE_FILL: Record<StatusTone, string> = {
  success: 'bg-success-indicator',
  progress: 'bg-warning-indicator',
  error: 'bg-destructive-indicator',
  neutral: 'bg-muted-foreground',
};

const TONE_RING: Record<StatusTone, string> = {
  success: 'border-success-indicator',
  progress: 'border-warning-indicator',
  error: 'border-destructive-indicator',
  neutral: 'border-muted-foreground',
};

const PROGRESS_DECORATION =
  "relative motion-safe:animate-pulse before:absolute before:-inset-1 before:rounded-full before:border before:border-warning-indicator/20 before:border-t-warning-indicator before:content-[''] motion-safe:before:animate-spin motion-reduce:before:animate-none";

export function statusToneFill(tone: StatusTone): string {
  return TONE_FILL[tone];
}

export function statusDotClass(
  { tone, glyph = 'filled' }: Pick<StatusPresentation, 'tone' | 'glyph'>,
  className?: string,
): string {
  return cn(
    'inline-block size-2 shrink-0 rounded-full',
    glyph === 'ring' ? cn('border bg-transparent', TONE_RING[tone]) : TONE_FILL[tone],
    tone === 'progress' && PROGRESS_DECORATION,
    className,
  );
}
