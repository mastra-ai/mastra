import { useMemo, useState } from 'react';
import type { TracesFilters } from '../components/traces-explorer/traces-explorer-actions';
import { useTracesDateWindow } from '../components/traces-explorer/use-traces-date-window';
import { resolveTraceQueryTimeRange } from '../trace-query-filters';

/**
 * The window fields and values are discovered in: the filters' date window, ending at a mount-time
 * `now` rather than the list's rolling one, so discovery's query keys (and the body skeleton) don't
 * churn on every list refresh.
 */
export function useTracesDiscoveryWindow(filters: TracesFilters) {
  const { dateFrom, dateTo } = useTracesDateWindow(filters);
  const [now] = useState(() => new Date());
  return useMemo(() => resolveTraceQueryTimeRange(dateFrom, dateTo, now), [dateFrom, dateTo, now]);
}
