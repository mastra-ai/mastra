---
'@mastra/client-js': patch
---

Extend `DatasetItemSource['type']` with `'candidate-screener'`.

Mirrors the `@mastra/core` enum extension so externally-materialized dataset items round-trip through the client SDK without type errors.
