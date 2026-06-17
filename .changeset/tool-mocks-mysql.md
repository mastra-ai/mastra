---
'@mastra/mysql': patch
---

The MySQL store now rejects item-level tool mocks with a clear error instead of silently dropping them. Tool mock persistence is not yet supported on MySQL, so saving a dataset item with `toolMocks` (or an experiment result with a `toolMockReport`) fails fast rather than discarding the data.
