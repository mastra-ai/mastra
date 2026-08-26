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
  children: ReactNode;
};

const DOT_TONE: Record<NonNullable<TimelineRowProps['tone']>, string> = {
  default: 'bg-neutral3',
  accent: 'bg-accent1',
  muted: 'border-neutral3 border bg-transparent',
  error: 'bg-accent2',
};

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
  children,
}: TimelineRowProps) {
  return (
    <Tag
      className="grid grid-cols-[3rem_1px_5.5rem_minmax(0,1fr)] items-stretch gap-x-3"
      data-testid={testId}
      data-error={dataError}
      title={title}
    >
      <span className="text-neutral2/70 text-ui-xs py-1.5 text-right font-mono tabular-nums">{offset ?? ''}</span>

      <span className="bg-border2 relative w-px self-stretch justify-self-center">
        <span
          className={cn(
            'ring-surface2 absolute left-1/2 top-[0.6rem] size-1.5 -translate-x-1/2 rounded-full ring-2',
            DOT_TONE[tone],
          )}
        />
      </span>

      <span className={cn('text-ui-xs truncate py-1.5 font-mono uppercase tracking-wide', KIND_TONE[tone])}>
        {kind ?? ''}
      </span>

      <div className="min-w-0 py-1.5">{children}</div>
    </Tag>
  );
}
