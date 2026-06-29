import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';

export interface KpiCardViewProps {
  label: string;
  value: string | null;
  prevValue?: string;
  changePct?: number | null;
  isLoading: boolean;
  isError: boolean;
}

export function KpiCardView({ label, value, prevValue, changePct, isLoading, isError }: KpiCardViewProps) {
  const hasData = value != null;
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>{hasData ? value : '—'}</MetricsKpiCard.Value>
      {isError ? (
        <MetricsKpiCard.Error />
      ) : isLoading ? (
        <MetricsKpiCard.Loading />
      ) : hasData ? (
        changePct != null ? (
          <MetricsKpiCard.Change changePct={changePct} prevValue={prevValue} />
        ) : (
          <MetricsKpiCard.NoChange />
        )
      ) : (
        <MetricsKpiCard.NoData />
      )}
    </MetricsKpiCard>
  );
}
