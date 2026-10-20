import { useState } from 'react';
import type { ReactNode } from 'react';
import { createRequestLimiter, MAX_TRACE_AGGREGATES_IN_FLIGHT } from '../lib/request-limiter';
import { TraceAggregateLimiterContext } from './use-trace-aggregate-limiter';

/** Rendered by `MetricsProvider`. Caps the Metrics page's `aggregateTraces()` requests at three in flight; the rest queue in order. */
export function TraceAggregateLimiterProvider({ children }: { children: ReactNode }) {
  const [limiter] = useState(() => createRequestLimiter(MAX_TRACE_AGGREGATES_IN_FLIGHT));
  return <TraceAggregateLimiterContext value={limiter}>{children}</TraceAggregateLimiterContext>;
}
