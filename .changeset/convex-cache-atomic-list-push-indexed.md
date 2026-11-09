---
'@mastra/convex': patch
---

Fixed resumed streams skipping events when using `ConvexServerCache`. Before this fix, if caching one event failed partway, every event cached afterwards could be read back at the wrong position, so a client resuming from an offset silently missed an event. `ConvexServerCache` now assigns the event's position and stores it in a single Convex mutation, and the cached log now honours the longer retention requested for durable streams instead of always using the cache's default TTL.

Redeploy your Convex functions (`npx convex deploy`) after upgrading so the `mastra/cache` handler picks up the new operation, then restart your Mastra server. A server that started before the redeploy falls back to the previous behaviour, which is not atomic and keeps cached events only for the default cache TTL, and logs a warning until it restarts.
