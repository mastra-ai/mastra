import type { MastraClient } from '@mastra/client-js';

export const successfulPurgeDatasetItemResponse = {
  success: true,
} satisfies Awaited<ReturnType<MastraClient['purgeDatasetItem']>>;
