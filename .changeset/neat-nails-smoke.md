---
'@mastra/playground-ui': patch
---

Added shared metrics components and hooks under `@mastra/playground-ui`. Consumers can now reuse the metrics dashboard building blocks (KPI, Latency, Scores, Token Usage, Trace Volume, Model Usage Cost cards), their data hooks, and the `MetricsProvider` / `DateRangeSelector` primitives instead of duplicating them per app.

**New peer dependency:** `@tanstack/react-query ^5.90.21`. Add it alongside your existing playground-ui install.
