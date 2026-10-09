import { MetricsCard } from '@/ds/components/MetricsCard';

/** Fills a chart card's body when its data failed to load. */
export function ChartCardError() {
  return <MetricsCard.Error message="Couldn't load this data. Try again in a moment." className="h-full" />;
}
