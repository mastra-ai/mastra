---
'@mastra/core': patch
---

Fixed the notification inbox tool so notifications are marked seen when the agent views them by listing, reading, or searching, instead of staying pending forever. Listing now defaults to unread notifications and to 20 records per call (use the `limit` option or a `status` filter to change that), reports `hasMore` when more remain and `markedSeen` for how many were transitioned, and drops internal metadata and payload bookkeeping from each record to keep responses small.
