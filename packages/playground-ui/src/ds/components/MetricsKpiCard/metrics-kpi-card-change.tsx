import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { cn } from '@/lib/utils';

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
  const formattedChangePct = Math.abs(changePct) < 10 ? changePct.toFixed(1) : changePct.toFixed(0);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge variant={isGood ? 'green' : 'red'} emphasis="muted" size="xs" icon={<Icon />} className="tabular-nums">
        {changePct > 0 ? '+' : ''}
        {formattedChangePct}%
      </Badge>
      <span className="text-meta text-placeholder">
        vs prior period
        {prevValue ? <span className="sr-only">, previous value {prevValue}</span> : null}
      </span>
    </div>
  );
}
