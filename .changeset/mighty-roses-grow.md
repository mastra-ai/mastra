---
'@mastra/dynamodb': patch
---

Fixed `listMessages` pagination so `hasMore` is `false` when `include` (e.g. `withNextMessages`/`withPreviousMessages`) already returns every message in the queried thread(s). Previously `hasMore` was derived from `offset + perPage < total` only, so it stayed `true` even when the included context completed the full set — matching the behavior of the pg store.
