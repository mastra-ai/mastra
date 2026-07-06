import { MetricsKpiCard } from '../../../ds/components/MetricsKpiCard';

export interface KpiCardViewProps {
  label: string;
  value: string | null;
  prevValue?: string;
  changePct?: number | null;
  isLoading: boolean;
  isError: boolean;
}

type KpiCardStatusState =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { kind: 'change'; changePct: number; prevValue: string | undefined }
  | { kind: 'no-change' }
  | { kind: 'no-data' };

type KpiCardStatusInput = Pick<KpiCardViewProps, 'value' | 'prevValue' | 'changePct' | 'isLoading' | 'isError'>;

function getKpiCardStatusState({
  value,
  prevValue,
  changePct,
  isLoading,
  isError,
}: KpiCardStatusInput): KpiCardStatusState {
  if (isError) {
    return { kind: 'error' };
  }
  if (isLoading) {
    return { kind: 'loading' };
  }
  if (value != null) {
    if (changePct != null) {
      return { kind: 'change', changePct, prevValue };
    }
    return { kind: 'no-change' };
  }
  return { kind: 'no-data' };
}

function KpiCardStatus({ state }: { state: KpiCardStatusState }) {
  switch (state.kind) {
    case 'error':
      return <MetricsKpiCard.Error />;
    case 'loading':
      return <MetricsKpiCard.Loading />;
    case 'change':
      return <MetricsKpiCard.Change changePct={state.changePct} prevValue={state.prevValue} />;
    case 'no-change':
      return <MetricsKpiCard.NoChange />;
    case 'no-data':
      return <MetricsKpiCard.NoData />;
  }
}

export function KpiCardView({ label, value, prevValue, changePct, isLoading, isError }: KpiCardViewProps) {
  const hasData = value != null;
  const status = getKpiCardStatusState({ value, prevValue, changePct, isLoading, isError });

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>{label}</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>{hasData ? value : '—'}</MetricsKpiCard.Value>
      <KpiCardStatus state={status} />
    </MetricsKpiCard>
  );
}
