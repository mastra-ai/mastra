import { MastraClientError } from '@mastra/client-js';
import type {
  GetTraceQueryFieldsArgs,
  GetTraceQueryFieldsResponse,
  GetTraceQueryValuesArgs,
  MastraClient,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  encodeTraceMetadataValue,
  formatTraceMetadataValue,
  traceMetadataPathToField,
} from '../trace-metadata-filter-codec';
import type { TraceMetadataPath } from '../trace-metadata-filter-codec';
import type { TraceFilterOperatorId } from '../trace-query-filters';
import { DISCOVERY_STALE_TIME } from './discovery-cache';
import type { FilterBarFieldType, FilterBarSuggestionsResolver } from '@/ds/components/FilterBar/types';

export type TraceQueryDiscoveryTimeRange = GetTraceQueryFieldsArgs['timeRange'];

type ObservedMetadataField = GetTraceQueryFieldsResponse['observedFields'][number];
type ObservedMetadataValueKind = ObservedMetadataField['valueKind'];

export type TraceMetadataFilterField = {
  id: string;
  label: string;
  path: TraceMetadataPath;
  type?: FilterBarFieldType;
  operators: TraceFilterOperatorId[];
  strict?: boolean;
  suggestions: FilterBarSuggestionsResolver;
};

const TRACE_QUERY_OPERATOR_TO_FILTER_OPERATOR = {
  eq: 'is',
  ne: 'isNot',
  in: 'in',
  notIn: 'notIn',
  exists: 'exists',
  notExists: 'notExists',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
} as const satisfies Record<ObservedMetadataField['operators'][number], TraceFilterOperatorId>;

const fieldType = (valueKind: ObservedMetadataValueKind): FilterBarFieldType | undefined => {
  if (valueKind === 'number' || valueKind === 'boolean') return valueKind;
  return undefined;
};

// Server caps discovery limits at 100 (TRACE_QUERY_DISCOVERY_MAX_LIMIT).
const DISCOVERY_LIMIT = 100;

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

/** Lazy FilterBar suggestions resolver backed by the value-discovery endpoint for one
 *  `predicateScope` + `path`. FilterBar owns debounce/abort; this only fetches. */
export const createTraceQueryValuesResolver = (
  client: MastraClient,
  timeRange: TraceQueryDiscoveryTimeRange,
  predicateScope: GetTraceQueryValuesArgs['predicateScope'],
  path: TraceMetadataPath,
): FilterBarSuggestionsResolver => {
  return async ({ query: search, signal }) => {
    const { values } = await client.getTraceQueryValues(
      { timeRange, predicateScope, path, search: search.trim() || undefined, limit: DISCOVERY_LIMIT },
      { signal },
    );
    return values.map(({ value }) => ({
      value: encodeTraceMetadataValue(value),
      label: formatTraceMetadataValue(value),
    }));
  };
};

/**
 * Discovers the `metadata.*` fields observed on traces in the given time range and returns
 * them as filter bar fields, each with a lazy `suggestions` resolver that fetches the field's
 * values when the user opens the value step (FilterBar owns debounce/abort).
 *
 * Resolves to an empty field list when the server or store does not support discovery
 * (`TRACE_QUERY_DISCOVERY_UNSUPPORTED`) so callers never stay blocked.
 */
export const useTraceMetadataFilterFields = ({
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
          { timeRange, predicateScope: 'trace', limit: DISCOVERY_LIMIT },
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

  const observedFields = query.data?.observedFields;

  const fields = useMemo<TraceMetadataFilterField[]>(
    () =>
      (observedFields ?? []).flatMap(field => {
        const identity = traceMetadataPathToField(field.path);
        if (!identity) return [];
        return [
          {
            ...identity,
            type: fieldType(field.valueKind),
            operators: field.operators.map(operator => TRACE_QUERY_OPERATOR_TO_FILTER_OPERATOR[operator]),
            ...(field.valueKind === 'scalar' ? { strict: true } : {}),
            suggestions: createTraceQueryValuesResolver(client, timeRange, 'trace', identity.path),
          },
        ];
      }),
    [observedFields, client, timeRange],
  );

  return { fields, isLoading: query.isLoading, error: query.error };
};
