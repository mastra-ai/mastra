---
'@mastra/dynamodb': patch
---

Fixed `listMessages` reporting `hasMore: false` too early when `include` context messages fall outside the active `resourceId` or `dateRange` filters. Only messages matching the filters now count toward the returned total, so later filter-matching pages are no longer hidden.
