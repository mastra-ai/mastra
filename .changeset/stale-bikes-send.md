---
'@mastra/core': minor
---

Added time to first token and time to first chunk measures to trace and span aggregates, so dashboards can chart streaming latency next to duration.

The new measures are `timeToFirstToken.avg`, `.min`, `.max`, `.p50`, `.p90`, `.p95`, `.p99`, and `.count`, plus the same set for `timeToFirstChunk`. Traces and spans without a recorded value are skipped instead of counted as 0, and `.count` reports how many had one. Stores opt in through the `aggregate-time-to-first-measures` feature.
