---
'@mastra/playground-ui': minor
---

Added a Biggest movers card to the Metrics page. It lists what changed most against the previous window of the same length (the 7 days before a 7-day range, for example): agents and workflows on a project, projects on an organization-wide page. Tabs compare runs, error rate (in points), P95 latency and cost; rows are ranked by the absolute change, new entries are marked "New", and a row opens the matching traces.

Nested agent and workflow runs count, so an agent that only runs inside other agents still shows up. The card appears only when observability storage supports both trace and span aggregation (ClickHouse, Postgres and DuckDB today); other storage keeps the page unchanged.

Also exported for other Metrics pages: `MoversCard`, `useMetricsCostBreakdown` (tokens and cost per group over any window), and `buildMovers`, `moverTrend`, `previousWindow` and `windowLength` from the metrics lib.
