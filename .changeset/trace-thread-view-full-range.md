---
'@mastra/playground-ui': minor
---

The trace thread view now shows the whole thread instead of only the last 31 days. Field suggestions on the traces page now use the full selected date range.

Removed `clampTraceDiscoveryTimeRange` and `TRACE_QUERY_DISCOVERY_MAX_RANGE_MS`. Trace queries no longer limit the time range, so they are not needed.
