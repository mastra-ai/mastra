import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { formatCompactNumber, formatFullNumber } from '@/lib/cost';
import type { CompactNumberFormatOptions } from '@/lib/cost';
import { cn } from '@/lib/utils';

export interface CompactNumberProps extends CompactNumberFormatOptions {
  value: number;
  className?: string;
}

export function CompactNumber({ value, currency, className }: CompactNumberProps) {
  const compact = formatCompactNumber(value, { currency });
  const full = formatFullNumber(value, { currency });

  if (compact === full) return <span className={cn('tabular-nums', className)}>{compact}</span>;

  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={cn('tabular-nums', className)} />}>
        <span aria-hidden="true">{compact}</span>
        <span className="sr-only">{full}</span>
      </TooltipTrigger>
      <TooltipContent side="right">{full}</TooltipContent>
    </Tooltip>
  );
}
