import * as coreStorage from '@mastra/core/storage';

export const spanQueryFeatures =
  typeof coreStorage.planSpanQuery === 'function'
    ? (['span-query', 'span-query-context-fields'] as const)
    : ([] as const);
