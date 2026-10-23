---
'@mastra/playground-ui': minor
---

Added a Breakdown card to the Metrics page. One sortable table ranks agents, workflows, tools, models, threads and environments, plus projects on pages that cover several projects. Columns are runs or traces, error rate, P95, tokens, cost and a token trend, then **Before** and **Change** against the previous window of the same length. Before and Change follow the sorted column, so sorting by Cost shows how each row's cost moved; sorting by Change ranks the rows that moved most. Agents, workflows and tools count every run, including runs nested inside another agent's trace, so a subagent that never starts a trace still shows up. Clicking a row opens its traces.

The card replaces Trace volume and Usage when observability storage supports both trace and span aggregation (ClickHouse, Postgres and DuckDB today). Other storage keeps the page as it was.

Also added:

- Sortable column headers on `MetricsShareList` (`onSortChange`, `sort`, `valueSortKey`, and `sortKey` per column). The share strip and row colours still follow share, whatever the sort.
- A `span` drilldown scope (`{ spanTypes, entityName, status? }`) on `buildTracesDrilldownUrl`, which opens traces containing a matching span.
- `bodyHeight="fit"` on `ChartCard`, for lists that grow past one chart's height.
- `useMetricsTokenSeries` (tokens and cost per group per bucket) and `useMetricsUsageTotals` (per group over any window). Cards that ask for the same grouping share one request.
