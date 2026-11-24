import { use, useState } from 'react';
import type { ReactNode } from 'react';
import { createRequestLimiter, MAX_AGGREGATES_IN_FLIGHT } from '../lib/request-limiter';
import { AggregateLimiterContext } from './use-aggregate-limiter';

/**
 * Caps `aggregateTraces()` and `aggregateSpans()` requests at three in flight; the rest queue by
 * priority. `MetricsProvider` renders one. Inside another one it reuses that limiter, so a provider
 * rendered higher up shares one cap across every `MetricsProvider` below it.
 */
export function AggregateLimiterProvider({ children }: { children: ReactNode }) {
  const outer = use(AggregateLimiterContext);
  const [own] = useState(() => (outer ? undefined : createRequestLimiter(MAX_AGGREGATES_IN_FLIGHT)));
  return <AggregateLimiterContext value={outer ?? own}>{children}</AggregateLimiterContext>;
}
