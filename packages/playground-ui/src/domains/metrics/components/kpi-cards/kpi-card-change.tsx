import { MetricsKpiCard } from '../../../../ds/components/MetricsKpiCard';
import { useMetrics } from '../../hooks/use-metrics';

export interface KpiCardChangeProps {
  changePct: number;
  prevValue?: string;
  lowerIsBetter?: boolean;
}

export function KpiCardChange({ changePct, prevValue, lowerIsBetter }: KpiCardChangeProps) {
  const { comparisonLabel } = useMetrics();
  return (
    <MetricsKpiCard.Change
      changePct={changePct}
      comparison={comparisonLabel}
      prevValue={prevValue}
      lowerIsBetter={lowerIsBetter}
    />
  );
}

/** A delta is only worth showing when it exists and is non-zero. */
