import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { cn } from '@/lib/utils';

export type KpiCardProps = {
  label: string;
  icon: LucideIcon;
  value: string;
  change?: number;
  lowerIsBetter?: boolean;
  detail: ReactNode;
  previous?: string;
  comparison?: string;
  isLoading?: boolean;
  isUpdating?: boolean;
  isError?: boolean;
};

export function KpiCard({ label, icon: Icon, isError = false, ...reading }: KpiCardProps) {
  return (
    <MetricsKpiCard busy={!isError && (reading.isLoading || reading.isUpdating)}>
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
        prevValue={change === undefined ? undefined : previous}
        isLoading={isLoading}
        className={fade}
      />
    </>
  );
}
