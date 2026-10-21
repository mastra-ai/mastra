---
'@mastra/playground-ui': minor
---

Added three cards to the Metrics page that read from trace aggregation:

- **Trace latency** charts P50, P90 and P99 trace duration over time, with tabs for agents and workflows. Click a point to open those traces.
- **Top entities** ranks the 20 slowest, most failing and most expensive agents and workflows, leaving out scorer runs. Click a row to open its traces with the page filters applied.
- **Trace breakdown** lists trace count, error rate and cost per environment. Click an environment to open its traces.

The cards are hidden on servers that don't support trace aggregation, and show a message instead of data when a page filter has no trace equivalent.

All three are exported from `@mastra/playground-ui/domains/metrics/components`, and take their drilldowns as callback props, so other apps can place them on their own Metrics pages inside a `MetricsProvider`.
