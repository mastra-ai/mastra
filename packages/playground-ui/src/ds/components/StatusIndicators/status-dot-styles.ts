import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'progress' | 'error' | 'idle' | 'neutral';
export type StatusDotGlyph = 'circle' | 'square' | 'dashed';

export type StatusPresentation = {
  label: string;
  tone: StatusTone;
  glyph?: StatusDotGlyph;
  description: string;
};

export type StatusPresentationFn<T> = (status: T | null) => StatusPresentation;

const TONE_FILL: Record<StatusTone, string> = {
  success: 'bg-success-indicator',
  progress: 'bg-warning-indicator',
  error: 'bg-destructive-indicator',
  idle: 'bg-info-indicator',
  neutral: 'bg-muted-foreground',
};

const PROGRESS_DECORATION =
  "relative motion-safe:animate-pulse before:absolute before:-inset-1 before:rounded-full before:border before:border-warning-indicator/20 before:border-t-warning-indicator before:content-[''] motion-safe:before:animate-spin motion-reduce:before:animate-none";

const GLYPH_CLASS: Record<StatusDotGlyph, string> = {
  circle: 'rounded-full',
  square: 'rounded-xs',
  dashed: 'border-muted-foreground rounded-full border border-dashed bg-transparent',
};

export function statusToneFill(tone: StatusTone): string {
  return TONE_FILL[tone];
}

export function statusDotClass(
  { tone, glyph = 'circle' }: Pick<StatusPresentation, 'tone' | 'glyph'>,
  className?: string,
): string {
  return cn(
    'inline-block size-2 shrink-0',
    TONE_FILL[tone],
    tone === 'progress' && PROGRESS_DECORATION,
    GLYPH_CLASS[glyph],
    className,
  );
}
