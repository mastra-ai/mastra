---
'@mastra/playground-ui': minor
---

Added a Breakdown card to the Metrics page. One sortable table ranks agents, workflows, tools and environments, plus projects on pages that cover several projects. Columns are runs or traces, error rate, P95, tokens, cost and a token trend. Agents, workflows and tools count every run, including runs nested inside another agent's trace, so a subagent that never starts a trace still shows up. Clicking a row opens the traces it ran in.

The card replaces Trace volume when observability storage supports both trace and span aggregation (ClickHouse, Postgres and DuckDB today). Other storage keeps the page as it was.

Also added:

- Sortable column headers on `MetricsShareList` (`onSortChange`, `sort`, `valueSortKey`, and `sortKey` per column). The share strip and row colours still follow share, whatever the sort.
- A Projects tab on the Usage card for pages that pass `projectLabel` to `MetricsProvider`.
- A `span` drilldown scope (`{ spanTypes, entityName, status? }`) on `buildTracesDrilldownUrl`, which opens traces containing a matching span.
- `useMetricsTokenSeries`, which loads tokens and cost per group per bucket. Cards that ask for the same grouping share one request.
