---
'@mastra/spanner': patch
---

Widened `SpannerStore` dataset initialization to backfill `targetType`, `targetIds`, and `scorerIds` on pre-existing `mastra_datasets` tables. The `createDataset` / `updateDataset` write paths and the new `listDatasets` `targetType` / `targetIds` filters (MASTRA-4433) reference these columns; deployments that upgraded in place before these columns were declared would otherwise hit column-not-found errors on both writes and the new filter path.

Fresh databases were already unaffected because `createTable` reads the full `DATASETS_SCHEMA`.
