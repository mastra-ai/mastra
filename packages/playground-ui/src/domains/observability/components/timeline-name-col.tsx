import { cn } from '@/lib/utils';
import { type UISpan } from '../types';
import { TimelineStructureSign } from './timeline-structure-sign';
import { FileIcon } from 'lucide-react';
import { SpanTypeIcon } from './span-type-icon';

type TimelineNameColProps = {
  span: UISpan;
  spanUI?: {
    icon: React.ReactNode;
    color: string;
    label: string;
    bgColor?: string;
    typePrefix: string;
  } | null;
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
      className={cn(
        'rounded-md transition-colors flex opacity-80 min-h-[3rem] items-center rounded-l-lg',
        'mt-[1rem] xl:mt-0',
        {
          'opacity-30 [&:hover]:opacity-60': isFaded,
          'bg-surface4': selectedSpanId === span.id,
        },
      )}
      style={{ paddingLeft: `${depth * 1.5}rem` }}
    >
      {!isRootSpan && (
        <button
          onClick={() => toggleChildren?.()}
          disabled={!hasChildren}
          className={cn({
            'cursor-default': !hasChildren,
            'cursor0-pointer': hasChildren,
          })}
        >
          <TimelineStructureSign isLastChild={isLastChild} hasChildren={Boolean(hasChildren)} expanded={isExpanded} />
        </button>
      )}

      <button
        onClick={() => onSpanClick?.(span.id)}
        className={cn(
          'text-[0.875rem] flex items-center text-left break-all gap-[0.5rem] text-white w-full rounded-lg  h-full px-3 py-2 transition-colors',
          '[&>svg]:transition-all [&>svg]:shrink-0 [&>svg]:opacity-0 [&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:ml-auto',
          'hover:bg-surface4 [&:hover>svg]:opacity-60',
        )}
      >
        {spanUI?.icon && <SpanTypeIcon icon={spanUI.icon} color={spanUI.color} />}
        <span className={cn('p-0 px-1 rounded-md')}>{span.name}</span>
        <FileIcon />
      </button>
    </div>
  );
}
