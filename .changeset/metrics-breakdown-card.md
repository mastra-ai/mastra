---
'@mastra/playground-ui': minor
---

Added a Breakdown card to the Metrics page. One sortable table, with no share bars or colours, ranks agents, workflows, tools, models, threads and environments, plus projects on pages that cover several projects.

- **Count column**: traces for agents, workflows, threads, environments and projects (an agent counts each trace it ran in once, nested runs included, so a subagent that never starts a trace still shows up); spans for tools and models, since one trace can call a tool or model many times. Model spans are counted from model usage events, so calls that report no usage aren't counted. A tooltip on the header explains whichever one the tab counts.
- **Errors**, **P95 latency**, **Tokens** and **Cost** where the tab has them. Workflows and tools have no token usage; models have no errors or latency.
- **% Change** against the previous range of the same length, as the last column, right after the count. It follows the sorted column, so sorting by Cost shows how each row's cost moved, and sorting by % Change ranks the rows that moved most. Its header tooltip names the figure it compares and the dates of both ranges.
- **Project**, on pages that cover several projects (`MetricsProvider` `scope.projectLabel` set), right after the name on every tab but Projects. It shows `projectLabel(projectId)`, and a dash for rows without a project. **Resource** on the Threads tab.

Clicking a row opens its traces. The card replaces Trace volume and Usage when observability storage supports both trace and span aggregation (ClickHouse, Postgres and DuckDB today). Other storage keeps the page as it was.

Also added:

- `MetricsShareList`: sortable column headers (`onSortChange`, `sort`, `valueSortKey`, and `sortKey` per column), header tooltips (`description` per column, `valueDescription`), left-aligned text columns (`align: 'left'`), which sit right after the label, before the number columns, `emphasis` columns in the main value's colour, `showShare={false}` to hide the Share column, and `showStrip={false}` for a plain table without the strip and row swatches. When shown, the strip and row colours follow share, whatever the sort.
- A `span` drilldown scope (`{ spanTypes, entityName, status? }`) on `buildTracesDrilldownUrl`, which opens traces containing a matching span.
- `bodyHeight="fit"` on `ChartCard`, for lists that grow past one chart's height.
- `useMetricsUsageTotals`: tokens and cost, or counted model calls, per group over any window. Cards that ask for the same grouping share one request.
