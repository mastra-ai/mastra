---
'@mastra/mongodb': patch
---

Added durable storage for explicit experiment execution and scorer counts, per-item execution status, and experiment threshold snapshots in the MongoDB provider. Historical documents derive target execution counts from the legacy counters without inventing scorer counts or thresholds.
