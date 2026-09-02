import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
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

  return (
    <div className={cn('flex flex-wrap items-center gap-1 text-sm text-gray-6', className)}>
      <div className="flex items-center gap-1">
        <span className={cn('[&>svg]:size-4', isGood ? 'text-green-9' : 'text-red-9')}>
          {changePct >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
        </span>
        <span
          className={cn(isGood ? 'text-green-9' : 'text-red-9')}
        >{`${changePct >= 0 ? '+' : '-'}${Math.abs(changePct).toFixed(1)}%`}</span>
      </div>
      {prevValue && (
        <div>
          vs previous <b className="text-gray-9 font-semibold">{prevValue}</b>
        </div>
      )}
    </div>
  );
}
