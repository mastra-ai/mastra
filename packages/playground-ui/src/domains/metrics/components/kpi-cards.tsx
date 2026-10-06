import type { LucideIcon } from 'lucide-react';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { cn } from '@/lib/utils';

export type Kpi = {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  /** Change from the previous period, in percent. Omitted when there is nothing to compare. */
  change?: number;
  lowerIsBetter?: boolean;
  detail: string;
  /** The previous period's value, formatted. Shown only beside a `change`. */
  previous?: string;
};

export type KpiCardsProps = {
  kpis: Kpi[];
  isLoading?: boolean;
  /** A new range is loading: the previous values stay on screen, dimmed. */
  isUpdating?: boolean;
  /** Names the window each change compares against, e.g. "vs previous 7d". */
  comparison?: string;
};

/** The page's headline numbers: one card per KPI, with its change and the previous value. */
export function KpiCards({ kpis, isLoading = false, isUpdating = false, comparison }: KpiCardsProps) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  return (
    <MetricsCardGroup>
      {kpis.map(kpi => (
        <MetricsKpiCard key={kpi.id}>
          <MetricsKpiCard.Label icon={<kpi.icon />}>{kpi.label}</MetricsKpiCard.Label>
          <MetricsKpiCard.ValueRow className={cn('mt-1', fade)} isLoading={isLoading}>
            <MetricsKpiCard.Value>{kpi.value}</MetricsKpiCard.Value>
            {kpi.change !== undefined && (
              <MetricsKpiCard.Change
                changePct={kpi.change}
                comparison={comparison}
                lowerIsBetter={kpi.lowerIsBetter}
                prevValue={kpi.previous}
              />
            )}
          </MetricsKpiCard.ValueRow>
          <MetricsKpiCard.Footer
            detail={kpi.detail}
            // Without a change there is nothing to compare: a lone "vs 0" would read as data.
            prevValue={kpi.change === undefined ? undefined : kpi.previous}
            isLoading={isLoading}
            className={fade}
          />
        </MetricsKpiCard>
      ))}
    </MetricsCardGroup>
  );
}
