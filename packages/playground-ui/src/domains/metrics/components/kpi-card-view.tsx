import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';

export interface KpiCardViewProps {
  label: string;
  value: string | null;
  prevValue?: string;
  changePct?: number | null;
  isLoading: boolean;
  isError: boolean;
}

function KpiCardStatus({
  hasData,
  prevValue,
  changePct,
  isLoading,
  isError,
}: Pick<KpiCardViewProps, 'prevValue' | 'changePct' | 'isLoading' | 'isError'> & { hasData: boolean }) {
  if (isError) {
    return <MetricsKpiCard.Error />;
  }
  if (isLoading) {
    return <MetricsKpiCard.Loading />;
  }
  if (hasData) {
    if (changePct != null) {
      return <MetricsKpiCard.Change changePct={changePct} prevValue={prevValue} />;
    }
    return <MetricsKpiCard.NoChange />;
  }
  return <MetricsKpiCard.NoData />;
}

export function KpiCardView({ label, value, prevValue, changePct, isLoading, isError }: KpiCardViewProps) {
  const hasData = value != null;
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>{hasData ? value : '—'}</MetricsKpiCard.Value>
      <KpiCardStatus
        hasData={hasData}
        prevValue={prevValue}
        changePct={changePct}
        isLoading={isLoading}
        isError={isError}
      />
    </MetricsKpiCard>
  );
}
