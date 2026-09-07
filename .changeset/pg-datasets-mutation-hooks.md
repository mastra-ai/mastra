---
'@mastra/core': patch
---

Added protected `getDatasetForMutation` and `listItemsForMutation` hooks to `DatasetsStorage`. The base `updateDataset`, `updateItem`, `deleteItem`, `batchInsertItems`, and `batchDeleteItems` flows now use these hooks for their pre-write dataset checks, so storage adapters that read from a replica can point those checks at the primary. Defaults are unchanged.
