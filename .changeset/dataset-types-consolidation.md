---
"@mastra/core": patch
---

Consolidate OSS dataset domain types. Introduces `DatasetItemPayload` (the 7-field user-supplied portion of a dataset item) as the canonical base; `AddDatasetItemInput`, `UpdateDatasetItemInput`, and `BatchInsertItemsInput.items` now derive from it instead of repeating the same field list. `Dataset.addItem`, `addItems`, `updateItem`, and `update` use the canonical exported types instead of inline anonymous shapes. Export hygiene only — no runtime behavior change.
