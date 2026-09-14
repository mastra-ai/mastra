---
'@mastra/core': patch
---

Fixed the notification inbox tool leaving notifications pending forever after the agent viewed them. Listing, reading, or searching now marks the returned unread notifications as seen. `list` defaults to unread notifications in pages of 20 and reports `hasMore` and `markedSeen`; pass `status: 'seen'` to list already-viewed notifications or `limit` to change the page size. Internal `metadata` and `payload` fields are no longer included in list and search results.
