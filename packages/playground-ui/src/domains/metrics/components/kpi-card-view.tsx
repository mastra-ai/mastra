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
  const hasChange = changePct != null && changePct !== 0;
  const ready = hasData && !isLoading && !isError;
  // With a detail line the prior value joins it in the footer; otherwise it sits at the
  // end of the value row, so a lone "vs …" never gets a hairline of its own.
  const prevInRow = ready && hasChange && !detail && prevValue;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label icon={icon}>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.ValueRow>
        {hasData ? <MetricsKpiCard.Value>{value}</MetricsKpiCard.Value> : null}
        {isError ? (
          <MetricsKpiCard.Error />
        ) : isLoading ? (
          <MetricsKpiCard.Loading />
        ) : !hasData ? (
          <MetricsKpiCard.NoData />
        ) : hasChange ? (
          <MetricsKpiCard.Change changePct={changePct} prevValue={prevValue} lowerIsBetter={lowerIsBetter} />
        ) : null}
        {prevInRow ? <MetricsKpiCard.Prev value={prevValue} /> : null}
      </MetricsKpiCard.ValueRow>
      {ready && detail ? <MetricsKpiCard.Footer detail={detail} prevValue={hasChange ? prevValue : undefined} /> : null}
    </MetricsKpiCard>
  );
}
