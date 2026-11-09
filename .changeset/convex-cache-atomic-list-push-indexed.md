---
'@mastra/convex': patch
---

Fixed resumed streams skipping events when using `ConvexServerCache`. Before this fix, if caching one event failed partway, every event cached afterwards could be read back at the wrong position, so a client resuming from an offset silently missed an event. `ConvexServerCache` now assigns the event's position and stores it in a single Convex mutation, and the cached log now honours the longer retention requested for durable streams instead of always using the cache's default TTL.

Redeploy your Convex functions (`npx convex deploy`) after upgrading so the `mastra/cache` handler picks up the new operation. Until you do, the cache falls back to the previous behaviour and logs a warning.
