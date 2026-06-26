---
"@mastra/core": patch
---

Added `DatasetItemPayload`, a new exported type describing the user-supplied fields of a dataset item.

Dataset item inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, and batch insert items) now share this type, so they stay consistent automatically. This is a type-only change with no runtime behavior change.
