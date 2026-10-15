---
'@mastra/react': minor
---

Added `datasetQueryOptions` and `datasetItemsQueryOptions`, so you can prefetch a dataset or its items (for example on hover) into the same cache entry that `useDataset` and `useDatasetItems` read.

```tsx
import { datasetQueryOptions, datasetItemsQueryOptions, useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';

const client = useMastraClient();
const queryClient = useQueryClient();

const prefetch = (datasetId: string) => {
  void queryClient.prefetchQuery(datasetQueryOptions(client, datasetId));
  void queryClient.prefetchInfiniteQuery(datasetItemsQueryOptions(client, { datasetId }));
};
```
