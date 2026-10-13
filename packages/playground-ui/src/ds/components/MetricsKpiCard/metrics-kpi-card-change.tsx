import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// A change that rounds to 0.0% is no change: a neutral badge, no arrow.
const isFlat = (changePct: number) => Math.abs(changePct) < 0.05;

// Green when the value moved the good way, red when it moved the bad way.
function changeVariant(changePct: number, lowerIsBetter?: boolean) {
  if (isFlat(changePct)) return 'neutral';
  const isGood = lowerIsBetter ? changePct < 0 : changePct >= 0;
  return isGood ? 'success' : 'destructive';
}

// Past +1000% a percentage is unreadable, so show how many times bigger the value got instead.
function formatChange(changePct: number) {
  if (isFlat(changePct)) return '0%';
  if (changePct >= 1000) return `×${compact.format(1 + changePct / 100)}`;
  const digits = Math.abs(changePct) < 10 ? 1 : 0;
  return `${changePct > 0 ? '+' : ''}${changePct.toFixed(digits)}%`;
}

export function MetricsKpiCardChange({
  changePct,
  comparison = 'vs prior period',
  prevValue,
  lowerIsBetter,
  caption = false,
  className,
}: {
  changePct: number;
  /** Names the window the change compares against, e.g. "vs previous 7d". Shown on hover. */
  comparison?: string;
  prevValue?: string;
  lowerIsBetter?: boolean;
  /** Show the comparison as inline text. Off by default: pair the badge with
   *  `MetricsKpiCard.Footer`, which shows the prior value itself. */
  caption?: boolean;
  className?: string;
}) {
  const flat = isFlat(changePct);
  const Icon = changePct >= 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  const formattedChange = formatChange(changePct);
  const description = prevValue ? `${comparison} (${prevValue})` : comparison;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Tooltip>
        <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-full" />}>
          <Badge
            variant={changeVariant(changePct, lowerIsBetter)}
            emphasis="strong"
            size="xs"
            icon={flat ? undefined : <Icon />}
            className="tabular-nums"
            aria-hidden="true"
          >
            {formattedChange}
          </Badge>
          <span className="sr-only">{`${formattedChange} ${description}`}</span>
        </TooltipTrigger>
        <TooltipContent>{description}</TooltipContent>
      </Tooltip>
      {caption ? (
        <Txt as="span" variant="meta" tone="faint" aria-hidden="true">
          {comparison}
        </Txt>
      ) : null}
    </div>
  );
}
