import type { ReactNode } from 'react';
import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';

export interface KpiCardViewProps {
  label: string;
  value: ReactNode;
  prevValue?: string;
  changePct?: number | null;
  isLoading: boolean;
  isError: boolean;
  /** Treat a decrease as a good change (e.g. cost, latency). */
  lowerIsBetter?: boolean;
  /** Glyph at the end of the label row. */
  icon?: ReactNode;
  /** One line of context in the footer, beside the prior value. */
  detail?: ReactNode;
}

export function KpiCardView({
  label,
  value,
  prevValue,
  changePct,
  isLoading,
  isError,
  lowerIsBetter,
  icon,
  detail,
}: KpiCardViewProps) {
  const hasData = value != null;
  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label icon={icon}>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.ValueRow>
        {hasData ? <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value> : null}
        {isError ? (
          <MetricsKpiCard.Error />
        ) : isLoading ? (
          <MetricsKpiCard.Loading />
        ) : hasData ? (
          changePct != null && changePct !== 0 ? (
            <MetricsKpiCard.Change changePct={changePct} prevValue={prevValue} lowerIsBetter={lowerIsBetter} />
          ) : (
            <MetricsKpiCard.NoChange />
          )
        ) : (
          <MetricsKpiCard.NoData />
        )}
      </MetricsKpiCard.ValueRow>
      {hasData && !isLoading && !isError && (
        <MetricsKpiCard.Footer
          detail={detail}
          prevValue={changePct != null && changePct !== 0 ? prevValue : undefined}
        />
      )}
    </MetricsKpiCard>
  );
}
