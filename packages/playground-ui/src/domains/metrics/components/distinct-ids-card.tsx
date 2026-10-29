import type { DrilldownScope } from '../drilldown';
import { DISTINCT_IDS_DESCRIPTION, DISTINCT_IDS_TITLE, DistinctIdsChart } from './distinct-ids/distinct-ids-chart';
import { TraceAggregateCard } from './trace-aggregate-card';

export type DistinctIdsCardProps = {
  /** Called with the time range of the clicked bucket. */
  onTimeRangeClick?: (scope: DrilldownScope) => void;
};

/** Distinct resource, thread, user and session ids per bucket, with range totals from a second request. */
export function DistinctIdsCard(props: DistinctIdsCardProps) {
  return (
    <TraceAggregateCard title={DISTINCT_IDS_TITLE} description={DISTINCT_IDS_DESCRIPTION}>
      {scope => <DistinctIdsChart scope={scope} {...props} />}
    </TraceAggregateCard>
  );
}
