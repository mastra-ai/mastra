import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
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
  caption = false,
  className,
}: {
  changePct: number;
  prevValue?: string;
  lowerIsBetter?: boolean;
  /** Show the inline "vs prior period" text. Off by default: pair the badge with
   *  `MetricsKpiCard.Footer`, which shows the prior value itself. */
  caption?: boolean;
  className?: string;
}) {
  const isGood = lowerIsBetter ? changePct < 0 : changePct >= 0;
  const Icon = changePct >= 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const formattedChange = formatChange(changePct);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge
        variant={isGood ? 'success' : 'destructive'}
        emphasis="subtle"
        size="xs"
        icon={<Icon />}
        className="tabular-nums"
      >
        {formattedChange}
      </Badge>
      {caption ? (
        <Txt as="span" variant="meta" tone="faint">
          vs prior period
          {prevValue ? <span className="sr-only">, previous value {prevValue}</span> : null}
        </Txt>
      ) : (
        <span className="sr-only">vs prior period{prevValue ? `, previous value ${prevValue}` : ''}</span>
      )}
    </div>
  );
}
