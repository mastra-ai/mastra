import {
  ChevronDownIcon,
  ChevronsDownIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  ChevronsUpIcon,
  ChevronUpIcon,
  FoldVerticalIcon,
  UnfoldVerticalIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

type TimelineExpandColProps = {
  isSelected?: boolean;
  isFaded?: boolean;
  isExpanded?: boolean;
  isRootSpan?: boolean;
  toggleChildren?: () => void;
  expandAllDescendants?: () => void;
  collapseAllDescendants?: () => void;
  collapseAll?: () => void;
  totalDescendants?: number;
  allDescendantsExpanded?: boolean;
  numOfChildren?: number;
  toggleSiblings?: () => void;
  siblingsAllExpanded?: boolean;
  siblingsWithChildrenCount?: number;
};

export function TimelineExpandCol({
  isSelected,
  isFaded,
  isExpanded,
  isRootSpan,
  toggleChildren,
  expandAllDescendants,
  collapseAllDescendants,
  collapseAll,
  totalDescendants = 0,
  allDescendantsExpanded,
  numOfChildren = 0,
  toggleSiblings,
  siblingsAllExpanded,
  siblingsWithChildrenCount = 0,
}: TimelineExpandColProps) {
  const toggleTooltip = isExpanded ? `Collapse children (${numOfChildren})` : `Expand children (${numOfChildren})`;

  const showToggleChildren = !isRootSpan && !!numOfChildren && numOfChildren > 0;
  const showDescendantsButton = !isRootSpan && showToggleChildren && totalDescendants > numOfChildren;
  const showToggleSiblings = !isRootSpan && siblingsWithChildrenCount >= 2;
  const showRootToggleAll = !!isRootSpan && !!numOfChildren && numOfChildren > 0;
  const fullyExpanded = !!isExpanded && !!allDescendantsExpanded;

  return (
    <div
      className={cn('flex items-center justify-end h-full px-1.5', {
        'opacity-30 [&:hover]:opacity-60': isFaded,
        'bg-surface4': isSelected,
      })}
    >
      <div className="grid grid-cols-[1.625rem_1.625rem_1.625rem] gap-1">
        <div>
          {showToggleChildren && (
            <ExpandButton onClick={() => toggleChildren?.()} tooltip={toggleTooltip}>
              {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </ExpandButton>
          )}
        </div>

        <div>
          {showDescendantsButton && (
            <ExpandButton
              onClick={() => (allDescendantsExpanded ? collapseAllDescendants?.() : expandAllDescendants?.())}
              tooltip={
                allDescendantsExpanded
                  ? `Collapse all descendants (${totalDescendants})`
                  : `Expand all descendants (${totalDescendants})`
              }
            >
              {allDescendantsExpanded ? <ChevronsUpIcon /> : <ChevronsDownIcon />}
            </ExpandButton>
          )}
        </div>

        <div>
          {showToggleSiblings && (
            <ExpandButton
              onClick={() => toggleSiblings?.()}
              tooltip={siblingsAllExpanded ? 'Collapse at this level' : 'Expand at this level'}
            >
              {siblingsAllExpanded ? <FoldVerticalIcon /> : <UnfoldVerticalIcon />}
            </ExpandButton>
          )}

          {showRootToggleAll && (
            <ExpandButton
              onClick={() => (fullyExpanded ? collapseAll?.() : expandAllDescendants?.())}
              tooltip={fullyExpanded ? 'Collapse all' : 'Expand all'}
            >
              {fullyExpanded ? <ChevronsDownUpIcon /> : <ChevronsUpDownIcon />}
            </ExpandButton>
          )}
        </div>
      </div>
    </div>
  );
}

type ExpandButtonProps = {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  tooltip?: string;
};

function ExpandButton({ onClick, children, className, tooltip }: ExpandButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onClick} className={cn('h-full shrink-0 cursor-pointer', className)} aria-label={tooltip}>
          <div
            className={cn(
              'flex items-center gap-[0.1rem] rounded-md transition-all p-1',
              'hover:bg-surface5',
              '[&>svg]:shrink-0 [&>svg]:opacity-50 [&:hover>svg]:opacity-100 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:transition-all',
            )}
          >
            {children}
          </div>
        </button>
      </TooltipTrigger>
      {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
    </Tooltip>
  );
}
