import type { UISpan } from '../types';
import { cn } from '@/lib/utils';

type SpanDurationColProps = {
  span: UISpan;
  isSelected?: boolean;
  isFaded?: boolean;
};

/** Trailing tree cell showing the span latency as `X.XXX s`. */
export function SpanDurationCol({ span, isSelected, isFaded }: SpanDurationColProps) {
  return (
    <div
      className={cn('flex h-8 items-center justify-end rounded-r-md pr-3 pl-2 text-ui-xs text-neutral3', {
        'opacity-40 [&:hover]:opacity-70 dark:opacity-30 dark:[&:hover]:opacity-60': isFaded,
        'bg-surface4': isSelected,
      })}
    >
      {(span.latency / 1000).toFixed(3)}&nbsp;s
    </div>
  );
}
