import { cn } from '@/lib/utils';
import { ChevronDownIcon, ChevronsDownIcon, ChevronsUpIcon, ChevronUpIcon } from 'lucide-react';

type TimelineExpandColProps = {
  isSelected?: boolean;
  isFaded?: boolean;
  isExpanded?: boolean;
  toggleChildren?: () => void;
  expandAllDescendants?: () => void;
  expandedSpanIds?: string[];
  totalDescendants?: number;
  allDescendantsExpanded?: boolean;
  numOfChildren?: number;
};

export function TimelineExpandCol({
  isSelected,
  isFaded,
  isExpanded,
  toggleChildren,
  expandAllDescendants,
  totalDescendants = 0,
  allDescendantsExpanded,
  numOfChildren,
}: TimelineExpandColProps) {
  return (
    <div
      className={cn('flex items-center justify-end h-full px-3', {
        'opacity-30 [&:hover]:opacity-60': isFaded,
        'bg-surface4': isSelected,
      })}
    >
      {numOfChildren && numOfChildren > 0 ? (
        <div className="flex  gap-1">
          <ExpandButton onClick={() => toggleChildren?.()}>
            {allDescendantsExpanded ? totalDescendants : numOfChildren}{' '}
            {isExpanded ? allDescendantsExpanded ? <ChevronsUpIcon /> : <ChevronUpIcon /> : <ChevronDownIcon />}
          </ExpandButton>

          {totalDescendants > numOfChildren && !allDescendantsExpanded && (
            <ExpandButton onClick={() => expandAllDescendants?.()}>
              {totalDescendants} <ChevronsDownIcon />
            </ExpandButton>
          )}
        </div>
      ) : null}
    </div>
  );
}

type ExpandButtonProps = {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
};

function ExpandButton({ onClick, children, className }: ExpandButtonProps) {
  return (
    <button onClick={onClick} className={cn('h-full', className)}>
      <div
        className={cn(
          'flex items-center gap-[0.1rem] text-[0.75rem] text-icon5 border border-border1 pl-2 pr-1 rounded-lg transition-all',
          'hover:text-yellow-500',
          '[&>svg]:shrink-0 [&>svg]:opacity-80 [&>svg]:w-[1rem] [&>svg]:h-[1rem] [&>svg]:transition-all',
        )}
      >
        {children}
      </div>
    </button>
  );
}
