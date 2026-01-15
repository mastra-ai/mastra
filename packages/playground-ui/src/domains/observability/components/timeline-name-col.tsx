import { cn } from '@/lib/utils';
import { type UISpan, type UISpanStyle } from '../types';
import { TimelineStructureSign } from './timeline-structure-sign';
import { FileIcon } from 'lucide-react';
import { SpanTypeIcon } from './span-type-icon';

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
  toggleChildren?: () => void;
};

export function TimelineNameCol({
  span,
  spanUI,
  isFaded,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  isLastChild,
  hasChildren,
  isRootSpan,
  isExpanded,
  toggleChildren,
}: TimelineNameColProps) {
  return (
    <div
      aria-label={`View details for span ${span.name}`}
      className={cn('rounded-md transition-colors flex opacity-80 min-h-12 items-center rounded-l-lg', 'mt-4 xl:mt-0', {
        'opacity-30 [&:hover]:opacity-60': isFaded,
        'bg-surface4': selectedSpanId === span.id,
      })}
      style={{ paddingLeft: `${depth * 1.5}rem` }}
    >
      {!isRootSpan && (
        <button
          onClick={() => toggleChildren?.()}
          disabled={!hasChildren}
          className={cn({
            'cursor-default': !hasChildren,
            'cursor-pointer': hasChildren,
          })}
        >
          <TimelineStructureSign isLastChild={isLastChild} hasChildren={Boolean(hasChildren)} expanded={isExpanded} />
        </button>
      )}

      <button
        onClick={() => onSpanClick?.(span.id)}
        className={cn(
          'text-ui-md flex items-center text-left break-all gap-2 text-white w-full rounded-lg  h-full px-3 py-2 transition-colors',
          '[&>svg]:transition-all [&>svg]:shrink-0 [&>svg]:opacity-0 [&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:ml-auto',
          'hover:bg-surface4 [&:hover>svg]:opacity-60',
        )}
      >
        {spanUI?.icon && <SpanTypeIcon icon={spanUI.icon} color={spanUI.color ? spanUI.color : undefined} />}
        <span className={cn('p-0 px-1 rounded-md')}>{span.name}</span>
        <FileIcon />
      </button>
    </div>
  );
}
