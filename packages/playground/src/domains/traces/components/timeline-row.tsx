import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export type TimelineRowProps = {
  /** Wall clock of the step, e.g. `20:41:02`. Blank when unknown. */
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
  /** Interactive marker rendered on the rail in place of the dot/icon, e.g. a link to the trace. */
  marker?: ReactNode;
  /** Trailing control aligned to the right of the row, e.g. the comment bubble. */
  action?: ReactNode;
  children?: ReactNode;
};

const DOT_TONE: Record<NonNullable<TimelineRowProps['tone']>, string> = {
  default: 'bg-neutral3',
  accent: 'bg-accent1',
  muted: 'border-neutral3 border bg-transparent',
  error: 'bg-accent2',
};

/**
 * Sits the marker on the middle of the row's first line rather than at a fixed distance from the
 * top: `py-4` (1rem) plus half a `text-ui-xs` line (0.625rem x 160% / 2), which is the kind
 * label now leading the content. Dot and icon share it so they land on the same baseline.
 */
const MARKER_CENTER = 'left-1/2 top-[calc(1rem+0.5rem)] -translate-x-1/2 -translate-y-1/2';

/**
 * The rail is drawn per row as two segments meeting at the marker, rather than one line behind the
 * whole list: the first row then has nothing above its marker and the last nothing below, so the
 * line starts and ends on a step instead of overshooting into the padding. Rows sit flush against
 * each other — their breathing room is their own `py-4` — which is what keeps the segments joined.
 */
const RAIL_SEGMENT = 'border-border2 absolute left-0 w-px border-l border-dashed';

const KIND_TONE: Record<NonNullable<TimelineRowProps['tone']>, string> = {
  default: 'text-neutral3',
  accent: 'text-accent1',
  muted: 'text-neutral3',
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
  marker,
  action,
  children,
}: TimelineRowProps) {
  return (
    <Tag
      className="group/timeline-row grid grid-cols-[4.5rem_1px_minmax(0,1fr)_auto] items-stretch gap-x-3"
      data-testid={testId}
      data-error={dataError}
      title={title}
    >
      <span className="text-neutral3 text-ui-sm py-4 text-right font-mono tabular-nums">{offset ?? ''}</span>

      <span className="relative w-px self-stretch justify-self-center">
        <span className={cn(RAIL_SEGMENT, 'top-0 h-[calc(1rem+0.5rem)] [:first-child>*>&]:hidden')} aria-hidden />
        <span className={cn(RAIL_SEGMENT, 'top-[calc(1rem+0.5rem)] bottom-0 [:last-child>*>&]:hidden')} aria-hidden />
        {marker ? (
          <span className={cn('bg-surface2 absolute z-10 flex items-center justify-center', MARKER_CENTER)}>
            {marker}
          </span>
        ) : icon ? (
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

      {/* The category labels the content instead of sitting in a column of its own: a caption over
          the chat entry, quiet enough to be skipped when reading the conversation straight down. */}
      <div className="min-w-0 py-4">
        {kind ? <p className="text-neutral3 text-ui-xs mb-0.5 font-mono tracking-wide uppercase">{kind}</p> : null}
        {children}
      </div>

      <div className="flex items-start justify-end py-3">{action}</div>
    </Tag>
  );
}
