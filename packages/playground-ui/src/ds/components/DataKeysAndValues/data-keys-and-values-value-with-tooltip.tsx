import { dataKeysAndValuesValueStyles } from './shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueWithTooltipProps {
  className?: string;
  children: React.ReactNode;
  tooltip: string;
}

export function DataKeysAndValuesValueWithTooltip({
  className,
  children,
  tooltip,
}: DataKeysAndValuesValueWithTooltipProps) {
  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} className="truncate cursor-help hover:text-neutral4 inline">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </dd>
  );
}
