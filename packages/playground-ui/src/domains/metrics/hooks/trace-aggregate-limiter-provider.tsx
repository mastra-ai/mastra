import { use, useState } from 'react';
import type { ReactNode } from 'react';
import { createRequestLimiter, MAX_TRACE_AGGREGATES_IN_FLIGHT } from '../lib/request-limiter';
import { TraceAggregateLimiterContext } from './use-trace-aggregate-limiter';

/**
 * Caps `aggregateTraces()` requests at three in flight; the rest queue in order. `MetricsProvider`
 * renders one. Inside another one it reuses that limiter, so a provider rendered higher up shares
 * one cap across every `MetricsProvider` below it.
 */
export function TraceAggregateLimiterProvider({ children }: { children: ReactNode }) {
  const outer = use(TraceAggregateLimiterContext);
  const [own] = useState(() => (outer ? undefined : createRequestLimiter(MAX_TRACE_AGGREGATES_IN_FLIGHT)));
  return <TraceAggregateLimiterContext value={outer ?? own}>{children}</TraceAggregateLimiterContext>;
}
