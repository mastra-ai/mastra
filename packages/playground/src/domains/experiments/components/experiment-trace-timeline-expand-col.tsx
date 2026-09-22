import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDownIcon, ChevronsDownIcon, ChevronsUpIcon, ChevronUpIcon } from 'lucide-react';

type ExperimentTraceTimelineExpandColProps = {
  isSelected?: boolean;
  isFaded?: boolean;
  isExpanded?: boolean;
  toggleChildren?: () => void;
  expandAllDescendants?: () => void;
  totalDescendants?: number;
  allDescendantsExpanded?: boolean;
  numOfChildren?: number;
};

export function ExperimentTraceTimelineExpandCol({
  isSelected,
  isFaded,
  isExpanded,
  toggleChildren,
  expandAllDescendants,
  totalDescendants = 0,
  allDescendantsExpanded,
  numOfChildren,
}: ExperimentTraceTimelineExpandColProps) {
  return (
    <div
      className={cn('flex h-full items-center justify-end px-3', {
        'opacity-30 [&:hover]:opacity-60': isFaded,
        'bg-fill-hover': isSelected,
      })}
    >
      {numOfChildren && numOfChildren > 0 ? (
        <div className="flex gap-1">
          <ExpandButton onClick={() => toggleChildren?.()}>
            {allDescendantsExpanded ? totalDescendants : numOfChildren}{' '}
            {isExpanded ? allDescendantsExpanded ? <ChevronsUpIcon /> : <ChevronUpIcon /> : <ChevronDownIcon />}
          </ExpandButton>

          {totalDescendants > (numOfChildren ?? 0) && !allDescendantsExpanded && (
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
          'flex items-center gap-[0.1rem] rounded-lg border border-border pr-1 pl-2 text-caption text-foreground',
          controlStateColorTransition,
          'hover:text-yellow-500',
          '[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:opacity-80 [&>svg]:transition-all',
        )}
      >
        {children}
      </div>
    </button>
  );
}
