import * as coreStorage from '@mastra/core/storage';

export const spanQueryFeatures =
  typeof coreStorage.planSpanQuery === 'function' ? (['span-query'] as const) : ([] as const);
