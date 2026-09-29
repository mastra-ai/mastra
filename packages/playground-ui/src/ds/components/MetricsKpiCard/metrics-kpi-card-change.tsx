import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
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
  prevValue,
  lowerIsBetter,
  className,
}: {
  changePct: number;
  prevValue?: string;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const isGood = lowerIsBetter ? changePct < 0 : changePct >= 0;
  const Icon = changePct >= 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const formattedChange = formatChange(changePct);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge variant={isGood ? 'green' : 'red'} emphasis="muted" size="xs" icon={<Icon />} className="tabular-nums">
        {formattedChange}
      </Badge>
      <span className="text-meta text-placeholder">
        vs prior period
        {prevValue ? <span className="sr-only">, previous value {prevValue}</span> : null}
      </span>
    </div>
  );
}
