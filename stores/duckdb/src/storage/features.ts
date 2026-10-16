import * as coreStorage from '@mastra/core/storage';

export const spanQueryFeatures =
  typeof coreStorage.planSpanQuery === 'function' && coreStorage.SPAN_QUERY_FIELD_REGISTRY !== undefined
    ? (['span-query'] as const)
    : ([] as const);
