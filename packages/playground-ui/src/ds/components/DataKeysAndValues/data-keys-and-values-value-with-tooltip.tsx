import { cn } from '../../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { dataKeysAndValuesValueStyles } from './shared';

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
          <div tabIndex={0} className="inline cursor-help truncate">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </dd>
  );
}
