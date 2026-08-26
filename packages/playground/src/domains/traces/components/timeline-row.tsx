import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export type TimelineRowProps = {
  /** Elapsed time since the turn started, e.g. `3.2s`. Blank when unknown. */
  offset?: string;
  /** Short all-caps category shown before the content, e.g. `MODEL`. */
  kind?: string;
  tone?: 'default' | 'accent' | 'muted' | 'error';
  as?: 'li' | 'div';
  testId?: string;
  dataError?: string;
  /** Hover text carrying details that would clutter the row, e.g. wall clock and span name. */
  title?: string;
  /** Entity icon shown on the rail instead of the dot, when the step maps to a sidebar entity. */
  icon?: ReactNode;
  children: ReactNode;
};

const DOT_TONE: Record<NonNullable<TimelineRowProps['tone']>, string> = {
  default: 'bg-neutral3',
  accent: 'bg-accent1',
  muted: 'border-neutral3 border bg-transparent',
  error: 'bg-accent2',
};

/**
 * Sits the marker on the middle of the row's first line rather than at a fixed distance from the
 * top: `py-2.5` (0.625rem) plus half a `text-ui-smd` line (0.8125rem x 150% / 2). Dot and icon
 * share it so they land on the same baseline as the kind label opposite the rail.
 */
const MARKER_CENTER = 'left-1/2 top-[calc(0.625rem+0.609rem)] -translate-x-1/2 -translate-y-1/2';

const KIND_TONE: Record<NonNullable<TimelineRowProps['tone']>, string> = {
  default: 'text-neutral2',
  accent: 'text-accent1',
  muted: 'text-neutral2',
  error: 'text-accent2',
};

/**
 * A single line of the timeline: elapsed time in the gutter, a dot on the rail, a category,
 * then the content. Every row shares this grid so the rail reads as one continuous line.
 */
export function TimelineRow({
  offset,
  kind,
  tone = 'default',
  as: Tag = 'div',
  testId,
  dataError,
  title,
  icon,
  children,
}: TimelineRowProps) {
  return (
    <Tag
      className="grid grid-cols-[3rem_1px_5.5rem_minmax(0,1fr)] items-stretch gap-x-3"
      data-testid={testId}
      data-error={dataError}
      title={title}
    >
      <span className="text-neutral2/70 text-ui-sm py-2.5 text-right font-mono tabular-nums">{offset ?? ''}</span>

      <span className="bg-border2 relative w-px self-stretch justify-self-center">
        {icon ? (
          <span
            className={cn(
              'bg-surface2 absolute flex size-4 items-center justify-center',
              MARKER_CENTER,
              KIND_TONE[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : (
          <span className={cn('ring-surface2 absolute size-1.5 rounded-full ring-2', MARKER_CENTER, DOT_TONE[tone])} />
        )}
      </span>

      <span className={cn('text-ui-sm truncate py-2.5 font-mono uppercase tracking-wide', KIND_TONE[tone])}>
        {kind ?? ''}
      </span>

      <div className="min-w-0 py-2.5">{children}</div>
    </Tag>
  );
}
