import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { previousPeriodLabels } from '../overview-period';
import type { OverviewRange } from '../overview-period';
import { cn } from '@/lib/utils';

export interface PeriodTotal {
  label: string;
  value: string;
  changePercent?: number | null;
  previousValue?: string;
  lowerIsBetter?: boolean;
  alert?: boolean;
}

export function PeriodTotals({ totals, range }: { totals: PeriodTotal[]; range: OverviewRange }) {
  return (
    <dl aria-label="Period totals" className="grid grid-cols-2 gap-x-6 gap-y-4 @min-[40rem]:grid-cols-5">
      {totals.map(total => (
        <div key={total.label} className="flex min-w-0 flex-col gap-1">
          <dt>
            <Txt as="span" variant="meta" tone="muted">
              {total.label}
            </Txt>
          </dt>
          <dd className="flex flex-wrap items-center gap-2">
            <Txt
              as="span"
              variant="heading"
              className={cn('tabular-nums', total.alert && 'text-destructive-foreground')}
            >
              {total.value}
            </Txt>
            {total.changePercent != null && Number.isFinite(total.changePercent) && (
              <MetricsKpiCard.Change
                changePct={total.changePercent}
                comparison={`vs ${previousPeriodLabels[range]}`}
                prevValue={total.previousValue}
                lowerIsBetter={total.lowerIsBetter}
              />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
