---
'@mastra/duckdb': minor
---

Spans now store six native fields in their own columns: `externalParentSpanId`, `resumedFromSpanId`, `model`, `provider`, `outcome` and `stopReason`. Existing databases get the columns automatically when the store starts. The columns stay empty for spans written before the upgrade, with an older `@mastra/core`, or by producers that do not set them yet.
