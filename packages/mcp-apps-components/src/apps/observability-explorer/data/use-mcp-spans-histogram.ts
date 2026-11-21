import type { AggregateSpansResponse } from '@mastra/client-js';
import {
  exceedsAggregateWindow,
  HISTOGRAM_MEASURES,
  histogramPlan,
} from '@mastra/playground-ui/domains/observability/lib/histogram-buckets';
import type { SpansExplorerHistogramData } from '@mastra/playground-ui/domains/spans/spans-explorer-data';
import type { SpansExplorerSupport } from '@mastra/playground-ui/domains/spans/spans-explorer-support';
import type { SpanQueryArgs } from '@mastra/react/hooks/traces';
import type { App } from '@modelcontextprotocol/ext-apps';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { callTool } from '../../../shared/mcp-app';
import { toolRequest } from './tool-request';

const NO_ROWS: AggregateSpansResponse['rows'] = [];

export type UseMcpSpansHistogramArgs = {
  app: App;
  timeRange: SpanQueryArgs['timeRange'];
  where?: SpanQueryArgs['where'];
  support: SpansExplorerSupport;
};

/**
 * Span and error counts over the list's window and filters, through `aggregate_spans`. `undefined` when the store
 * can't aggregate spans or the window is wider than it aggregates, so it never asks.
 */
export function useMcpSpansHistogram({
  app,
  timeRange,
  where,
  support,
}: UseMcpSpansHistogramArgs): SpansExplorerHistogramData | undefined {
  const request = useMemo(
    () => ({
      timeRange,
      ...(where ? { where } : {}),
      interval: histogramPlan(timeRange).interval,
      measures: [...HISTOGRAM_MEASURES],
      // No groupBy means a single group; the default limit would multiply past the server's row cap.
      limit: 1,
    }),
    [timeRange, where],
  );

  const shown = support.withAggregate && !exceedsAggregateWindow(timeRange);
  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['mcp-span-aggregate', request],
    queryFn: () => toolRequest<AggregateSpansResponse>(callTool(app, 'aggregate_spans', request)),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: shown,
  });

  if (!shown) return undefined;
  return { timeRange, rows: data?.rows ?? NO_ROWS, isLoading, isError, isUpdating: isPlaceholderData };
}
