import { useQueryClient } from '@tanstack/react-query';
import type { QueryFunctionContext } from '@tanstack/react-query';
import { createContext, use } from 'react';
import type { AggregatePriority, RequestLimiter } from '../lib/request-limiter';

export const AggregateLimiterContext = createContext<RequestLimiter | undefined>(undefined);

/** The page's limiter, from `MetricsProvider` or an `AggregateLimiterProvider` around it. */
export function useAggregateLimiter(): RequestLimiter {
  const limiter = use(AggregateLimiterContext);
  if (!limiter) throw new Error('useAggregateLimiter must be used inside MetricsProvider or AggregateLimiterProvider');
  return limiter;
}

/**
 * A React Query `queryFn` that waits for a slot in the page's limiter. It ignores React Query's abort
 * signal: under StrictMode, or when a card unmounts mid-flight, aborting would throw away a request
 * the next mount asks for again. A queued request is skipped instead when no card observes its query
 * by the time it reaches the front.
 */
export function useLimitedQueryFn<T>(
  task: () => Promise<T>,
  priority?: AggregatePriority,
): (context: QueryFunctionContext) => Promise<T> {
  const limiter = useAggregateLimiter();
  const queryClient = useQueryClient();
  return ({ queryKey }) =>
    limiter.run(task, {
      priority,
      isWanted: () => (queryClient.getQueryCache().find({ queryKey, exact: true })?.getObserversCount() ?? 0) > 0,
    });
}
