# @mastra/engine

## 0.1.0

### Minor Changes

- 024b16b: The MastraEngine has been simplified and many legacy SQL methods from the pre-Mastra days are removed. This should be easier to persist data for retrieval or indexing.

  Methods:

  ### Entity

  `createEntity`
  `getEntityById`
  `getEntity`
  `deleteEntityById`

  ### Records

  upsertRecords
  getRecordsByEntityId
  getRecordsByEntityName
  getRecords
  syncRecords
