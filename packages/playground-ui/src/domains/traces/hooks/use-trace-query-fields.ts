import { MastraClientError } from '@mastra/client-js';
import type { GetTraceQueryFieldsArgs, GetTraceQueryFieldsResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DISCOVERY_STALE_TIME } from './discovery-cache';

export type TraceQueryDiscoveryTimeRange = GetTraceQueryFieldsArgs['timeRange'];

// Server caps discovery limits at 100 (TRACE_QUERY_DISCOVERY_MAX_LIMIT).
const FIELDS_LIMIT = 100;

const EMPTY_FIELDS: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [],
  observedFieldsTruncated: false,
};

const TRACE_QUERY_DISCOVERY_UNSUPPORTED = 'TRACE_QUERY_DISCOVERY_UNSUPPORTED';

const isDiscoveryUnsupportedError = (error: unknown) =>
  error instanceof MastraClientError &&
  typeof error.body === 'object' &&
  error.body !== null &&
  (error.body as { code?: unknown }).code === TRACE_QUERY_DISCOVERY_UNSUPPORTED;

export const traceQueryFieldsQueryKey = (timeRange: TraceQueryDiscoveryTimeRange) =>
  ['trace-query-fields', timeRange.from, timeRange.to] as const;

/**
 * Discovers the `metadata.*` fields observed on traces in the given time range so the
 * filter bar can offer them. Resolves to an empty field list when the server or store does
 * not support discovery (`TRACE_QUERY_DISCOVERY_UNSUPPORTED`) so callers never stay blocked.
 */
export const useTraceQueryFields = ({
  timeRange,
  enabled = true,
}: {
  timeRange: TraceQueryDiscoveryTimeRange;
  enabled?: boolean;
}) => {
  const client = useMastraClient();

  const query = useQuery({
    queryKey: traceQueryFieldsQueryKey(timeRange),
    queryFn: async ({ signal }) => {
      try {
        return await client.getTraceQueryFields(
          { timeRange, predicateScope: 'trace', limit: FIELDS_LIMIT },
          { signal },
        );
      } catch (error) {
        if (isDiscoveryUnsupportedError(error)) return EMPTY_FIELDS;
        throw error;
      }
    },
    enabled,
    retry: false,
    staleTime: DISCOVERY_STALE_TIME,
    // Changing the time range must not tear down the filter bar behind a skeleton;
    // keep the previous field list until the new range resolves.
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    metadataFields: query.data?.observedFields ?? EMPTY_FIELDS.observedFields,
  };
};
