import { createContext, use } from 'react';
import type { RequestLimiter } from '../lib/request-limiter';

export const TraceAggregateLimiterContext = createContext<RequestLimiter | undefined>(undefined);

/** The page's limiter, from `MetricsProvider` or a `TraceAggregateLimiterProvider` around it. */
export function useTraceAggregateLimiter(): RequestLimiter {
  const limiter = use(TraceAggregateLimiterContext);
  if (!limiter)
    throw new Error('useTraceAggregateLimiter must be used inside MetricsProvider or TraceAggregateLimiterProvider');
  return limiter;
}
