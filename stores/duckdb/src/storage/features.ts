import * as coreStorage from '@mastra/core/storage';

export const spanQueryFeatures =
  typeof coreStorage.planSpanQuery === 'function'
    ? (['span-query', 'span-query-context-fields'] as const)
    : ([] as const);

/** Core versions without the field reject it in trace query results, so it is only returned when core knows it. */
export const timeToFirstChunkSupported = 'timeToFirstChunkMs' in coreStorage.TRACE_QUERY_FIELD_REGISTRY.trace;

export const timeToFirstChunkFeatures = timeToFirstChunkSupported
  ? (['trace-query-time-to-first-chunk'] as const)
  : ([] as const);
