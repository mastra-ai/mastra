import * as coreStorage from '@mastra/core/storage';

export const threadQueryFeatures =
  typeof coreStorage.planThreadRowsQuery === 'function' ? (['thread-query-rows'] as const) : ([] as const);

export const spanQueryFeatures =
  typeof coreStorage.planSpanQuery === 'function'
    ? ([
        'span-query',
        'span-query-context-fields',
        'span-query-parent-entity-fields',
        'span-query-root-entity-fields',
        'span-query-execution-source',
      ] as const)
    : ([] as const);

export const spanAggregateFeatures =
  typeof coreStorage.planSpanAggregate === 'function' ? (['span-aggregate'] as const) : ([] as const);

/** Core versions without the field reject it in trace query results, so it is only returned when core knows it. */
export const timeToFirstChunkSupported = 'timeToFirstChunkMs' in coreStorage.TRACE_QUERY_FIELD_REGISTRY.trace;

/** Core before the sort rejects `orderBy` on the field, so the sort is only declared when core plans it. */
const timeToFirstChunkSortSupported = coreStorage.TRACE_QUERY_ORDER_FIELDS?.includes('timeToFirstChunkMs') === true;

export const timeToFirstChunkFeatures = [
  ...(timeToFirstChunkSupported ? (['trace-query-time-to-first-chunk'] as const) : []),
  ...(timeToFirstChunkSortSupported ? (['trace-query-time-to-first-chunk-sort'] as const) : []),
] as const;
