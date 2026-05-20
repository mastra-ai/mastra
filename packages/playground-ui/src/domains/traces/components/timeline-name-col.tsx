import type { UISpan, UISpanStyle } from '../types';
import { TimelineStructureSign } from './timeline-structure-sign';
import { cn } from '@/lib/utils';

type TimelineNameColProps = {
  span: UISpan;
  spanUI?: UISpanStyle | null;
  isFaded?: boolean;
  depth?: number;
  onSpanClick?: (id: string) => void;
  selectedSpanId?: string;
  isLastChild?: boolean;
  hasChildren?: boolean;
  isRootSpan?: boolean;
  isExpanded?: boolean;
};

export function TimelineNameCol({
  span,
  spanUI,
  isFaded,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  isLastChild,
  hasChildren: _hasChildren,
  isRootSpan,
  isExpanded: _isExpanded,
}: TimelineNameColProps) {
  return (
    <div
      data-span-id={span.id}
      aria-label={`View details for span ${span.name}`}
      className={cn('rounded-md flex opacity-80 min-h-8 items-center rounded-l-lg', {
        'opacity-30 [&:hover]:opacity-60': isFaded,
        'bg-surface4': selectedSpanId === span.id,
      })}
      style={{ paddingLeft: `${depth * 1}rem` }}
    >
      {!isRootSpan && <TimelineStructureSign isLastChild={isLastChild} />}

      <button
        onClick={() => onSpanClick?.(span.id)}
        className={cn(
          'text-ui-smd flex items-center text-left gap-1.5 text-neutral6 w-full min-w-0 rounded-md h-full px-2 py-1 transition-colors',
          '[&>svg]:transition-all [&>svg]:shrink-0 [&>svg]:opacity-0 [&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:ml-auto',
          'hover:bg-surface4 [&:hover>svg]:opacity-60',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1',
        )}
      >
        {spanUI?.color && (
          <span
            aria-hidden
            title={spanUI.label}
            className="inline-block w-2 h-2 shrink-0 rounded-full"
            style={{ backgroundColor: spanUI.color }}
          />
        )}
        <span className="min-w-0 truncate">{span.name}</span>
      </button>
    </div>
  );
}
