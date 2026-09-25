---
'@mastra/mongodb': patch
---

Fixed MongoDB skills listing ignoring the `status` and `entityIds` filters. `list({ status: 'published' })` no longer returns draft skills, `list({ entityIds: [] })` now returns no skills, and pagination totals reflect the filtered results.
