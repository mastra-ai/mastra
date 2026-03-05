import { Code2, Database } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export interface AgentSourceIconProps {
  source?: 'code' | 'stored';
  className?: string;
  /** Additional className for TooltipContent, useful for z-index adjustments in dropdowns */
  tooltipClassName?: string;
}

export const AgentSourceIcon = ({ source, className, tooltipClassName }: AgentSourceIconProps) => {
  const isStored = source === 'stored';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {isStored ? (
          <Database className={cn('h-3.5 w-3.5 shrink-0 text-accent6', className)} />
        ) : (
          <Code2 className={cn('h-3.5 w-3.5 shrink-0 text-accent3', className)} />
        )}
      </TooltipTrigger>
      <TooltipContent className={tooltipClassName}>
        {isStored ? 'Stored in database - can be edited in UI' : 'Defined in code - read-only in UI'}
      </TooltipContent>
    </Tooltip>
  );
};
