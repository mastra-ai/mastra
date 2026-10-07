import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// Past +1000% a percentage is unreadable, so show how many times bigger the value got instead.
function formatChange(changePct: number) {
  if (changePct >= 1000) return `×${compact.format(1 + changePct / 100)}`;
  const digits = Math.abs(changePct) < 10 ? 1 : 0;
  return `${changePct > 0 ? '+' : ''}${changePct.toFixed(digits)}%`;
}

export function MetricsKpiCardChange({
  changePct,
  comparison,
  prevValue,
  lowerIsBetter,
  className,
}: {
  changePct: number;
  comparison: string;
  prevValue?: string;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const isGood = lowerIsBetter ? changePct < 0 : changePct >= 0;
  const Icon = changePct >= 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const formattedChange = formatChange(changePct);
  const description = prevValue ? `${comparison} (${prevValue})` : comparison;

  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={cn('inline-flex rounded-full', className)} />}>
        <Badge
          variant={isGood ? 'success' : 'destructive'}
          emphasis="subtle"
          size="xs"
          icon={<Icon />}
          className="tabular-nums"
          aria-hidden="true"
        >
          {formattedChange}
        </Badge>
        <span className="sr-only">{`${formattedChange} ${description}`}</span>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}
