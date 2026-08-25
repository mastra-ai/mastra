---
'@mastra/pg': patch
'@mastra/playground-ui': patch
---

Stop observability filter discovery from re-scanning all history on every refresh

Discovery queries that build Studio's Traces, Logs, and Metrics filter suggestions scanned every span, metric, and log event each time the cache went stale, which grew unbounded with retained data. Refreshes are now bounded to the last 30 days by default (configurable via `observability.discovery.lookbackSeconds`, `0` restores the previous unbounded behaviour), so the planner can prune partitions instead of reading all of them. Only one process refreshes a given cache entry at a time, so running several server instances no longer multiplies the work, and Studio holds discovery results for five minutes instead of refetching on every page mount.
