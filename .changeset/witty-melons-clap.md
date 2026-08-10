---
'@mastra/server': patch
---

Fix workflow stream caching being tied to a single client connection. Cached chunks are now written per run rather than per subscriber, so `/observe` replays a complete history after a client disconnects mid-run, and concurrent subscribers to the same run no longer cache every chunk twice.
