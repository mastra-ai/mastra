import { MetricsKpiCard } from '../../../../ds/components/MetricsKpiCard';

export function KpiCardSkeleton({ label }: { label: string }) {
  return (
    <span role="status" aria-label={`Loading ${label}`} className="flex h-6 items-center">
      <MetricsKpiCard.Loading />
    </span>
  );
}
