---
'@mastra/core': minor
---

**Added observability storage domain schemas and implementations**

Introduced comprehensive storage schemas and in-memory implementations for all observability signals (scores, logs, feedback, metrics, discovery). All schemas are zod-based with full type inference. The `ObservabilityStorage` base class includes default implementations for all new methods.

**Breaking changes:**

- `MetricType` (`counter`/`gauge`/`histogram`) is deprecated — metrics are now raw events with aggregation at query time
- Score schemas use `scorerId` instead of `scorerName` for scorer identification
