---
'mastra': patch
---

Extend `SaveAsDatasetItemDialog`'s `source.type` prop with `'candidate-screener'`.

Playground's Save-as-Dataset-Item dialog had a hardcoded copy of the closed `DatasetItemSource['type']` union. Now that `@mastra/core` extends the union with `'candidate-screener'`, the dialog accepts it too so externally-materialized items round-trip through the playground UI without type errors.
