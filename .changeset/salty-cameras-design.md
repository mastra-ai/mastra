---
'@mastra/playground-ui': minor
---

The Metrics date picker now blocks custom ranges that start before the oldest trace the store still keeps.

The trace aggregate request limiter is exported as `TraceAggregateLimiterProvider` from `@mastra/playground-ui/domains/metrics/components`, next to the Metrics cards. `MetricsProvider` already renders one, so pages built on it need nothing extra; render it higher up to share one cap of 3 requests across several providers.
