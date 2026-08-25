import { dataKeysAndValuesValueStyles } from './shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueWithTooltipProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  tooltip: string;
}

export function DataKeysAndValuesValueWithTooltip({
  className,
  style,
  children,
  tooltip,
}: DataKeysAndValuesValueWithTooltipProps) {
  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)} style={style}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} className="hover:text-neutral4 inline cursor-help truncate">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </dd>
  );
}
