import type { LucideIcon } from 'lucide-react';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { cn } from '@/lib/utils';

export type KpiCardProps = {
  label: string;
  icon: LucideIcon;
  value: string;
  /** Change from the previous period, in percent. Omitted when there is nothing to compare. */
  change?: number;
  lowerIsBetter?: boolean;
  detail: string;
  /** The previous period's value, formatted. Shown only beside a `change`. */
  previous?: string;
  /** Names the window the change compares against, e.g. "vs previous 7d". */
  comparison?: string;
  isLoading?: boolean;
  /** A new range is loading: the previous values stay on screen, dimmed. */
  isUpdating?: boolean;
  /** The data failed to load: a dash and an error note replace the value and the detail. */
  isError?: boolean;
};

/** One headline number, with its change and the previous value. Group them in `MetricsCardGroup`. */
export function KpiCard({ label, icon: Icon, isError = false, ...reading }: KpiCardProps) {
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label icon={<Icon />}>{label}</MetricsKpiCard.Label>
      {isError ? <KpiError /> : <KpiReading {...reading} />}
    </MetricsKpiCard>
  );
}

function KpiError() {
  return (
    <>
      <MetricsKpiCard.ValueRow className="mt-1">
        <MetricsKpiCard.Value>—</MetricsKpiCard.Value>
      </MetricsKpiCard.ValueRow>
      <MetricsKpiCard.Footer detail={<span className="text-destructive-foreground">Couldn't load</span>} />
    </>
  );
}

function KpiReading({
  value,
  change,
  lowerIsBetter,
  detail,
  previous,
  comparison,
  isLoading = false,
  isUpdating = false,
}: Omit<KpiCardProps, 'label' | 'icon' | 'isError'>) {
  const fade = cn('transition-opacity duration-200', isUpdating && 'opacity-50');
  return (
    <>
      <MetricsKpiCard.ValueRow className={cn('mt-1', fade)} isLoading={isLoading}>
        <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value>
        {change !== undefined && (
          <MetricsKpiCard.Change
            changePct={change}
            comparison={comparison}
            lowerIsBetter={lowerIsBetter}
            prevValue={previous}
          />
        )}
      </MetricsKpiCard.ValueRow>
      <MetricsKpiCard.Footer
        detail={detail}
        // Without a change there is nothing to compare: a lone "vs 0" would read as data.
        prevValue={change === undefined ? undefined : previous}
        isLoading={isLoading}
        className={fade}
      />
    </>
  );
}
