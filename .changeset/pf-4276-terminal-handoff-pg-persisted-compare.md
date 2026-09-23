---
'@mastra/pg': patch
---

Fixed Postgres terminal commit replay comparisons to evaluate result payloads in their persisted JSON form, so an identical retried commit carrying `Date` values converges instead of falsely conflicting.
