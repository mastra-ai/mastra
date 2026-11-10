---
'@mastra/convex': patch
---

Fixed `ConvexServerCache.get()` returning `null` for counter keys. Counters written by `increment()` and `listPushIndexed()` now read back as numbers, matching the in-memory and Redis caches.

This makes resumed streams on Convex work as intended: resuming from an offset reads only the tail of the cached log instead of the whole log, and a subscriber whose log expired or was cleared now picks up the run's new events instead of dropping them.

The fix is in the `mastra/cache` Convex function, so redeploy your Convex functions (`npx convex deploy`) after upgrading. You don't need to restart your Mastra server.
